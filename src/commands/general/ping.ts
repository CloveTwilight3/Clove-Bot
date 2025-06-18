import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../interfaces/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong and latency information!'),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const sent = await interaction.reply({ 
      content: 'Pinging...', 
      fetchReply: true 
    });
    
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(interaction.client.ws.ping);
    
    await interaction.editReply(
      `🏓 Pong!\n📡 Latency: ${latency}ms\n💓 API Latency: ${apiLatency}ms`
    );
  },
  
  cooldown: 5
};

export default command;