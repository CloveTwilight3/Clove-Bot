// src/utils/blueskyClient.ts
import { BskyAgent } from '@atproto/api';
import { logger } from './logger';

let agent: BskyAgent | null = null;

export async function initializeBlueskyClient(): Promise<boolean> {
  try {
    if (!process.env.BLUESKY_USERNAME || !process.env.BLUESKY_PASSWORD) {
      logger.warn('Bluesky credentials not found in environment variables');
      return false;
    }

    agent = new BskyAgent({
      service: 'https://bsky.social'
    });

    await agent.login({
      identifier: process.env.BLUESKY_USERNAME,
      password: process.env.BLUESKY_PASSWORD
    });

    logger.info('Successfully connected to Bluesky');
    return true;
  } catch (error) {
    logger.error(`Failed to initialize Bluesky client: ${error}`);
    return false;
  }
}

export async function getBlueskyUserPosts(handle: string, limit: number = 10): Promise<any[]> {
  try {
    if (!agent) {
      throw new Error('Bluesky client not initialized');
    }

    const response = await agent.getAuthorFeed({ 
      actor: handle,
      limit 
    });
    
    return response.data.feed || [];
  } catch (error) {
    logger.error(`Error fetching Bluesky posts for ${handle}: ${error}`);
    return [];
  }
}

export async function getBlueskyProfile(handle: string): Promise<any> {
  try {
    if (!agent) {
      throw new Error('Bluesky client not initialized');
    }

    const response = await agent.getProfile({ actor: handle });
    return response.data;
  } catch (error) {
    logger.error(`Error fetching Bluesky profile for ${handle}: ${error}`);
    return null;
  }
}

export async function searchBlueskyUser(query: string): Promise<any[]> {
  try {
    if (!agent) {
      throw new Error('Bluesky client not initialized');
    }

    const response = await agent.searchActors({ term: query, limit: 10 });
    return response.data.actors || [];
  } catch (error) {
    logger.error(`Error searching Bluesky users: ${error}`);
    return [];
  }
}

export function isBlueskyInitialized(): boolean {
  return agent !== null;
}