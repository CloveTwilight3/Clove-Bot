// src/commands/general/pride.ts
import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { 
  getUpcomingPrideEvents, 
  getPrideEventsByTag,
  getPrideColor,
  PRIDE_COLORS 
} from '../../utils/prideEventManager';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('pride')
    .setDescription('View upcoming pride events')
    .addSubcommand(subcommand =>
      subcommand
        .setName('upcoming')
        .setDescription('Show upcoming pride events')
        .addIntegerOption(option =>
          option
            .setName('days')
            .setDescription('Number of days ahead to look (default: 30)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(365)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('search')
        .setDescription('Search pride events by tag')
        .addStringOption(option =>
          option
            .setName('tag')
            .setDescription('Search by identity tag (e.g., lesbian, trans, bisexual)')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('flags')
        .setDescription('Show all available pride flag colors')
    ),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    
    try {
      switch (subcommand) {
        case 'upcoming':
          await handleUpcomingEvents(interaction);
          break;
        case 'search':
          await handleSearchByTag(interaction);
          break;
        case 'flags':
          await handleShowFlags(interaction);
          break;
      }
    } catch (error) {
      console.error('Error in pride command:', error);
      await interaction.reply({
        content: '❌ An error occurred while processing the command.',
        ephemeral: true
      });
    }
  }
};

async function handleUpcomingEvents(interaction: ChatInputCommandInteraction) {
  const days = interaction.options.getInteger('days') || 30;
  
  const events = getUpcomingPrideEvents(days);
  
  if (events.length === 0) {
    await interaction.reply({
      content: `🏳️‍🌈 No pride events found in the next ${days} days. Check back later or ask an admin to add some events!`,
      ephemeral: true
    });
    return;
  }
  
  const embed = new EmbedBuilder()
    .setTitle(`🏳️‍🌈 Upcoming Pride Events (Next ${days} Days)`)
    .setDescription(`Found ${events.length} upcoming event(s)`)
    .setColor(0xFF69B4)
    .setTimestamp();
  
  // Show up to 5 events to avoid hitting Discord's field limit
  const eventsToShow = events.slice(0, 5);
  
  eventsToShow.forEach((event, index) => {
    const eventDate = new Date(event.date);
    const daysUntil = Math.ceil((eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    let fieldValue = `${event.description.substring(0, 150)}${event.description.length > 150 ? '...' : ''}\n\n`;
    fieldValue += `📅 **When:** <t:${Math.floor(eventDate.getTime() / 1000)}:F>\n`;
    fieldValue += `⏰ **Time Until:** <t:${Math.floor(eventDate.getTime() / 1000)}:R>\n`;
    
    if (event.location) {
      fieldValue += `📍 **Location:** ${event.location}\n`;
    }
    
    if (event.organizer) {
      fieldValue += `👥 **Organizer:** ${event.organizer}\n`;
    }
    
    if (event.tags.length > 0) {
      fieldValue += `🏷️ **Tags:** ${event.tags.join(', ')}\n`;
    }
    
    if (event.url) {
      fieldValue += `🔗 **More Info:** ${event.url}`;
    }
    
    // Use appropriate pride flag emoji based on tags
    const emoji = getPrideEmoji(event.tags);
    
    embed.addFields({
      name: `${emoji} ${event.title}`,
      value: fieldValue,
      inline: false
    });
  });
  
  if (events.length > 5) {
    embed.setFooter({ 
      text: `Showing first 5 of ${events.length} events. Use /pride search to find specific events.` 
    });
  }
  
  // Add notification role info if configured
  if (process.env.PRIDE_ROLE_ID) {
    embed.setDescription(
      embed.data.description + 
      `\n\n💡 **Want notifications?** Get the <@&${process.env.PRIDE_ROLE_ID}> role to be pinged when events start!`
    );
  }
  
  await interaction.reply({ embeds: [embed] });
}

async function handleSearchByTag(interaction: ChatInputCommandInteraction) {
  const tag = interaction.options.getString('tag', true);
  
  const events = getPrideEventsByTag(tag);
  const upcomingEvents = events.filter(event => new Date(event.date) >= new Date());
  
  if (upcomingEvents.length === 0) {
    await interaction.reply({
      content: `🔍 No upcoming pride events found with tag "${tag}". Try searching for other tags like: lesbian, gay, bisexual, trans, nonbinary, etc.`,
      ephemeral: true
    });
    return;
  }
  
  // Sort by date
  upcomingEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const embed = new EmbedBuilder()
    .setTitle(`🔍 Pride Events: "${tag}"`)
    .setDescription(`Found ${upcomingEvents.length} upcoming event(s) with this tag`)
    .setColor(getPrideColor([tag]))
    .setTimestamp();
  
  // Show up to 5 events
  const eventsToShow = upcomingEvents.slice(0, 5);
  
  eventsToShow.forEach((event) => {
    const eventDate = new Date(event.date);
    
    let fieldValue = `${event.description.substring(0, 150)}${event.description.length > 150 ? '...' : ''}\n\n`;
    fieldValue += `📅 **When:** <t:${Math.floor(eventDate.getTime() / 1000)}:F>\n`;
    fieldValue += `⏰ **Time Until:** <t:${Math.floor(eventDate.getTime() / 1000)}:R>\n`;
    
    if (event.location) {
      fieldValue += `📍 **Location:** ${event.location}\n`;
    }
    
    if (event.organizer) {
      fieldValue += `👥 **Organizer:** ${event.organizer}\n`;
    }
    
    if (event.tags.length > 0) {
      fieldValue += `🏷️ **Tags:** ${event.tags.join(', ')}\n`;
    }
    
    if (event.url) {
      fieldValue += `🔗 **More Info:** ${event.url}`;
    }
    
    const emoji = getPrideEmoji(event.tags);
    
    embed.addFields({
      name: `${emoji} ${event.title}`,
      value: fieldValue,
      inline: false
    });
  });
  
  if (upcomingEvents.length > 5) {
    embed.setFooter({ 
      text: `Showing first 5 of ${upcomingEvents.length} events.` 
    });
  }
  
  await interaction.reply({ embeds: [embed] });
}

async function handleShowFlags(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('🏳️‍🌈 Pride Flag Colors & Identities')
    .setDescription('Here are all the pride identities supported by this bot!')
    .setColor(0xFF69B4)
    .setTimestamp();
  
  const colorEntries = Object.entries(PRIDE_COLORS);
  const itemsPerField = 8;
  
  for (let i = 0; i < colorEntries.length; i += itemsPerField) {
    const chunk = colorEntries.slice(i, i + itemsPerField);
    const fieldNumber = Math.floor(i / itemsPerField) + 1;
    
    embed.addFields({
      name: `🎨 Pride Identities (Part ${fieldNumber})`,
      value: chunk.map(([tag, color]) => {
        const emoji = getPrideEmoji([tag]);
        const colorHex = `#${color.toString(16).padStart(6, '0').toUpperCase()}`;
        return `${emoji} **${tag}** - \`${colorHex}\``;
      }).join('\n'),
      inline: true
    });
  }
  
  embed.addFields({
    name: '💡 How to Use',
    value: '• Use `/pride search <tag>` to find events by identity\n' +
           '• Admins can use tags when creating events with `/pride-events add`\n' +
           '• Tags determine the embed colors for events\n' +
           '• Multiple tags can be used for intersectional events!',
    inline: false
  });
  
  await interaction.reply({ embeds: [embed] });
}

function getPrideEmoji(tags: string[]): string {
  // Return appropriate emoji based on tags
  for (const tag of tags) {
    switch (tag.toLowerCase()) {
      case 'lesbian': return '🏳️‍🌈';
      case 'gay': return '🏳️‍🌈';
      case 'bisexual': return '💗';
      case 'trans': 
      case 'transgender': return '🏳️‍⚧️';
      case 'nonbinary': return '💛';
      case 'pansexual': return '💖';
      case 'asexual': return '🖤';
      case 'aromantic': return '💚';
      case 'intersex': return '💛';
      case 'agender': return '💚';
      case 'demisexual': return '💜';
      case 'genderfluid': return '💖';
      case 'polyamory': return '💙';
      default: return '🏳️‍🌈';
    }
  }
  return '🏳️‍🌈';
}

export default command;