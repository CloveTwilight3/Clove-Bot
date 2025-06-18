import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits
  // Remove GuildMember import since it's not used
} from 'discord.js';
import { Command } from '../../interfaces/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .addUserOption(option =>
      option
        .setName('target')
        .setDescription('The user to kick')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for the kick')
        .setRequired(false)
    ),
  
  permissions: [PermissionFlagsBits.KickMembers],
  
  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('target', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    
    const member = interaction.guild?.members.cache.get(target.id);
    
    if (!member) {
      await interaction.reply({ 
        content: 'User not found in this server!', 
        ephemeral: true 
      });
      return;
    }
    
    if (!member.kickable) {
      await interaction.reply({ 
        content: 'I cannot kick this user!', 
        ephemeral: true 
      });
      return;
    }
    
    try {
      await member.kick(reason);
      await interaction.reply(`✅ Successfully kicked ${target.tag} for: ${reason}`);
    } catch (error) {
      await interaction.reply({ 
        content: 'Failed to kick the user!', 
        ephemeral: true 
      });
    }
  }
};

export default command;