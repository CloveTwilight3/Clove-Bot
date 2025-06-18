// src/handlers/commandHandler.ts
import { Collection } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { Command } from '../interfaces/Command';
import { logger } from '../utils/logger';

export const loadCommands = async (): Promise<Collection<string, Command>> => {
  const commands = new Collection<string, Command>();
  const commandsPath = join(__dirname, '../commands');
  
  const loadCommandsFromDir = async (dir: string): Promise<void> => {
    const commandFiles = readdirSync(dir, { withFileTypes: true });
    
    for (const file of commandFiles) {
      const filePath = join(dir, file.name);
      
      if (file.isDirectory()) {
        await loadCommandsFromDir(filePath);
      } else if (
        (file.name.endsWith('.js') || file.name.endsWith('.ts')) && 
        !file.name.endsWith('.d.ts')
      ) {
        // Load both .js and .ts files, but not .d.ts files
        try {
          const command: Command = require(filePath).default;
          
          if ('data' in command && 'execute' in command) {
            commands.set(command.data.name, command);
            logger.info(`Loaded command: ${command.data.name}`);
          } else {
            logger.warn(`Command at ${filePath} is missing required "data" or "execute" property`);
          }
        } catch (error) {
          logger.error(`Error loading command at ${filePath}: ${error}`);
        }
      }
    }
  };
  
  await loadCommandsFromDir(commandsPath);
  logger.info(`Successfully loaded ${commands.size} commands`);
  
  return commands;
};