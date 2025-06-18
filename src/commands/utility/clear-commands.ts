// src/commands/utility/clear-commands.ts
import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits 
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { REST, Routes } from 'discord.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('clear-commands')
    .setDescription('Clear all bot commands (Owner only)')
    .addStringOption(option =>
      option
        .setName('scope')
        .setDescription('Clear scope')
        .setRequired(false)
        .addChoices(
          { name: 'Guild', value: 'guild' },
          { name: 'Global', value: 'global' }
        )
    ),
  
  permissions: [PermissionFlagsBits.Administrator],
  
  async execute(interaction: ChatInputCommandInteraction) {
    // Check if user is bot owner (replace with your user ID)
    const OWNER_ID = '1025770042245251122'; // Replace with your Discord user ID
    
    if (interaction.user.id !== OWNER_ID) {
      await interaction.reply({
        content: '❌ Only the bot owner can use this command.',
        ephemeral: true
      });
      return;
    }
    
    await interaction.deferReply({ ephemeral: true });
    
    try {
      const scope = interaction.options.getString('scope') || 'guild';
      const rest = new REST().setToken(process.env.DISCORD_TOKEN!);
      
      if (scope === 'guild' && process.env.GUILD_ID) {
        await rest.put(
          Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID),
          { body: [] }
        );
        
        await interaction.editReply('✅ Successfully cleared all guild commands.');
      } else {
        await rest.put(
          Routes.applicationCommands(process.env.CLIENT_ID!),
          { body: [] }
        );
        
        await interaction.editReply('✅ Successfully cleared all global commands.');
      }
      
    } catch (error) {
      console.error('Clear commands error:', error);
      await interaction.editReply('❌ Failed to clear commands. Check console for details.');
    }
  }
};

export default command;