// src/services/socialMonitor.ts
import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import * as cron from 'node-cron';
import Parser from 'rss-parser';
import { 
  getMonitoredAccounts, 
  updateAccountLastChecked, 
  MonitoredAccount 
} from '../utils/accountManager';
import { getBlueskyUserPosts, isBlueskyInitialized } from '../utils/blueskyClient';
import { getInstagramPosts } from '../utils/instagramClient';
import { logger } from '../utils/logger';

export class SocialMonitorService {
  private client: Client;
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();

  constructor(client: Client) {
    this.client = client;
  }

  start(): void {
    // Monitor YouTube feeds every 5 minutes
    const youtubeJob = cron.schedule(
      `*/${process.env.RSS_CHECK_INTERVAL || 5} * * * *`, 
      () => this.checkYouTubeAccounts(),
      { scheduled: false }
    );

    // Monitor Bluesky every 3 minutes
    const blueskyJob = cron.schedule(
      `*/${process.env.BLUESKY_CHECK_INTERVAL || 3} * * * *`, 
      () => this.checkBlueskyAccounts(),
      { scheduled: false }
    );

    // Monitor Instagram every 10 minutes (to avoid rate limits)
    const instagramJob = cron.schedule(
      `*/${process.env.INSTAGRAM_CHECK_INTERVAL || 10} * * * *`, 
      () => this.checkInstagramAccounts(),
      { scheduled: false }
    );

    // Start the jobs
    youtubeJob.start();
    blueskyJob.start();
    instagramJob.start();

    this.cronJobs.set('youtube', youtubeJob);
    this.cronJobs.set('bluesky', blueskyJob);
    this.cronJobs.set('instagram', instagramJob);

    logger.info('Social Monitor Service started');
  }

  stop(): void {
    this.cronJobs.forEach((job, name) => {
      job.stop();
      logger.info(`Stopped ${name} monitoring job`);
    });
    this.cronJobs.clear();
  }

  private async checkYouTubeAccounts(): Promise<void> {
    try {
      const youtubeAccounts = getMonitoredAccounts('youtube');
      
      for (const account of youtubeAccounts) {
        await this.checkYouTubeAccount(account);
      }
    } catch (error) {
      logger.error(`Error checking YouTube accounts: ${error}`);
    }
  }

  private async checkBlueskyAccounts(): Promise<void> {
    try {
      if (!isBlueskyInitialized()) {
        return;
      }

      const blueskyAccounts = getMonitoredAccounts('bluesky');
      
      for (const account of blueskyAccounts) {
        await this.checkBlueskyAccount(account);
      }
    } catch (error) {
      logger.error(`Error checking Bluesky accounts: ${error}`);
    }
  }

  private async checkInstagramAccounts(): Promise<void> {
    try {
      const instagramAccounts = getMonitoredAccounts('instagram');
      
      for (const account of instagramAccounts) {
        await this.checkInstagramAccount(account);
      }
    } catch (error) {
      logger.error(`Error checking Instagram accounts: ${error}`);
    }
  }

  private async checkYouTubeAccount(account: MonitoredAccount): Promise<void> {
    try {
      if (!account.rssUrl) {
        logger.error(`No RSS URL for YouTube account: ${account.displayName}`);
        return;
      }

      const parser = new Parser({
        timeout: 10000,
        customFields: {
          item: ['media:thumbnail', 'yt:videoId', 'yt:channelId']
        }
      });

      const feed = await parser.parseURL(account.rssUrl);
      const latestVideo = feed.items[0];

      if (!latestVideo) {
        return;
      }

      // Check if this is a new video
      if (account.lastPostId && latestVideo.guid === account.lastPostId) {
        return;
      }

      // Announce the new video
      await this.announceYouTubeVideo(account, latestVideo);
      
      // Update last checked
      updateAccountLastChecked(account.id, latestVideo.guid);

    } catch (error) {
      logger.error(`Error checking YouTube account ${account.displayName}: ${error}`);
    }
  }

  private async checkBlueskyAccount(account: MonitoredAccount): Promise<void> {
    try {
      const posts = await getBlueskyUserPosts(account.identifier, 5);
      
      if (posts.length === 0) {
        return;
      }

      const latestPost = posts[0];
      const postId = latestPost.post.uri;

      // Check if this is a new post
      if (account.lastPostId && postId === account.lastPostId) {
        return;
      }

      // Announce the new post
      await this.announceBlueskyPost(account, latestPost);
      
      // Update last checked
      updateAccountLastChecked(account.id, postId);

    } catch (error) {
      logger.error(`Error checking Bluesky account ${account.displayName}: ${error}`);
    }
  }

