import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType
} from 'discord.js';
import { Command } from '../../interfaces/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ticket-setup')
    .setDescription('Setup the ticket creation embed with button (Admin only)')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel to send the ticket creation message')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText)
    ),
  
  permissions: [PermissionFlagsBits.Administrator],
  
  async execute(interaction: ChatInputCommandInteraction) {
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    
    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: '❌ Please specify a valid text channel!',
        ephemeral: true
      });
      return;
    }
    
    try {
      // Create the main ticket embed
      const ticketEmbed = new EmbedBuilder()
        .setTitle('🎫 Support Ticket System')
        .setDescription(
          '**Need help or have a question?**\n\n' +
          'Click the button below to create a support ticket. Our team will be with you shortly!\n\n' +
          '**What you can get help with:**\n' +
          '• 🐛 Report bugs or issues\n' +
          '• 💡 Suggest new features\n' +
          '• ❓ Ask questions\n' +
          '• 🛠️ Technical support\n' +
          '• 📋 General assistance\n\n' +
          '**Please note:** Only create one ticket at a time.'
        )
        .setColor(0x0099ff)
        .setThumbnail(interaction.guild?.iconURL() || null)
        .setFooter({ 
          text: 'Support Team • Click the button to get started',
          iconURL: interaction.client.user.displayAvatarURL()
        })
        .setTimestamp();
      
      // Create the persistent button
      const ticketButton = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('create_ticket_button')
            .setLabel('Create Ticket')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎫')
        );
      
      // Send the embed to the target channel
      const sentMessage = await targetChannel.send({
        embeds: [ticketEmbed],
        components: [ticketButton]
      });
      
      // Try to pin the message
      try {
        await sentMessage.pin();
      } catch (pinError) {
        console.warn('Could not pin the ticket message:', pinError);
      }
      
      await interaction.reply({
        content: `✅ Ticket creation embed has been set up in ${targetChannel}!`,
        ephemeral: true
      });
      
    } catch (error) {
      console.error('Error setting up ticket system:', error);
      await interaction.reply({
        content: '❌ Failed to setup the ticket system. Please try again.',
        ephemeral: true
      });
    }
  }
};

export default command;