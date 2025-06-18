import { Client, Events } from 'discord.js';
import { logger } from '../utils/logger';

export default {
  name: Events.ClientReady,
  once: true,
  execute(client: Client<true>) {
    logger.info(`✅ ${client.user.tag} is online and ready!`);
    logger.info(`📊 Serving ${client.guilds.cache.size} servers`);
    
    // Set bot status
    client.user.setActivity('with the Protocol', { 
      type: 0 // Playing
    });
  }
};