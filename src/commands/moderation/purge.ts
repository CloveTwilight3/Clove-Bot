import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel
} from 'discord.js';
import { Command } from '../../interfaces/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete multiple messages')
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addUserOption(option =>
      option
        .setName('target')
        .setDescription('Only delete messages from this user')
        .setRequired(false)
    ),
  
  permissions: [PermissionFlagsBits.ManageMessages],
  
  async execute(interaction: ChatInputCommandInteraction) {
    const amount = interaction.options.getInteger('amount', true);
    const target = interaction.options.getUser('target');
    
    const channel = interaction.channel;
    
    if (!channel || !(channel instanceof TextChannel)) {
      await interaction.reply({
        content: '❌ This command can only be used in text channels!',
        ephemeral: true
      });
      return;
    }
    
    await interaction.deferReply({ ephemeral: true });
    
    try {
      // Fetch messages
      const messages = await channel.messages.fetch({ limit: amount });
      
      // Filter messages if target user specified
      let messagesToDelete = messages;
      if (target) {
        messagesToDelete = messages.filter(msg => msg.author.id === target.id);
        
        if (messagesToDelete.size === 0) {
          await interaction.editReply(`❌ No messages found from ${target.tag} in the last ${amount} messages.`);
          return;
        }
      }
      
      // Filter out messages older than 14 days (Discord limitation)
      const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
      const recentMessages = messagesToDelete.filter(msg => msg.createdTimestamp > twoWeeksAgo);
      
      if (recentMessages.size === 0) {
        await interaction.editReply('❌ No messages found that are less than 14 days old.');
        return;
      }
      
      // Delete messages
      const deleted = await channel.bulkDelete(recentMessages, true);
      
      // Create success embed
      const purgeEmbed = new EmbedBuilder()
        .setTitle('🗑️ Messages Purged')
        .addFields(
          { name: '📊 Messages Deleted', value: `${deleted.size}`, inline: true },
          { name: '👮 Moderator', value: `${interaction.user.tag}`, inline: true },
          { name: '📍 Channel', value: `${channel}`, inline: true }
        )
        .setColor(0xff8800)
        .setTimestamp();
      
      if (target) {
        purgeEmbed.addFields({ name: '🎯 Target User', value: `${target.tag}`, inline: true });
      }
      
      await interaction.editReply({ embeds: [purgeEmbed] });
      
    } catch (error) {
      console.error('Purge command error:', error);
      await interaction.editReply('❌ Failed to delete messages!');
    }
  }
};

export default command;