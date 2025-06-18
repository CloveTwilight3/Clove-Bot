// src/deploy-commands.ts
import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { loadCommands } from './handlers/commandHandler';
import { validateEnv } from './utils/validateEnv';
import { logger } from './utils/logger';
import { Command } from './interfaces/Command';

config();

if (!validateEnv()) {
  process.exit(1);
}

async function deployCommands() {
  try {
    logger.info('🔄 Starting command deployment...');

    const commands = await loadCommands();
    const commandData = commands.map((command: Command) => command.data.toJSON());

    logger.info(`📝 Found ${commandData.length} commands to deploy`);

    const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

    let data: any[];
    
    if (process.env.GUILD_ID) {
      // Deploy to specific guild (fast)
      logger.info(`📍 Deploying to guild: ${process.env.GUILD_ID}`);
      data = await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID),
        { body: commandData }
      ) as any[];
      logger.info(`✅ Successfully deployed ${data.length} guild commands.`);
    } else {
      // Deploy globally (slow)
      logger.info('🌍 Deploying globally (this may take up to 1 hour to propagate)');
      data = await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID!),
        { body: commandData }
      ) as any[];
      logger.info(`✅ Successfully deployed ${data.length} global commands.`);
    }

  } catch (error) {
    logger.error(`❌ Error deploying commands: ${error}`);
    process.exit(1);
  }
}

deployCommands();