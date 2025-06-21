// src/commands/admin/pride-events.ts
import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { 
  addPrideEvent, 
  removePrideEvent, 
  getAllPrideEvents, 
  getUpcomingPrideEvents,
  getPrideEventsByTag,
  updatePrideEvent,
  getPrideColor,
  PRIDE_COLORS 
} from '../../utils/prideEventManager';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('pride-events')
    .setDescription('Manage pride events and notifications (Admin only)')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a new pride event')
        .addStringOption(option =>
          option
            .setName('title')
            .setDescription('Event title')
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption(option =>
          option
            .setName('date')
            .setDescription('Event date and time (YYYY-MM-DD HH:MM or YYYY-MM-DD)')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription('Event description')
            .setRequired(true)
            .setMaxLength(1000)
        )
        .addStringOption(option =>
          option
            .setName('tags')
            .setDescription('Event tags (comma-separated: lesbian,gay,bisexual,trans,etc.)')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('location')
            .setDescription('Event location')
            .setRequired(false)
            .setMaxLength(200)
        )
        .addStringOption(option =>
          option
            .setName('organizer')
            .setDescription('Event organizer')
            .setRequired(false)
            .setMaxLength(100)
        )
        .addStringOption(option =>
          option
            .setName('url')
            .setDescription('Event website or registration URL')
            .setRequired(false)
        )
        .addBooleanOption(option =>
          option
            .setName('recurring')
            .setDescription('Is this a recurring event?')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a pride event')
        .addStringOption(option =>
          option
            .setName('event-id')
            .setDescription('Event ID to remove')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List pride events')
        .addStringOption(option =>
          option
            .setName('filter')
            .setDescription('Filter events')
            .setRequired(false)
            .addChoices(
              { name: 'All Events', value: 'all' },
              { name: 'Upcoming (30 days)', value: 'upcoming' },
              { name: 'This Week', value: 'week' },
              { name: 'This Month', value: 'month' }
            )
        )
        .addStringOption(option =>
          option
            .setName('tag')
            .setDescription('Filter by identity tag')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('colors')
        .setDescription('Show available pride flag colors and tags')
    ),
  
  permissions: [PermissionFlagsBits.Administrator],
  
  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    
    try {
      switch (subcommand) {
        case 'add':
          await handleAddEvent(interaction);
          break;
        case 'remove':
          await handleRemoveEvent(interaction);
          break;
        case 'list':
          await handleListEvents(interaction);
          break;
        case 'colors':
          await handleShowColors(interaction);
          break;
      }
    } catch (error) {
      console.error('Error in pride-events command:', error);
      await interaction.reply({
        content: '❌ An error occurred while processing the command.',
        ephemeral: true
      });
    }
  }
};

async function handleAddEvent(interaction: ChatInputCommandInteraction) {
  const title = interaction.options.getString('title', true);
  const dateString = interaction.options.getString('date', true);
  const description = interaction.options.getString('description', true);
  const tagsString = interaction.options.getString('tags') || 'general';
  const location = interaction.options.getString('location');
  const organizer = interaction.options.getString('organizer');
  const url = interaction.options.getString('url');
  const isRecurring = interaction.options.getBoolean('recurring') || false;
  
  // Parse date
  let eventDate: Date;
  try {
    // Support both "YYYY-MM-DD HH:MM" and "YYYY-MM-DD" formats
    if (dateString.includes(' ')) {
      eventDate = new Date(dateString);
    } else {
      eventDate = new Date(dateString + ' 12:00'); // Default to noon if no time specified
    }
    
    if (isNaN(eventDate.getTime())) {
      throw new Error('Invalid date format');
    }
    
    // Check if date is in the past
    if (eventDate < new Date()) {
      await interaction.reply({
        content: '❌ Event date cannot be in the past!',
        ephemeral: true
      });
      return;
    }
  } catch (error) {
    await interaction.reply({
      content: '❌ Invalid date format! Please use YYYY-MM-DD or YYYY-MM-DD HH:MM format.',
      ephemeral: true
    });
    return;
  }
  
  // Parse tags
  const tags = tagsString.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0);
  
  // Validate URL if provided
  if (url && !isValidUrl(url)) {
    await interaction.reply({
      content: '❌ Invalid URL format!',
      ephemeral: true
    });
    return;
  }
  
  try {
    const eventId = addPrideEvent({
      title,
      description,
      date: eventDate.toISOString(),
      location,
      organizer,
      url,
      tags,
      isRecurring,
      recurringType: isRecurring ? 'yearly' : undefined,
      createdBy: interaction.user.id
    });
    
    const embed = new EmbedBuilder()
      .setTitle('🏳️‍🌈 Pride Event Added!')
      .addFields(
        { name: '📅 Event', value: title, inline: false },
        { name: '📝 Description', value: description.substring(0, 500) + (description.length > 500 ? '...' : ''), inline: false },
        { name: '🗓️ Date', value: `<t:${Math.floor(eventDate.getTime() / 1000)}:F>`, inline: true },
        { name: '🏷️ Tags', value: tags.join(', '), inline: true },
        { name: '🆔 Event ID', value: eventId, inline: true }
      )
      .setColor(getPrideColor(tags))
      .setTimestamp();
    
    if (location) {
      embed.addFields({ name: '📍 Location', value: location, inline: true });
    }
    
    if (organizer) {
      embed.addFields({ name: '👥 Organizer', value: organizer, inline: true });
    }
    
    if (url) {
      embed.addFields({ name: '🔗 More Info', value: url, inline: false });
    }
    
    if (isRecurring) {
      embed.addFields({ name: '🔄 Recurring', value: 'Yes (Yearly)', inline: true });
    }
    
    await interaction.reply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Error adding pride event:', error);
    await interaction.reply({
      content: '❌ Failed to add the event. Please try again.',
      ephemeral: true
    });
  }
}

