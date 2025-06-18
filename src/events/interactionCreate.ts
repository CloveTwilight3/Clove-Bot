import { 
  Events, 
  Interaction, 
  Collection, 
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ThreadChannel,
  ChannelType,
  MessageFlags
} from 'discord.js';
import { Command } from '../interfaces/Command';
import { logger } from '../utils/logger';
import { createTicketModal } from '../utils/ticketModal';
import { getNextTicketNumber } from '../utils/ticketCounter';

// Cooldown management
const cooldowns = new Collection<string, Collection<string, number>>();

export default {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
    }
    
    // Handle button interactions
    if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    }
    
    // Handle modal submissions
    if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction);
    }
  }
};

async function handleSlashCommand(interaction: any) {
  const client = interaction.client as any;
  const command: Command = client.commands?.get(interaction.commandName);

  if (!command) {
    logger.error(`Command ${interaction.commandName} not found`);
    return;
  }

  // Check permissions
  if (command.permissions && interaction.inGuild() && interaction.member) {
    const memberPermissions = interaction.member.permissions;
    
    if (memberPermissions instanceof PermissionsBitField) {
      const hasPermission = command.permissions.every(permission =>
        memberPermissions.has(permission)
      );
      
      if (!hasPermission) {
        await interaction.reply({
          content: '❌ You don\'t have permission to use this command!',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
    }
  }

  // Handle cooldowns
  if (command.cooldown) {
    if (!cooldowns.has(command.data.name)) {
      cooldowns.set(command.data.name, new Collection());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(command.data.name)!;
    const cooldownAmount = command.cooldown * 1000;

    if (timestamps.has(interaction.user.id)) {
      const expirationTime = timestamps.get(interaction.user.id)! + cooldownAmount;

      if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 1000;
        await interaction.reply({
          content: `⏰ Please wait ${timeLeft.toFixed(1)} seconds before using this command again.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
  }

  // Execute command
  try {
    await command.execute(interaction);
    logger.info(`Command ${interaction.commandName} executed by ${interaction.user.tag}`);
  } catch (error) {
    logger.error(`Error executing command ${interaction.commandName}: ${error}`);
    
    const errorMessage = {
      content: '❌ There was an error executing this command!',
      flags: MessageFlags.Ephemeral
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
}

async function handleButtonInteraction(interaction: any) {
  const customId = interaction.customId;
  
  // Handle the persistent ticket creation button
  if (customId === 'create_ticket_button') {
    try {
      const modal = createTicketModal();
      await interaction.showModal(modal);
    } catch (error) {
      logger.error(`Error showing ticket modal: ${error}`);
      await interaction.reply({
        content: '❌ Failed to open ticket creation form. Please try again.',
        flags: MessageFlags.Ephemeral
      });
    }
    return;
  }
  
  // Handle ticket buttons
  if (customId.startsWith('ticket_')) {
    const [action, type, ticketId] = customId.split('_');
    
    try {
      switch (type) {
        case 'claim':
          await handleTicketClaim(interaction, ticketId);
          break;
        case 'close':
          await handleTicketClose(interaction, ticketId);
          break;
        case 'priority':
          await handlePriorityChange(interaction, ticketId);
          break;
      }
    } catch (error) {
      logger.error(`Error handling ticket button interaction: ${error}`);
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred while processing your request.',
          flags: MessageFlags.Ephemeral
        });
      }
    }
  }
  
  // Handle priority buttons
  if (customId.startsWith('priority_set_')) {
    const [action, type, priority, ticketId] = customId.split('_');
    
    try {
      await handlePrioritySet(interaction, priority, ticketId);
    } catch (error) {
      logger.error(`Error updating ticket priority: ${error}`);
      
      if (!interaction.replied) {
        await interaction.reply({
          content: '❌ Failed to update priority.',
          flags: MessageFlags.Ephemeral
        });
      }
    }
  }
}

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
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    // Check if user already has an open ticket
    const existingThreads = await ticketChannel.threads.fetch();
    const userHasTicket = existingThreads.threads.some((thread: any) => 
      thread.name.includes(interaction.user.username) && !thread.archived
    );
    
    if (userHasTicket) {
      await interaction.reply({
        content: '❌ You already have an open ticket! Please close your existing ticket before creating a new one.',
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
      flags: MessageFlags.Ephemeral
    });
    
  } catch (error) {
    console.error('Error creating ticket from modal:', error);
    await interaction.reply({
      content: '❌ There was an error creating your ticket. Please try again later.',
      flags: MessageFlags.Ephemeral
    });
  }
}

async function handleTicketClaim(interaction: any, ticketId: string) {
  // Check if user has manage threads permission
  if (!interaction.member?.permissions.has(PermissionFlagsBits.ManageThreads)) {
    await interaction.reply({
      content: '❌ You need the "Manage Threads" permission to claim tickets.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  const channel = interaction.channel;
  
  // Type guard to ensure we're in a thread channel
  if (!channel || !channel.isThread()) {
    await interaction.reply({
      content: '❌ This command can only be used in ticket threads.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  const thread = channel as ThreadChannel;
  
  // Create claimed embed
  const claimedEmbed = new EmbedBuilder()
    .setTitle('🎫 Ticket Claimed')
    .setDescription(`This ticket has been claimed by ${interaction.user}`)
    .setColor(0x00ff00)
    .setTimestamp();
  
  // Update thread name to show it's claimed
  const currentName = thread.name;
  if (!currentName.includes('🔧')) {
    await thread.setName(`🔧 ${currentName.replace('🎫', '')}`);
  }
  
  await interaction.reply({
    embeds: [claimedEmbed]
  });
  
  logger.info(`Ticket ${ticketId} claimed by ${interaction.user.tag}`);
}

async function handleTicketClose(interaction: any, ticketId: string) {
  const channel = interaction.channel;
  
  // Type guard to ensure we're in a thread channel
  if (!channel || !channel.isThread()) {
    await interaction.reply({
      content: '❌ This command can only be used in ticket threads.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  const thread = channel as ThreadChannel;
  
  try {
    // Check if user has manage threads permission or is the ticket creator
    const starterMessage = await thread.fetchStarterMessage();
    const isCreator = starterMessage?.mentions.users.has(interaction.user.id);
    const hasPermission = interaction.member?.permissions.has(PermissionFlagsBits.ManageThreads);
    
    if (!hasPermission && !isCreator) {
      await interaction.reply({
        content: '❌ You can only close your own tickets or need "Manage Threads" permission.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    // Create closed embed
    const closedEmbed = new EmbedBuilder()
      .setTitle('🔒 Ticket Closed')
      .setDescription(`This ticket has been closed by ${interaction.user}`)
      .addFields(
        { name: '📅 Closed at', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
      )
      .setColor(0xff0000)
      .setTimestamp();
    
    // Acknowledge the interaction immediately
    await interaction.deferReply();
    
    // Send the close message
    await interaction.editReply({
      embeds: [closedEmbed]
    });
    
    // Try to find and edit the original ticket message to remove buttons
    try {
      const messages = await thread.messages.fetch({ limit: 20 });
      const ticketMessage = messages.find(msg => 
        msg.author.id === interaction.client.user.id &&
        msg.embeds.length > 0 && 
        msg.embeds[0].title?.includes('Support Ticket') &&
        msg.components && msg.components.length > 0
      );
      
      if (ticketMessage && ticketMessage.editable) {
        await ticketMessage.edit({
          embeds: ticketMessage.embeds,
          components: [] // Remove all buttons
        });
        logger.info(`Removed buttons from ticket ${ticketId} message`);
      } else {
        logger.warn(`Could not find editable ticket message for ticket ${ticketId}`);
      }
    } catch (editError: any) {
      // Log the specific error but don't fail the close operation
      if (editError.code === 10008) {
        logger.warn(`Original ticket message not found for ticket ${ticketId} (already deleted or moved)`);
      } else {
        logger.warn(`Could not edit original ticket message for ticket ${ticketId}: ${editError.message}`);
      }
    }
    
    // Update thread name and archive after a delay
    setTimeout(async () => {
      try {
        // Update thread name to show it's closed
        const closedName = thread.name.replace(/[🎫🔧🟢🟡🟠🔴]/, '🔒');
        if (thread.name !== closedName) {
          await thread.setName(closedName);
        }
        
        // Lock and archive the thread
        if (!thread.locked) {
          await thread.setLocked(true);
        }
        
        if (!thread.archived) {
          await thread.setArchived(true);
        }
        
        logger.info(`Ticket ${ticketId} closed and archived by ${interaction.user.tag}`);
      } catch (archiveError: any) {
        logger.error(`Error archiving ticket ${ticketId}: ${archiveError.message}`);
        
        // If we can't archive, at least try to update the name
        try {
          if (!thread.archived) {
            const closedName = thread.name.replace(/[🎫🔧🟢🟡🟠🔴]/, '🔒');
            if (thread.name !== closedName) {
              await thread.setName(closedName);
            }
          }
        } catch (nameError: any) {
          logger.error(`Error updating ticket ${ticketId} name: ${nameError.message}`);
        }
      }
    }, 3000); // 3 second delay
    
  } catch (error: any) {
    logger.error(`Error in handleTicketClose for ticket ${ticketId}: ${error.message}`);
    
    const errorContent = '❌ Failed to close ticket. Please try again.';
    
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: errorContent,
          flags: MessageFlags.Ephemeral
        });
      } else if (interaction.deferred) {
        await interaction.editReply({
          content: errorContent
        });
      }
    } catch (replyError: any) {
      logger.error(`Error sending error message for ticket ${ticketId}: ${replyError.message}`);
    }
  }
}

async function handlePriorityChange(interaction: any, ticketId: string) {
  // Check if user has manage threads permission
  if (!interaction.member?.permissions.has(PermissionFlagsBits.ManageThreads)) {
    await interaction.reply({
      content: '❌ You need the "Manage Threads" permission to change ticket priority.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Create priority selection buttons
  const priorityRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`priority_set_low_${ticketId}`)
        .setLabel('Low')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`priority_set_medium_${ticketId}`)
        .setLabel('Medium')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`priority_set_high_${ticketId}`)
        .setLabel('High')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`priority_set_urgent_${ticketId}`)
        .setLabel('Urgent')
        .setStyle(ButtonStyle.Danger)
    );
  
  await interaction.reply({
    content: '⚡ Select the new priority level:',
    components: [priorityRow],
    flags: MessageFlags.Ephemeral
  });
}

async function handlePrioritySet(interaction: any, priority: string, ticketId: string) {
  const channel = interaction.channel;
  
  // Type guard to ensure we're in a thread channel
  if (!channel || !channel.isThread()) {
    await interaction.reply({
      content: '❌ This command can only be used in ticket threads.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  const thread = channel as ThreadChannel;
  
  // Update thread name with new priority indicator
  const currentName = thread.name;
  const priorityEmojis = {
    low: '🟢',
    medium: '🟡', 
    high: '🟠',
    urgent: '🔴'
  };
  
  // Remove old priority emoji and add new one
  let newName = currentName.replace(/[🟢🟡🟠🔴]/, '');
  newName = `${priorityEmojis[priority as keyof typeof priorityEmojis]} ${newName}`;
  
  await thread.setName(newName);
  
  // Create priority update embed
  const priorityEmbed = new EmbedBuilder()
    .setTitle('⚡ Priority Updated')
    .setDescription(`Ticket priority changed to **${priority.charAt(0).toUpperCase() + priority.slice(1)}** by ${interaction.user}`)
    .setColor(getPriorityColor(priority))
    .setTimestamp();
  
  await interaction.update({
    content: `✅ Priority updated to **${priority.charAt(0).toUpperCase() + priority.slice(1)}**`,
    components: []
  });
  
  // Send update to thread
  await thread.send({ embeds: [priorityEmbed] });
  
  logger.info(`Ticket ${ticketId} priority changed to ${priority} by ${interaction.user.tag}`);
}

function getPriorityColor(priority: string): number {
  switch (priority) {
    case 'low': return 0x00ff00;      // Green
    case 'medium': return 0xffff00;   // Yellow  
    case 'high': return 0xff8800;     // Orange
    case 'urgent': return 0xff0000;   // Red
    default: return 0x0099ff;         // Blue
  }
}