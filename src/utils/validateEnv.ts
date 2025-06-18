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

  return true;
};