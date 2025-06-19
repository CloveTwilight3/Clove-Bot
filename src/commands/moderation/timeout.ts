import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  EmbedBuilder
} from 'discord.js';
import { Command } from '../../interfaces/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a user')
    .addUserOption(option =>
      option
        .setName('target')
        .setDescription('The user to timeout')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('duration')
        .setDescription('Duration in minutes (1-2400 = 40 hours)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(2400)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for the timeout')
        .setRequired(false)
    ),
  
  permissions: [PermissionFlagsBits.ModerateMembers],
  
  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('target', true);
    const duration = interaction.options.getInteger('duration', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    
    const member = interaction.guild?.members.cache.get(target.id);
    
    if (!member) {
      await interaction.reply({ 
        content: '❌ User not found in this server!', 
        ephemeral: true 
      });
      return;
    }
    
    if (!member.moderatable) {
      await interaction.reply({ 
        content: '❌ I cannot timeout this user!', 
        ephemeral: true 
      });
      return;
    }
    
    // Check if user is trying to timeout themselves
    if (target.id === interaction.user.id) {
      await interaction.reply({
        content: '❌ You cannot timeout yourself!',
        ephemeral: true
      });
      return;
    }
    
    try {
      // Calculate timeout duration
      const timeoutDuration = duration * 60 * 1000; // Convert minutes to milliseconds
      const timeoutUntil = new Date(Date.now() + timeoutDuration);
      
      // Apply timeout
      await member.timeout(timeoutDuration, `${reason} | Timed out by: ${interaction.user.tag}`);
      
      // Create success embed
      const timeoutEmbed = new EmbedBuilder()
        .setTitle('⏰ User Timed Out')
        .addFields(
          { name: '👤 User', value: `${target.tag}`, inline: true },
          { name: '🆔 User ID', value: target.id, inline: true },
          { name: '👮 Moderator', value: `${interaction.user.tag}`, inline: true },
          { name: '⏱️ Duration', value: `${duration} minute(s)`, inline: true },
          { name: '⏰ Until', value: `<t:${Math.floor(timeoutUntil.getTime() / 1000)}:F>`, inline: true },
          { name: '📝 Reason', value: reason, inline: false }
        )
        .setColor(0xffa500)
        .setTimestamp();
      
      await interaction.reply({ embeds: [timeoutEmbed] });
      
    } catch (error) {
      console.error('Timeout command error:', error);
      await interaction.reply({ 
        content: '❌ Failed to timeout the user!', 
        ephemeral: true 
      });
    }
  }
};

export default command;