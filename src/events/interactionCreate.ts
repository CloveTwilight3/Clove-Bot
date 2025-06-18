// Add these imports at the top
import { createTicketModal } from '../utils/ticketModal';
import { getNextTicketNumber } from '../utils/ticketCounter';

// Add this to the main execute function, right after the button interaction check:
    // Handle modal submissions
    if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction);
    }

// Add these new functions at the end of the file:

async function handleModalSubmit(interaction: any) {
  if (interaction.customId === 'ticket_creation_modal') {
    await handleTicketCreationModal(interaction);
  }
}

async function handleTicketCreationModal(interaction: any) {
  const TICKET_CHANNEL_ID = '1384831664349511710'; // Same as in ticket.ts
  
  const subject = interaction.fields.getTextInputValue('ticket_subject');
  const description = interaction.fields.getTextInputValue('ticket_description') || 'No additional details provided.';
  let priority = interaction.fields.getTextInputValue('ticket_priority') || 'medium';
  
  // Validate priority
  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  if (!validPriorities.includes(priority.toLowerCase())) {
    priority = 'medium';
  }
  priority = priority.toLowerCase();
  
  try {
    // Get the ticket channel
    const ticketChannel = await interaction.guild?.channels.fetch(TICKET_CHANNEL_ID);
    
    if (!ticketChannel || ticketChannel.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: '❌ Ticket channel not found or is not a text channel!',
        ephemeral: true
      });
      return;
    }
    
    // Check if user already has an open ticket
    const existingThreads = await ticketChannel.threads.fetch();
    const userHasTicket = existingThreads.threads.some(thread => 
      thread.name.includes(interaction.user.username) && !thread.archived
    );
    
    if (userHasTicket) {
      await interaction.reply({
        content: '❌ You already have an open ticket! Please close your existing ticket before creating a new one.',
        ephemeral: true
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
    
    // Create ticket embed
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
    
    // Create action buttons
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
      ephemeral: true
    });
    
  } catch (error) {
    console.error('Error creating ticket from modal:', error);
    await interaction.reply({
      content: '❌ There was an error creating your ticket. Please try again later.',
      ephemeral: true
    });
  }
}

// Update the existing handleButtonInteraction function to include the new button:
// Add this case to the existing handleButtonInteraction function:
  
  // Handle the persistent ticket creation button
  if (customId === 'create_ticket_button') {
    try {
      const modal = createTicketModal();
      await interaction.showModal(modal);
    } catch (error) {
      logger.error(`Error showing ticket modal: ${error}`);
      await interaction.reply({
        content: '❌ Failed to open ticket creation form. Please try again.',
        ephemeral: true
      });
    }
    return;
  }