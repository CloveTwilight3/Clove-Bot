import { Events, GuildMember, EmbedBuilder } from 'discord.js';
import { logger } from '../utils/logger';

// Hardcoded role ID - replace with your desired role ID
const AUTO_ROLE_ID = '1385978484190351430'; // Replace this with your role ID

// Optional: Welcome channel ID
const WELCOME_CHANNEL_ID = '1384662948571517011'; // Replace with your welcome channel ID (or use null to disable)

export default {
  name: Events.GuildMemberAdd,
  async execute(member: GuildMember) {
    try {
      logger.info(`New member joined: ${member.user.tag} (${member.id})`);
      
      // Get the auto-role
      const autoRole = member.guild.roles.cache.get(AUTO_ROLE_ID);
      
      if (!autoRole) {
        logger.error(`Auto-role with ID ${AUTO_ROLE_ID} not found!`);
        return;
      }
      
      // Add the role to the new member
      try {
        await member.roles.add(autoRole);
        logger.info(`Successfully added role "${autoRole.name}" to ${member.user.tag}`);
      } catch (roleError) {
        logger.error(`Failed to add role to ${member.user.tag}: ${roleError}`);
      }
      
      // Optional: Send welcome message
      if (WELCOME_CHANNEL_ID) {
        const welcomeChannel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
        
        if (welcomeChannel?.isTextBased()) {
          const welcomeEmbed = new EmbedBuilder()
            .setTitle('🎉 Welcome to the Server!')
            .setDescription(`Welcome ${member.user}, we're glad to have you here!`)
            .addFields(
              { name: '👤 User', value: `${member.user.tag}`, inline: true },
              { name: '🆔 User ID', value: member.id, inline: true },
              { name: '📅 Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`, inline: false },
              { name: '🎭 Role Assigned', value: autoRole.name, inline: true }
            )
            .setColor(0x00ff00)
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();
          
          try {
            await welcomeChannel.send({
              content: `${member.user} Welcome to ${member.guild.name}!`,
              embeds: [welcomeEmbed]
            });
          } catch (messageError) {
            logger.error(`Failed to send welcome message: ${messageError}`);
          }
        }
      }
      
    } catch (error) {
      logger.error(`Error in guildMemberAdd event: ${error}`);
    }
  }
};