  private async checkInstagramAccount(account: MonitoredAccount): Promise<void> {
    try {
      const posts = await getInstagramPosts(account.identifier, 5);
      
      if (posts.length === 0) {
        return;
      }

      const latestPost = posts[0];

      // Check if this is a new post
      if (account.lastPostId && latestPost.id === account.lastPostId) {
        return;
      }

      // Announce the new post
      await this.announceInstagramPost(account, latestPost);
      
      // Update last checked
      updateAccountLastChecked(account.id, latestPost.id);

    } catch (error) {
      logger.error(`Error checking Instagram account ${account.displayName}: ${error}`);
    }
  }

  private async announceYouTubeVideo(account: MonitoredAccount, video: any): Promise<void> {
    try {
      const channelId = process.env.YOUTUBE_CHANNEL_ID;
      if (!channelId) return;

      const channel = await this.client.channels.fetch(channelId) as TextChannel;
      if (!channel?.isTextBased()) return;

      const thumbnail = video['yt:videoId'] ? 
        `https://img.youtube.com/vi/${video['yt:videoId']}/maxresdefault.jpg` : 
        video['media:thumbnail']?.['$']?.url || '';

      const embed = new EmbedBuilder()
        .setTitle(video.title)
        .setURL(video.link)
        .setDescription(video.contentSnippet?.substring(0, 200) + '...' || '')
        .setColor(0xff0000)
        .setAuthor({ 
          name: account.displayName,
          iconURL: account.metadata?.profileImage 
        })
        .setFooter({ text: '📺 New YouTube Video' })
        .setTimestamp(new Date(video.pubDate));

      if (thumbnail) {
        embed.setImage(thumbnail);
      }

      let content = `🎬 **${account.displayName}** uploaded a new video!`;
      if (process.env.NOTIFICATION_ROLE_ID) {
        content += ` <@&${process.env.NOTIFICATION_ROLE_ID}>`;
      }

      await channel.send({ content, embeds: [embed] });
      logger.info(`Announced YouTube video from ${account.displayName}: ${video.title}`);

    } catch (error) {
      logger.error(`Error announcing YouTube video: ${error}`);
    }
  }

  private async announceBlueskyPost(account: MonitoredAccount, post: any): Promise<void> {
    try {
      const channelId = process.env.BLUESKY_CHANNEL_ID;
      if (!channelId) return;

      const channel = await this.client.channels.fetch(channelId) as TextChannel;
      if (!channel?.isTextBased()) return;

      const postData = post.post;
      const author = postData.author;
      
      const embed = new EmbedBuilder()
        .setAuthor({ 
          name: `${author.displayName || author.handle}`,
          iconURL: author.avatar || undefined,
          url: `https://bsky.app/profile/${author.handle}`
        })
        .setDescription(postData.record.text || 'No text content')
        .setColor(0x00aced)
        .setTimestamp(new Date(postData.record.createdAt))
        .setFooter({ text: '🦋 New Bluesky Post' });

      // Add post URL
      const postUrl = `https://bsky.app/profile/${author.handle}/post/${postData.uri.split('/').pop()}`;
      embed.setURL(postUrl);

      let content = `🐦 **${account.displayName}** posted on Bluesky!`;
      if (process.env.NOTIFICATION_ROLE_ID) {
        content += ` <@&${process.env.NOTIFICATION_ROLE_ID}>`;
      }

      await channel.send({ content, embeds: [embed] });
      logger.info(`Announced Bluesky post from ${account.displayName}`);

    } catch (error) {
      logger.error(`Error announcing Bluesky post: ${error}`);
    }
  }

  private async announceInstagramPost(account: MonitoredAccount, post: any): Promise<void> {
    try {
      const channelId = process.env.INSTAGRAM_CHANNEL_ID;
      if (!channelId) return;

      const channel = await this.client.channels.fetch(channelId) as TextChannel;
      if (!channel?.isTextBased()) return;

      const embed = new EmbedBuilder()
        .setAuthor({ 
          name: account.displayName,
          iconURL: account.metadata?.profileImage,
          url: `https://instagram.com/${account.identifier}`
        })
        .setDescription(post.caption.substring(0, 300) + (post.caption.length > 300 ? '...' : ''))
        .setImage(post.imageUrl)
        .setColor(0xe4405f)
        .setURL(post.url)
        .setTimestamp(new Date(post.timestamp))
        .setFooter({ 
          text: `📸 New Instagram Post • ❤️ ${post.likes} 💬 ${post.comments}` 
        });

      let content = `📷 **${account.displayName}** posted on Instagram!`;
      if (process.env.NOTIFICATION_ROLE_ID) {
        content += ` <@&${process.env.NOTIFICATION_ROLE_ID}>`;
      }

      await channel.send({ content, embeds: [embed] });
      logger.info(`Announced Instagram post from ${account.displayName}`);

    } catch (error) {
      logger.error(`Error announcing Instagram post: ${error}`);
    }
  }
}