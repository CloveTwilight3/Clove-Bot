// src/commands/general/help.ts (update the existing file)
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../interfaces/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Shows all available commands'),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle('🤖 Bot Commands')
      .setDescription('Here are all the available commands:')
      .addFields(
        { name: '**General Commands**', value: '\u200b', inline: false },
        { name: '/ping', value: 'Check bot latency', inline: true },
        { name: '/help', value: 'Show this help message', inline: true },
        { name: '\u200b', value: '\u200b', inline: true },
        { name: '**Support Commands**', value: '\u200b', inline: false },
        { name: '/ticket', value: 'Create a support ticket (gets auto-numbered)', inline: true },
        { name: '\u200b', value: '\u200b', inline: true },
        { name: '\u200b', value: '\u200b', inline: true },
        { name: '**Social Media Commands (Admin)**', value: '\u200b', inline: false },
        { name: '/social-accounts', value: 'Manage YouTube/Bluesky/Instagram monitoring', inline: true },
        { name: '/social-status', value: 'Check monitoring status', inline: true },
        { name: '/bluesky', value: 'Manage Bluesky integration', inline: true },
        { name: '**Moderation Commands**', value: '\u200b', inline: false },
        { name: '/kick', value: 'Kick a user (Moderator only)', inline: true },
        { name: '/ban', value: 'Ban a user (Moderator only)', inline: true },
        { name: '/timeout', value: 'Timeout a user (Moderator only)', inline: true },
        { name: '/untimeout', value: 'Remove timeout (Moderator only)', inline: true },
        { name: '/purge', value: 'Delete multiple messages (Moderator only)', inline: true },
        { name: '/tickets', value: 'Manage support tickets (Moderator only)', inline: true },
        { name: '/ticket-admin', value: 'Manage ticket numbering system (Admin only)', inline: true }
      )
      .setColor('#0099ff')
      .setTimestamp()
      .setFooter({ 
        text: 'Bot made with TypeScript & Discord.js v14 • Now with social media monitoring!' 
      });

    await interaction.reply({ embeds: [embed] });
  }
};

export default command;