import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from 'dotenv';
import { validateEnv } from './utils/validateEnv';
import { logger } from './utils/logger';
import { loadCommands } from './handlers/commandHandler';
import { loadEvents } from './handlers/eventHandler';
import { Command } from './interfaces/Command';

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

// Initialize bot
async function initializeBot() {
  try {
    logger.info('🚀 Starting bot initialization...');
    
    // Load commands
    client.commands = await loadCommands();
    
    // Load events
    loadEvents(client);
    
    // Login to Discord
    await client.login(process.env.DISCORD_TOKEN);
    
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
  client.destroy();
  process.exit(0);
});

// Initialize the bot
initializeBot();