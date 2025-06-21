// src/services/prideEventService.ts
import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import * as cron from 'node-cron';
import { 
  getEventsNeedingNotification, 
  getEventsNeedingReminder,
  markEventNotified,
  markEventReminded,
  getPrideColor,
  PrideEvent
} from '../utils/prideEventManager';
import { logger } from '../utils/logger';

export class PrideEventService {
  private client: Client;
  private cronJob: cron.ScheduledTask | null = null;

  constructor(client: Client) {
    this.client = client;
  }

  start(): void {
    // Check for pride events every 30 minutes
    this.cronJob = cron.schedule('*/30 * * * *', () => {
      this.checkPrideEvents();
    }, { scheduled: false });

    this.cronJob.start();
    logger.info('Pride Event Service started - checking every 30 minutes');
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Pride Event Service stopped');
    }
  }

  private async checkPrideEvents(): Promise<void> {
    try {
      // Check for events needing 24h reminders
      const eventsNeedingReminder = getEventsNeedingReminder();
      for (const event of eventsNeedingReminder) {
        await this.sendEventReminder(event);
        markEventReminded(event.id);
      }

      // Check for events needing immediate notifications
      const eventsNeedingNotification = getEventsNeedingNotification();
      for (const event of eventsNeedingNotification) {
        await this.sendEventNotification(event);
        markEventNotified(event.id);
      }

    } catch (error) {
      logger.error(`Error checking pride events: ${error}`);
    }
  }

  private async sendEventReminder(event: PrideEvent): Promise<void> {
    try {
      const channelId = process.env.PRIDE_CHANNEL_ID || process.env.YOUTUBE_CHANNEL_ID; // Fallback to general announcements
      if (!channelId) {
        logger.warn('No PRIDE_CHANNEL_ID set for pride event reminders');
        return;
      }

      const channel = await this.client.channels.fetch(channelId) as TextChannel;
      if (!channel?.isTextBased()) {
        logger.error('Pride announcement channel not found or not a text channel');
        return;
      }

      const eventDate = new Date(event.date);
      
      const embed = new EmbedBuilder()
        .setTitle('🏳️‍🌈 Pride Event Reminder!')
        .setDescription(`**${event.title}** is coming up tomorrow!`)
        .addFields(
          { name: '📝 Description', value: event.description, inline: false },
          { name: '🗓️ When', value: `<t:${Math.floor(eventDate.getTime() / 1000)}:F>`, inline: true },
          { name: '⏰ Time Until Event', value: `<t:${Math.floor(eventDate.getTime() / 1000)}:R>`, inline: true }
        )
        .setColor(getPrideColor(event.tags))
        .setFooter({ text: '🏳️‍🌈 24 Hour Reminder' })
        .setTimestamp();

      if (event.location) {
        embed.addFields({ name: '📍 Location', value: event.location, inline: true });
      }

      if (event.organizer) {
        embed.addFields({ name: '👥 Organizer', value: event.organizer, inline: true });
      }

      if (event.url) {
        embed.addFields({ name: '🔗 More Info', value: event.url, inline: false });
      }

      if (event.tags.length > 0) {
        embed.addFields({ name: '🏷️ Tags', value: event.tags.join(', '), inline: true });
      }

      let content = `🏳️‍🌈 **Pride Event Reminder!** Don't forget about **${event.title}** tomorrow!`;
      
      // Add role ping if configured
      if (process.env.PRIDE_ROLE_ID) {
        content += ` <@&${process.env.PRIDE_ROLE_ID}>`;
      }

      await channel.send({ 
        content, 
        embeds: [embed],
        allowedMentions: {
          roles: process.env.PRIDE_ROLE_ID ? [process.env.PRIDE_ROLE_ID] : []
        }
      });
      
      logger.info(`Sent 24h reminder for pride event: ${event.title}`);

    } catch (error) {
      logger.error(`Error sending pride event reminder: ${error}`);
    }
  }

  private async sendEventNotification(event: PrideEvent): Promise<void> {
    try {
      const channelId = process.env.PRIDE_CHANNEL_ID || process.env.YOUTUBE_CHANNEL_ID; // Fallback to general announcements
      if (!channelId) {
        logger.warn('No PRIDE_CHANNEL_ID set for pride event notifications');
        return;
      }

      const channel = await this.client.channels.fetch(channelId) as TextChannel;
      if (!channel?.isTextBased()) {
        logger.error('Pride announcement channel not found or not a text channel');
        return;
      }

      const eventDate = new Date(event.date);
      
      const embed = new EmbedBuilder()
        .setTitle('🏳️‍🌈 Pride Event Starting Soon!')
        .setDescription(`**${event.title}** is starting soon!`)
        .addFields(
          { name: '📝 Description', value: event.description, inline: false },
          { name: '🗓️ When', value: `<t:${Math.floor(eventDate.getTime() / 1000)}:F>`, inline: true },
          { name: '⏰ Starting', value: `<t:${Math.floor(eventDate.getTime() / 1000)}:R>`, inline: true }
        )
        .setColor(getPrideColor(event.tags))
        .setFooter({ text: '🏳️‍🌈 Starting Soon!' })
        .setTimestamp();

      if (event.location) {
        embed.addFields({ name: '📍 Location', value: event.location, inline: true });
      }

      if (event.organizer) {
        embed.addFields({ name: '👥 Organizer', value: event.organizer, inline: true });
      }

      if (event.url) {
        embed.addFields({ name: '🔗 More Info', value: event.url, inline: false });
      }

      if (event.tags.length > 0) {
        embed.addFields({ name: '🏷️ Tags', value: event.tags.join(', '), inline: true });
      }

      let content = `🏳️‍🌈 **Pride Event Alert!** **${event.title}** is starting soon!`;
      
      // Add role ping if configured
      if (process.env.PRIDE_ROLE_ID) {
        content += ` <@&${process.env.PRIDE_ROLE_ID}>`;
      }

      await channel.send({ 
        content, 
        embeds: [embed],
        allowedMentions: {
          roles: process.env.PRIDE_ROLE_ID ? [process.env.PRIDE_ROLE_ID] : []
        }
      });
      
      logger.info(`Sent notification for pride event: ${event.title}`);

    } catch (error) {
      logger.error(`Error sending pride event notification: ${error}`);
    }
  }

  // Manual trigger for testing
  async triggerEventCheck(): Promise<void> {
    logger.info('Manually triggering pride event check...');
    await this.checkPrideEvents();
  }
}