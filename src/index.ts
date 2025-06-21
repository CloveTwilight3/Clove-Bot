// src/index.ts
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from 'dotenv';
import { validateEnv } from './utils/validateEnv';
import { logger } from './utils/logger';
import { loadCommands } from './handlers/commandHandler';
import { loadEvents } from './handlers/eventHandler';
import { Command } from './interfaces/Command';
import { REST, Routes } from 'discord.js';
import { SocialMonitorService } from './services/socialMonitor';
import { initializeBlueskyClient } from './utils/blueskyClient';

// Load environment variables
config();

// Validate environment
if (!validateEnv()) {
  process.exit(1);
}

// Create client instance with proper mentions configuration
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  allowedMentions: {
    parse: ['users', 'roles'], // Allow bot to ping users and roles
    repliedUser: true
  }
}) as Client & { commands: Collection<string, Command> };

// Initialize commands collection
client.commands = new Collection();

// Initialize services
let socialMonitor: SocialMonitorService;

// Deploy commands function
async function deployCommands(commands: Collection<string, Command>) {
  try {
    logger.info('🔄 Started refreshing application (/) commands.');

    const commandData = commands.map((command: Command) => command.data.toJSON());
    const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

    let data: any[];
    
    if (process.env.GUILD_ID) {
      // Deploy to specific guild (fast)
      logger.info(`📍 Deploying to guild: ${process.env.GUILD_ID}`);
      data = await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID),
        { body: commandData }
      ) as any[];
      logger.info(`✅ Successfully reloaded ${data.length} guild commands.`);
    } else {
      // Deploy globally (slow)
      logger.info('🌍 Deploying globally (this may take up to 1 hour to propagate)');
      data = await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID!),
        { body: commandData }
      ) as any[];
      logger.info(`✅ Successfully reloaded ${data.length} global commands.`);
    }

  } catch (error) {
    logger.error(`❌ Error deploying commands: ${error}`);
    throw error;
  }
}

// Initialize bot
async function initializeBot() {
  try {
    logger.info('🚀 Starting bot initialization...');
    
    // Load commands
    client.commands = await loadCommands();
    
    // Deploy commands to Discord
    await deployCommands(client.commands);
    
    // Load events
    loadEvents(client);
    
    // Initialize Bluesky client (optional)
    await initializeBlueskyClient();
    
    // Login to Discord
    await client.login(process.env.DISCORD_TOKEN);
    
    // Start social media monitoring after client is ready
    client.once('ready', () => {
      logger.info(`✅ ${client.user!.tag} is online and ready!`);
      logger.info(`📊 Serving ${client.guilds.cache.size} servers`);
      
      // Set bot status
      client.user!.setActivity('with the Protocol', { 
        type: 0 // Playing
      });
      
      // Initialize and start social monitoring
      try {
        socialMonitor = new SocialMonitorService(client);
        socialMonitor.start();
        logger.info('🎯 Social media monitoring started');
        
        // Log monitoring configuration
        if (process.env.YOUTUBE_CHANNEL_ID) {
          logger.info(`📺 YouTube announcements: Channel ${process.env.YOUTUBE_CHANNEL_ID}`);
        }
        if (process.env.BLUESKY_CHANNEL_ID) {
          logger.info(`🦋 Bluesky announcements: Channel ${process.env.BLUESKY_CHANNEL_ID}`);
        }
        if (process.env.INSTAGRAM_CHANNEL_ID) {
          logger.info(`📸 Instagram announcements: Channel ${process.env.INSTAGRAM_CHANNEL_ID}`);
        }
        if (process.env.NOTIFICATION_ROLE_ID) {
          logger.info(`🔔 Notification role: ${process.env.NOTIFICATION_ROLE_ID}`);
        } else {
          logger.warn('⚠️ NOTIFICATION_ROLE_ID not set - role pings disabled');
        }
        
      } catch (monitorError) {
        logger.error(`Failed to start social monitoring: ${monitorError}`);
      }
    });
    
    // Log when client is fully ready and connected
    client.on('ready', () => {
      logger.info('🌟 Bot is fully initialized and ready to serve!');
    });
    
  } catch (error) {
    logger.error(`Failed to initialize bot: ${error}`);
    process.exit(1);
  }
}

// Enhanced error handling
process.on('unhandledRejection', (error: Error) => {
  logger.error(`Unhandled promise rejection: ${error.message}`);
  logger.error(`Stack trace: ${error.stack}`);
});

process.on('uncaughtException', (error: Error) => {
  logger.error(`Uncaught exception: ${error.message}`);
  logger.error(`Stack trace: ${error.stack}`);
  
  // Graceful shutdown on uncaught exception
  logger.info('Attempting graceful shutdown due to uncaught exception...');
  
  if (socialMonitor) {
    try {
      socialMonitor.stop();
      logger.info('Social monitor stopped');
    } catch (stopError) {
      logger.error(`Error stopping social monitor: ${stopError}`);
    }
  }
  
  if (client) {
    try {
      client.destroy();
      logger.info('Discord client destroyed');
    } catch (destroyError) {
      logger.error(`Error destroying client: ${destroyError}`);
    }
  }
  
  process.exit(1);
});

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  logger.info('Received SIGINT (Ctrl+C), shutting down gracefully...');
  await gracefulShutdown();
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  await gracefulShutdown();
});

async function gracefulShutdown() {
  try {
    logger.info('Starting graceful shutdown...');
    
    // Stop social monitoring
    if (socialMonitor) {
      logger.info('Stopping social media monitoring...');
      socialMonitor.stop();
      logger.info('Social monitoring stopped');
    }
    
    // Update bot status to indicate shutdown
    if (client && client.user) {
      try {
        await client.user.setActivity('Shutting down...', { type: 0 });
        logger.info('Updated bot status');
      } catch (statusError) {
        logger.warn(`Could not update bot status: ${statusError}`);
      }
    }
    
    // Destroy Discord client
    if (client) {
      logger.info('Destroying Discord client...');
      client.destroy();
      logger.info('Discord client destroyed');
    }
    
    logger.info('✅ Graceful shutdown completed');
    process.exit(0);
    
  } catch (shutdownError) {
    logger.error(`Error during graceful shutdown: ${shutdownError}`);
    process.exit(1);
  }
}

// Handle Discord client errors
client.on('error', (error: Error) => {
  logger.error(`Discord client error: ${error.message}`);
});

client.on('warn', (warning: string) => {
  logger.warn(`Discord client warning: ${warning}`);
});

// Handle Discord connection issues
client.on('disconnect', () => {
  logger.warn('Discord client disconnected');
});

client.on('reconnecting', () => {
  logger.info('Discord client reconnecting...');
});

client.on('resume', () => {
  logger.info('Discord client connection resumed');
});

// Rate limit handling
client.rest.on('rateLimited', (rateLimitData) => {
  logger.warn(`Rate limited: ${JSON.stringify(rateLimitData)}`);
});

// Additional monitoring for social media service
setInterval(() => {
  if (client.isReady()) {
    logger.debug(`Bot health check: ${client.guilds.cache.size} guilds, ${client.users.cache.size} cached users`);
  }
}, 5 * 60 * 1000); // Every 5 minutes

// Initialize the bot
initializeBot().catch((error) => {
  logger.error(`Fatal error during bot initialization: ${error}`);
  process.exit(1);
});

// Export client for potential external access (testing, etc.)
export { client };