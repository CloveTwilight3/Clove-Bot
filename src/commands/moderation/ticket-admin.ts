import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { 
  getCurrentTicketCount, 
  resetTicketCounter, 
  getTicketStats 
} from '../../utils/ticketCounter';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ticket-admin')
    .setDescription('Manage ticket system (Admin only)')
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('Show ticket counter statistics')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('reset-counter')
        .setDescription('Reset the ticket counter to 0')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('current-count')
        .setDescription('Show current ticket count')
    ),
  
  permissions: [PermissionFlagsBits.Administrator],
  
  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    
    try {
      switch (subcommand) {
        case 'stats':
          await handleStats(interaction);
          break;
        case 'reset-counter':
          await handleResetCounter(interaction);
          break;
        case 'current-count':
          await handleCurrentCount(interaction);
          break;
      }
    } catch (error) {
      console.error('Error in ticket-admin command:', error);
      await interaction.reply({
        content: '❌ An error occurred while processing the command.',
        ephemeral: true
      });
    }
  }
};

async function handleStats(interaction: ChatInputCommandInteraction) {
  const stats = getTicketStats();
  
  const embed = new EmbedBuilder()
    .setTitle('🎫 Ticket System Statistics')
    .addFields(
      { name: '📊 Total Tickets Created', value: stats.counter.toString(), inline: true },
      { name: '🔄 Last Counter Reset', value: `<t:${Math.floor(new Date(stats.lastReset).getTime() / 1000)}:F>`, inline: true },
      { name: '🆔 Next Ticket Number', value: `#${(stats.counter + 1).toString().padStart(3, '0')}`, inline: true }
    )
    .setColor(0x0099ff)
    .setTimestamp();
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleResetCounter(interaction: ChatInputCommandInteraction) {
  resetTicketCounter();
  
  const embed = new EmbedBuilder()
    .setTitle('🔄 Ticket Counter Reset')
    .setDescription('The ticket counter has been reset to 0. The next ticket will be #001.')
    .setColor(0xff8800)
    .setTimestamp();
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleCurrentCount(interaction: ChatInputCommandInteraction) {
  const count = getCurrentTicketCount();
  
  await interaction.reply({
    content: `📊 Current ticket count: **${count}**\n🆔 Next ticket number: **#${(count + 1).toString().padStart(3, '0')}**`,
    ephemeral: true
  });
}

export default command;