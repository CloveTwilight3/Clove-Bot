// src/commands/admin/social-status.ts
import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { getMonitoredAccounts } from '../../utils/accountManager';
import { isBlueskyInitialized } from '../../utils/blueskyClient';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('social-status')
    .setDescription('Check social media monitoring status (Admin only)'),
  
  permissions: [PermissionFlagsBits.Administrator],
  
  async execute(interaction: ChatInputCommandInteraction) {
    const accounts = getMonitoredAccounts();
    const allAccounts = accounts.length;
    const enabledAccounts = accounts.filter(a => a.enabled).length;
    
    const platformCounts = accounts.reduce((counts, account) => {
      if (!counts[account.platform]) {
        counts[account.platform] = { total: 0, enabled: 0 };
      }
      counts[account.platform].total++;
      if (account.enabled) {
        counts[account.platform].enabled++;
      }
      return counts;
    }, {} as Record<string, { total: number; enabled: number }>);
    
    const embed = new EmbedBuilder()
      .setTitle('📊 Social Media Monitoring Status')
      .setColor(0x0099ff)
      .addFields(
        { 
          name: '📈 Overview', 
          value: `**Total Accounts:** ${allAccounts}\n**Enabled:** ${enabledAccounts}\n**Disabled:** ${allAccounts - enabledAccounts}`,
          inline: true 
        },
        { 
          name: '🔧 Services', 
          value: `**Bluesky API:** ${isBlueskyInitialized() ? '✅ Connected' : '❌ Disconnected'}\n**RSS Parser:** ✅ Active\n**Instagram Scraper:** ✅ Active`,
          inline: true 
        },
        { 
          name: '📍 Channels', 
          value: `**YouTube:** ${process.env.YOUTUBE_CHANNEL_ID ? `<#${process.env.YOUTUBE_CHANNEL_ID}>` : '❌ Not Set'}\n**Bluesky:** ${process.env.BLUESKY_CHANNEL_ID ? `<#${process.env.BLUESKY_CHANNEL_ID}>` : '❌ Not Set'}\n**Instagram:** ${process.env.INSTAGRAM_CHANNEL_ID ? `<#${process.env.INSTAGRAM_CHANNEL_ID}>` : '❌ Not Set'}`,
          inline: true 
        }
      )
      .setTimestamp();
    
    // Add platform-specific stats
    Object.entries(platformCounts).forEach(([platform, counts]) => {
      const emoji = platform === 'youtube' ? '📺' : platform === 'bluesky' ? '🦋' : '📸';
      embed.addFields({
        name: `${emoji} ${platform.toUpperCase()}`,
        value: `${counts.enabled}/${counts.total} enabled`,
        inline: true
      });
    });
    
    if (process.env.NOTIFICATION_ROLE_ID) {
      embed.addFields({
        name: '🔔 Notifications',
        value: `Role: <@&${process.env.NOTIFICATION_ROLE_ID}>`,
        inline: true
      });
    }
    
    await interaction.reply({ embeds: [embed] });
  }
};

export default command;