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
  ThreadChannel
} from 'discord.js';
import { Command } from '../interfaces/Command';
import { logger } from '../utils/logger';

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
          ephemeral: true
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
          ephemeral: true
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
      ephemeral: true
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
          ephemeral: true
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
          ephemeral: true
        });
      }
    }
  }
}

async function handleTicketClaim(interaction: any, ticketId: string) {
  // Check if user has manage threads permission
  if (!interaction.member?.permissions.has(PermissionFlagsBits.ManageThreads)) {
    await interaction.reply({
      content: '❌ You need the "Manage Threads" permission to claim tickets.',
      ephemeral: true
    });
    return;
  }
  
  const channel = interaction.channel;
  
  // Type guard to ensure we're in a thread channel
  if (!channel || !channel.isThread()) {
    await interaction.reply({
      content: '❌ This command can only be used in ticket threads.',
      ephemeral: true
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
      ephemeral: true
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
        ephemeral: true
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
        msg.components.length > 0
      );
      
      if (ticketMessage) {
        await ticketMessage.edit({
          embeds: ticketMessage.embeds,
          components: [] // Remove all buttons
        });
        logger.info(`Removed buttons from ticket ${ticketId} message`);
      }
    } catch (editError) {
      logger.warn(`Could not edit original ticket message: ${editError}`);
      // Don't throw here, continue with closing
    }
    
    // Update thread name and archive after a delay
    setTimeout(async () => {
      try {
        const closedName = thread.name.replace(/[🎫🔧🟢🟡🟠🔴]/, '🔒');
        await thread.setName(closedName);
        await thread.setLocked(true);
        await thread.setArchived(true);
        logger.info(`Ticket ${ticketId} closed and archived by ${interaction.user.tag}`);
      } catch (archiveError) {
        logger.error(`Error archiving ticket ${ticketId}: ${archiveError}`);
      }
    }, 3000); // 3 second delay
    
  } catch (error) {
    logger.error(`Error in handleTicketClose: ${error}`);
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Failed to close ticket. Please try again.',
        ephemeral: true
      });
    } else if (interaction.deferred) {
      await interaction.editReply({
        content: '❌ Failed to close ticket. Please try again.'
      });
    }
  }
}

async function handlePriorityChange(interaction: any, ticketId: string) {
  // Check if user has manage threads permission
  if (!interaction.member?.permissions.has(PermissionFlagsBits.ManageThreads)) {
    await interaction.reply({
      content: '❌ You need the "Manage Threads" permission to change ticket priority.',
      ephemeral: true
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
    ephemeral: true
  });
}

async function handlePrioritySet(interaction: any, priority: string, ticketId: string) {
  const channel = interaction.channel;
  
  // Type guard to ensure we're in a thread channel
  if (!channel || !channel.isThread()) {
    await interaction.reply({
      content: '❌ This command can only be used in ticket threads.',
      ephemeral: true
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