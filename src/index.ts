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

// Create client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
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
      socialMonitor = new SocialMonitorService(client);
      socialMonitor.start();
      logger.info('🎯 Social media monitoring started');
    });
    
  } catch (error) {
    logger.error(`Failed to initialize bot: ${error}`);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  logger.error(`Unhandled promise rejection: ${error}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error}`);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  
  if (socialMonitor) {
    socialMonitor.stop();
  }
  
  client.destroy();
  process.exit(0);
});

// Initialize the bot
initializeBot();