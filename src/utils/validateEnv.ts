// src/utils/validateEnv.ts
import { logger } from './logger';

export const validateEnv = (): boolean => {
  const requiredEnvVars = ['DISCORD_TOKEN', 'CLIENT_ID'];
  const missingVars: string[] = [];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missingVars.push(envVar);
    }
  }

  if (missingVars.length > 0) {
    logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    return false;
  }

  // GUILD_ID is optional - warn if missing but don't fail
  if (!process.env.GUILD_ID) {
    logger.warn('GUILD_ID not set - using global commands (slower updates)');
  }

  return true;
};