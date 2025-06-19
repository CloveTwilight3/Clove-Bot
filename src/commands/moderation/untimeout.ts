import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  EmbedBuilder
} from 'discord.js';
import { Command } from '../../interfaces/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remove timeout from a user')
    .addUserOption(option =>
      option
        .setName('target')
        .setDescription('The user to remove timeout from')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for removing timeout')
        .setRequired(false)
    ),
  
  permissions: [PermissionFlagsBits.ModerateMembers],
  
  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('target', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    
    const member = interaction.guild?.members.cache.get(target.id);
    
    if (!member) {
      await interaction.reply({ 
        content: '❌ User not found in this server!', 
        ephemeral: true 
      });
      return;
    }
    
    if (!member.isCommunicationDisabled()) {
      await interaction.reply({
        content: '❌ This user is not timed out!',
        ephemeral: true
      });
      return;
    }
    
    try {
      // Remove timeout
      await member.timeout(null, `${reason} | Timeout removed by: ${interaction.user.tag}`);
      
      // Create success embed
      const untimeoutEmbed = new EmbedBuilder()
        .setTitle('✅ Timeout Removed')
        .addFields(
          { name: '👤 User', value: `${target.tag}`, inline: true },
          { name: '🆔 User ID', value: target.id, inline: true },
          { name: '👮 Moderator', value: `${interaction.user.tag}`, inline: true },
          { name: '📝 Reason', value: reason, inline: false }
        )
        .setColor(0x00ff00)
        .setTimestamp();
      
      await interaction.reply({ embeds: [untimeoutEmbed] });
      
    } catch (error) {
      console.error('Untimeout command error:', error);
      await interaction.reply({ 
        content: '❌ Failed to remove timeout from the user!', 
        ephemeral: true 
      });
    }
  }
};

export default command;