// src/commands/utility/deploy.ts
import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits 
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { REST, Routes } from 'discord.js';
import { loadCommands } from '../../handlers/commandHandler';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('deploy')
    .setDescription('Manually deploy/refresh bot commands (Owner only)')
    .addStringOption(option =>
      option
        .setName('scope')
        .setDescription('Deploy scope')
        .setRequired(false)
        .addChoices(
          { name: 'Guild (fast)', value: 'guild' },
          { name: 'Global (slow)', value: 'global' }
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
      const commands = await loadCommands();
      const commandData = commands.map((cmd: Command) => cmd.data.toJSON());
      
      const rest = new REST().setToken(process.env.DISCORD_TOKEN!);
      
      let data: any[];
      
      if (scope === 'guild' && process.env.GUILD_ID) {
        data = await rest.put(
          Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID),
          { body: commandData }
        ) as any[];
        
        await interaction.editReply(`✅ Successfully deployed ${data.length} commands to this guild.`);
      } else {
        data = await rest.put(
          Routes.applicationCommands(process.env.CLIENT_ID!),
          { body: commandData }
        ) as any[];
        
        await interaction.editReply(`✅ Successfully deployed ${data.length} commands globally. May take up to 1 hour to propagate.`);
      }
      
    } catch (error) {
      console.error('Deploy command error:', error);
      await interaction.editReply('❌ Failed to deploy commands. Check console for details.');
    }
  }
};

export default command;