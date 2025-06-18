import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { getNextTicketNumber } from '../../utils/ticketCounter';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Create a support ticket')
    .addStringOption(option =>
      option
        .setName('subject')
        .setDescription('Brief description of your issue')
        .setRequired(true)
        .setMaxLength(100)
    )
    .addStringOption(option =>
      option
        .setName('description')
        .setDescription('Detailed description of your issue')
        .setRequired(false)
        .setMaxLength(1000)
    )
    .addStringOption(option =>
      option
        .setName('priority')
        .setDescription('Priority level of your ticket')
        .setRequired(false)
        .addChoices(
          { name: 'Low', value: 'low' },
          { name: 'Medium', value: 'medium' },
          { name: 'High', value: 'high' },
          { name: 'Urgent', value: 'urgent' }
        )
    ),
  
  async execute(interaction: ChatInputCommandInteraction) {
    // Hardcoded channel ID - replace with your actual channel ID
    const TICKET_CHANNEL_ID = '1384831664349511710'; // Replace this with your channel ID
    
    const subject = interaction.options.getString('subject', true);
    const description = interaction.options.getString('description') || 'No additional details provided.';
    const priority = interaction.options.getString('priority') || 'medium';
    
    try {
      // Get the ticket channel
      const ticketChannel = await interaction.guild?.channels.fetch(TICKET_CHANNEL_ID);
      
      if (!ticketChannel || ticketChannel.type !== ChannelType.GuildText) {
        await interaction.reply({
          content: '❌ Ticket channel not found or is not a text channel!',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      
      // Generate sequential ticket number
      const ticketNumber = getNextTicketNumber();
      const ticketId = `#${ticketNumber}`;
      
      // Create thread with new naming format
      const thread = await ticketChannel.threads.create({
        name: `🎫 Ticket ${ticketId} - ${subject}`,
        autoArchiveDuration: 1440, // 24 hours
        type: ChannelType.PrivateThread,
        reason: `Support ticket created by ${interaction.user.tag}`
      });
      
      // Add the user to the thread
      await thread.members.add(interaction.user.id);
      
      // Create ticket embed with new ID format
      const ticketEmbed = new EmbedBuilder()
        .setTitle(`🎫 Support Ticket ${ticketId}`)
        .setDescription(`**Subject:** ${subject}\n**Description:** ${description}`)
        .addFields(
          { name: '🎟️ Ticket ID', value: ticketId, inline: true },
          { name: '👤 Created by', value: `${interaction.user}`, inline: true },
          { name: '📅 Created at', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
          { name: '⚡ Priority', value: priority.charAt(0).toUpperCase() + priority.slice(1), inline: true }
        )
        .setColor(getPriorityColor(priority))
        .setTimestamp()
        .setFooter({ text: 'Use the buttons below to manage this ticket' });
      
      // Create action buttons with new ticket ID format
      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket_claim_${ticketNumber}`)
            .setLabel('Claim Ticket')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('👋'),
          new ButtonBuilder()
            .setCustomId(`ticket_close_${ticketNumber}`)
            .setLabel('Close Ticket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒'),
          new ButtonBuilder()
            .setCustomId(`ticket_priority_${ticketNumber}`)
            .setLabel('Change Priority')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⚡')
        );
      
      // Send initial message to thread
      await thread.send({
        content: `${interaction.user} Welcome to your support ticket! <@&1384919535995457636> will be with you shortly.`,
        embeds: [ticketEmbed],
        components: [actionRow]
      });
      
      // Reply to the user
      await interaction.reply({
        content: `✅ Your ticket **${ticketId}** has been created! Please check ${thread} for updates.`,
        flags: MessageFlags.Ephemeral
      });
      
    } catch (error) {
      console.error('Error creating ticket:', error);
      await interaction.reply({
        content: '❌ There was an error creating your ticket. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};

function getPriorityColor(priority: string): number {
  switch (priority) {
    case 'low': return 0x00ff00;      // Green
    case 'medium': return 0xffff00;   // Yellow
    case 'high': return 0xff8800;     // Orange
    case 'urgent': return 0xff0000;   // Red
    default: return 0x0099ff;         // Blue
  }
}

export default command;