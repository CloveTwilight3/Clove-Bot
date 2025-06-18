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
        { name: '/ping', value: 'Check bot latency', inline: true },
        { name: '/help', value: 'Show this help message', inline: true },
        { name: '/kick', value: 'Kick a user (Moderator only)', inline: true }
      )
      .setColor('#0099ff')
      .setTimestamp()
      .setFooter({ 
        text: 'Bot made with TypeScript & Discord.js v14' 
      });

    await interaction.reply({ embeds: [embed] });
  }
};

export default command;