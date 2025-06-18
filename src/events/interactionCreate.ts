import { Events, Interaction, Collection, PermissionsBitField } from 'discord.js';
import { Command } from '../interfaces/Command';
import { logger } from '../utils/logger';

// Cooldown management
const cooldowns = new Collection<string, Collection<string, number>>();

export default {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return;

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
};