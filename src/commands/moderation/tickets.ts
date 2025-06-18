import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType
} from 'discord.js';
import { Command } from '../../interfaces/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('tickets')
    .setDescription('Manage support tickets')
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all active tickets')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('close-all')
        .setDescription('Close all archived tickets (cleanup)')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('Show ticket statistics')
    ),
  
  permissions: [PermissionFlagsBits.ManageThreads],
  
  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    
    // Hardcoded channel ID - same as in ticket.ts
    const TICKET_CHANNEL_ID = '1384831664349511710'; // Replace this with your channel ID
    
    try {
      const ticketChannel = await interaction.guild?.channels.fetch(TICKET_CHANNEL_ID);
      
      if (!ticketChannel || ticketChannel.type !== ChannelType.GuildText) {
        await interaction.reply({
          content: '❌ Ticket channel not found!',
          ephemeral: true
        });
        return;
      }
      
      switch (subcommand) {
        case 'list':
          await handleListTickets(interaction, ticketChannel);
          break;
        case 'close-all':
          await handleCloseAllTickets(interaction, ticketChannel);
          break;
        case 'stats':
          await handleTicketStats(interaction, ticketChannel);
          break;
      }
      
    } catch (error) {
      console.error('Error in tickets command:', error);
      await interaction.reply({
        content: '❌ An error occurred while processing the command.',
        ephemeral: true
      });
    }
  }
};

async function handleListTickets(interaction: any, channel: any) {
  await interaction.deferReply();
  
  const threads = await channel.threads.fetch();
  const activeTickets = threads.threads.filter((thread: any) => 
    thread.name.includes('🎫') || thread.name.includes('🔧') || thread.name.includes('🟢') || 
    thread.name.includes('🟡') || thread.name.includes('🟠') || thread.name.includes('🔴')
  );
  
  if (activeTickets.size === 0) {
    await interaction.editReply('📋 No active tickets found.');
    return;
  }
  
  const embed = new EmbedBuilder()
    .setTitle('🎫 Active Tickets')
    .setDescription(`Found ${activeTickets.size} active ticket(s)`)
    .setColor(0x0099ff)
    .setTimestamp();
  
  activeTickets.forEach((thread: any) => {
    const status = thread.name.includes('🔧') ? 'Claimed' : 'Open';
    embed.addFields({
      name: thread.name,
      value: `Status: ${status}\nID: ${thread.id}`,
      inline: true
    });
  });
  
  await interaction.editReply({ embeds: [embed] });
}

async function handleCloseAllTickets(interaction: any, channel: any) {
  await interaction.deferReply();
  
  const threads = await channel.threads.fetch({ archived: { type: 'private' } });
  const archivedTickets = threads.threads.filter((thread: any) => 
    thread.archived && (thread.name.includes('🎫') || thread.name.includes('🔧'))
  );
  
  let closedCount = 0;
  for (const [, thread] of archivedTickets) {
    try {
      await thread.delete();
      closedCount++;
    } catch (error) {
      console.error(`Failed to delete thread ${thread.id}:`, error);
    }
  }
  
  await interaction.editReply(`✅ Cleaned up ${closedCount} archived tickets.`);
}

async function handleTicketStats(interaction: any, channel: any) {
  await interaction.deferReply();
  
  const threads = await channel.threads.fetch();
  const archivedThreads = await channel.threads.fetch({ archived: { type: 'private' } });
  
  const activeTickets = threads.threads.filter((thread: any) => 
    thread.name.includes('🎫') || thread.name.includes('🔧')
  );
  
  const totalTickets = activeTickets.size + archivedThreads.threads.size;
  const claimedTickets = activeTickets.filter((thread: any) => thread.name.includes('🔧')).size;
  const openTickets = activeTickets.size - claimedTickets;
  
  const embed = new EmbedBuilder()
    .setTitle('📊 Ticket Statistics')
    .addFields(
      { name: '🎫 Total Tickets', value: totalTickets.toString(), inline: true },
      { name: '📂 Open Tickets', value: openTickets.toString(), inline: true },
      { name: '🔧 Claimed Tickets', value: claimedTickets.toString(), inline: true },
      { name: '📁 Archived Tickets', value: archivedThreads.threads.size.toString(), inline: true }
    )
    .setColor(0x0099ff)
    .setTimestamp();
  
  await interaction.editReply({ embeds: [embed] });
}

export default command;