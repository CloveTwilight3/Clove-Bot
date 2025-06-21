// src/services/socialMonitor.ts - Updated version
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
  private lastCheckedPosts: Map<string, string> = new Map(); // Track last posts per account

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
        // Add delay between accounts to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
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
        // Add delay between accounts to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
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
        // Add delay between accounts to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (error) {
      logger.error(`Error checking Instagram accounts: ${error}`);
    }
  }

  private async checkYouTubeAccount(account: MonitoredAccount): Promise<void> {
    try {
      if (!account.rssUrl) {
        account.rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${account.identifier}`;
      }

      const parser = new Parser({
        timeout: 15000, // Increased timeout
        customFields: {
          item: ['media:thumbnail', 'yt:videoId', 'yt:channelId', 'published']
        }
      });

      logger.info(`Checking YouTube account: ${account.displayName}`);
      const feed = await parser.parseURL(account.rssUrl);
      
      if (!feed.items || feed.items.length === 0) {
        logger.warn(`No videos found for ${account.displayName}`);
        return;
      }

      const latestVideo = feed.items[0];
      const videoId = latestVideo['yt:videoId'] || latestVideo.guid;

      if (!videoId) {
        logger.warn(`No video ID found for latest video from ${account.displayName}`);
        return;
      }

      // Use in-memory tracking for immediate duplicates + persistent storage
      const memoryKey = `${account.id}_${videoId}`;
      if (this.lastCheckedPosts.has(memoryKey)) {
        logger.debug(`Already processed video ${videoId} for ${account.displayName} (memory check)`);
        return;
      }

      // Check against stored last post ID
      if (account.lastPostId === videoId) {
        logger.debug(`Already processed video ${videoId} for ${account.displayName} (storage check)`);
        this.lastCheckedPosts.set(memoryKey, videoId);
        return;
      }

      // Check video age (don't announce videos older than 1 hour)
      const videoDate = new Date(latestVideo.pubDate || latestVideo.published);
      const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000));
      
      if (videoDate < oneHourAgo && !account.lastPostId) {
        // This is likely an old video on first run
        logger.info(`Skipping old video from ${account.displayName}: ${latestVideo.title}`);
        updateAccountLastChecked(account.id, videoId);
        this.lastCheckedPosts.set(memoryKey, videoId);
        return;
      }

      logger.info(`New video detected from ${account.displayName}: ${latestVideo.title}`);
      
      // Announce the new video
      await this.announceYouTubeVideo(account, latestVideo);
      
      // Update tracking
      updateAccountLastChecked(account.id, videoId);
      this.lastCheckedPosts.set(memoryKey, videoId);

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

      // Use in-memory tracking for immediate duplicates
      const memoryKey = `${account.id}_${postId}`;
      if (this.lastCheckedPosts.has(memoryKey)) {
        return;
      }

      // Check if this is a new post
      if (account.lastPostId && postId === account.lastPostId) {
        this.lastCheckedPosts.set(memoryKey, postId);
        return;
      }

      // Check post age (don't announce posts older than 1 hour on first run)
      const postDate = new Date(latestPost.post.record.createdAt);
      const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000));
      
      if (postDate < oneHourAgo && !account.lastPostId) {
        updateAccountLastChecked(account.id, postId);
        this.lastCheckedPosts.set(memoryKey, postId);
        return;
      }

      // Announce the new post
      await this.announceBlueskyPost(account, latestPost);
      
      // Update tracking
      updateAccountLastChecked(account.id, postId);
      this.lastCheckedPosts.set(memoryKey, postId);

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

      // Use in-memory tracking for immediate duplicates
      const memoryKey = `${account.id}_${latestPost.id}`;
      if (this.lastCheckedPosts.has(memoryKey)) {
        return;
      }

      // Check if this is a new post
      if (account.lastPostId && latestPost.id === account.lastPostId) {
        this.lastCheckedPosts.set(memoryKey, latestPost.id);
        return;
      }

      // Check post age (don't announce posts older than 1 hour on first run)
      const postDate = new Date(latestPost.timestamp);
      const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000));
      
      if (postDate < oneHourAgo && !account.lastPostId) {
        updateAccountLastChecked(account.id, latestPost.id);
        this.lastCheckedPosts.set(memoryKey, latestPost.id);
        return;
      }

      // Announce the new post
      await this.announceInstagramPost(account, latestPost);
      
      // Update tracking
      updateAccountLastChecked(account.id, latestPost.id);
      this.lastCheckedPosts.set(memoryKey, latestPost.id);

    } catch (error) {
      logger.error(`Error checking Instagram account ${account.displayName}: ${error}`);
    }
  }

  private async announceYouTubeVideo(account: MonitoredAccount, video: any): Promise<void> {
    try {
      const channelId = process.env.YOUTUBE_CHANNEL_ID;
      if (!channelId) {
        logger.warn('YOUTUBE_CHANNEL_ID not set in environment variables');
        return;
      }

      const channel = await this.client.channels.fetch(channelId) as TextChannel;
      if (!channel?.isTextBased()) {
        logger.error('YouTube announcement channel not found or not a text channel');
        return;
      }

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

      // Use allowedMentions to ensure role pings work
      await channel.send({ 
        content, 
        embeds: [embed],
        allowedMentions: {
          roles: process.env.NOTIFICATION_ROLE_ID ? [process.env.NOTIFICATION_ROLE_ID] : []
        }
      });
      
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

      await channel.send({ 
        content, 
        embeds: [embed],
        allowedMentions: {
          roles: process.env.NOTIFICATION_ROLE_ID ? [process.env.NOTIFICATION_ROLE_ID] : []
        }
      });
      
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

      await channel.send({ 
        content, 
        embeds: [embed],
        allowedMentions: {
          roles: process.env.NOTIFICATION_ROLE_ID ? [process.env.NOTIFICATION_ROLE_ID] : []
        }
      });
      
      logger.info(`Announced Instagram post from ${account.displayName}`);

    } catch (error) {
      logger.error(`Error announcing Instagram post: ${error}`);
    }
  }
}