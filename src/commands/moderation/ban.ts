import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  EmbedBuilder
} from 'discord.js';
import { Command } from '../../interfaces/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .addUserOption(option =>
      option
        .setName('target')
        .setDescription('The user to ban')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for the ban')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName('delete-days')
        .setDescription('Number of days of messages to delete (0-7)')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(7)
    ),
  
  permissions: [PermissionFlagsBits.BanMembers],
  
  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('target', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete-days') || 0;
    
    // Check if target is bannable
    const member = interaction.guild?.members.cache.get(target.id);
    
    if (member && !member.bannable) {
      await interaction.reply({ 
        content: '❌ I cannot ban this user!', 
        ephemeral: true 
      });
      return;
    }
    
    // Check if user is trying to ban themselves
    if (target.id === interaction.user.id) {
      await interaction.reply({
        content: '❌ You cannot ban yourself!',
        ephemeral: true
      });
      return;
    }
    
    // Check if user is trying to ban the bot
    if (target.id === interaction.client.user.id) {
      await interaction.reply({
        content: '❌ I cannot ban myself!',
        ephemeral: true
      });
      return;
    }
    
    try {
      // Ban the user
      await interaction.guild?.members.ban(target, {
        reason: `${reason} | Banned by: ${interaction.user.tag}`,
        deleteMessageSeconds: deleteDays * 24 * 60 * 60 // Convert days to seconds
      });
      
      // Create success embed
      const banEmbed = new EmbedBuilder()
        .setTitle('🔨 User Banned')
        .addFields(
          { name: '👤 User', value: `${target.tag}`, inline: true },
          { name: '🆔 User ID', value: target.id, inline: true },
          { name: '👮 Moderator', value: `${interaction.user.tag}`, inline: true },
          { name: '📝 Reason', value: reason, inline: false },
          { name: '🗑️ Messages Deleted', value: `${deleteDays} day(s)`, inline: true }
        )
        .setColor(0xff0000)
        .setTimestamp();
      
      await interaction.reply({ embeds: [banEmbed] });
      
    } catch (error) {
      console.error('Ban command error:', error);
      await interaction.reply({ 
        content: '❌ Failed to ban the user!', 
        ephemeral: true 
      });
    }
  }
};

export default command;