async function handleRemoveEvent(interaction: ChatInputCommandInteraction) {
  const eventId = interaction.options.getString('event-id', true);
  
  const success = removePrideEvent(eventId);
  
  if (success) {
    await interaction.reply('✅ Successfully removed the pride event.');
  } else {
    await interaction.reply({
      content: '❌ Event not found. Check the event ID and try again.',
      ephemeral: true
    });
  }
}

async function handleListEvents(interaction: ChatInputCommandInteraction) {
  const filter = interaction.options.getString('filter') || 'upcoming';
  const tag = interaction.options.getString('tag');
  
  let events = getAllPrideEvents();
  
  // Apply tag filter first
  if (tag) {
    events = events.filter(event => 
      event.tags.some(t => t.toLowerCase().includes(tag.toLowerCase()))
    );
  }
  
  // Apply date filter
  const now = new Date();
  switch (filter) {
    case 'upcoming':
      events = events.filter(event => new Date(event.date) >= now);
      events = events.slice(0, 10); // Limit to next 10 events
      break;
    case 'week':
      const weekFromNow = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
      events = events.filter(event => {
        const eventDate = new Date(event.date);
        return eventDate >= now && eventDate <= weekFromNow;
      });
      break;
    case 'month':
      const monthFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
      events = events.filter(event => {
        const eventDate = new Date(event.date);
        return eventDate >= now && eventDate <= monthFromNow;
      });
      break;
    case 'all':
      events = events.slice(0, 15); // Limit to prevent Discord message limits
      break;
  }
  
  if (events.length === 0) {
    const filterText = tag ? ` with tag "${tag}"` : '';
    await interaction.reply({
      content: `📋 No pride events found${filterText} for the selected time period.`,
      ephemeral: true
    });
    return;
  }
  
  // Sort by date
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const embed = new EmbedBuilder()
    .setTitle(`🏳️‍🌈 Pride Events${tag ? ` - ${tag}` : ''} (${filter})`)
    .setColor(0xFF69B4)
    .setTimestamp();
  
  events.forEach((event, index) => {
    const eventDate = new Date(event.date);
    const isUpcoming = eventDate >= now;
    const status = isUpcoming ? '📅' : '✅';
    
    const fieldValue = 
      `${event.description.substring(0, 100)}${event.description.length > 100 ? '...' : ''}\n` +
      `**Date:** <t:${Math.floor(eventDate.getTime() / 1000)}:F>\n` +
      `**Tags:** ${event.tags.join(', ')}\n` +
      `**ID:** \`${event.id}\`${event.location ? `\n**Location:** ${event.location}` : ''}`;
    
    embed.addFields({
      name: `${status} ${event.title}`,
      value: fieldValue,
      inline: false
    });
  });
  
  if (events.length >= 10) {
    embed.setFooter({ text: 'Showing first 10 results. Use filters to narrow down.' });
  }
  
  await interaction.reply({ embeds: [embed] });
}

async function handleShowColors(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('🏳️‍🌈 Available Pride Flag Colors & Tags')
    .setDescription('Use these tags when creating events to get the appropriate pride flag colors!')
    .setColor(0xFF69B4)
    .setTimestamp();
  
  const colorEntries = Object.entries(PRIDE_COLORS);
  const half = Math.ceil(colorEntries.length / 2);
  
  const firstHalf = colorEntries.slice(0, half);
  const secondHalf = colorEntries.slice(half);
  
  embed.addFields(
    {
      name: '🎨 Available Tags (Part 1)',
      value: firstHalf.map(([tag, color]) => {
        const colorHex = `#${color.toString(16).padStart(6, '0').toUpperCase()}`;
        return `**${tag}** - \`${colorHex}\``;
      }).join('\n'),
      inline: true
    },
    {
      name: '🎨 Available Tags (Part 2)',
      value: secondHalf.map(([tag, color]) => {
        const colorHex = `#${color.toString(16).padStart(6, '0').toUpperCase()}`;
        return `**${tag}** - \`${colorHex}\``;
      }).join('\n'),
      inline: true
    },
    {
      name: '💡 Usage Tips',
      value: '• Use comma-separated tags: `lesbian,trans,general`\n' +
             '• Tags are case-insensitive\n' +
             '• First matching tag determines embed color\n' +
             '• Mix and match for intersectional events!',
      inline: false
    }
  );
  
  await interaction.reply({ embeds: [embed] });
}

function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

export default command;