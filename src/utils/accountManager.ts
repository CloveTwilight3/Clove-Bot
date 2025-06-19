// src/utils/accountManager.ts
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { logger } from './logger';

const ACCOUNTS_DATA_FILE = join(process.cwd(), 'data', 'monitored-accounts.json');

export interface MonitoredAccount {
  id: string;
  platform: 'youtube' | 'bluesky' | 'instagram';
  identifier: string; // Channel ID, handle, username
  displayName: string;
  enabled: boolean;
  lastChecked?: string;
  lastPostId?: string;
  rssUrl?: string; // For YouTube
  metadata?: {
    channelTitle?: string;
    subscriberCount?: string;
    profileImage?: string;
    bio?: string;
  };
}

// Ensure data directory exists
const dataDir = join(process.cwd(), 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

function readAccountsData(): MonitoredAccount[] {
  try {
    if (!existsSync(ACCOUNTS_DATA_FILE)) {
      writeFileSync(ACCOUNTS_DATA_FILE, JSON.stringify([], null, 2));
      return [];
    }
    
    const data = readFileSync(ACCOUNTS_DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    logger.error(`Error reading accounts data: ${error}`);
    return [];
  }
}

function writeAccountsData(accounts: MonitoredAccount[]): void {
  try {
    writeFileSync(ACCOUNTS_DATA_FILE, JSON.stringify(accounts, null, 2));
  } catch (error) {
    logger.error(`Error writing accounts data: ${error}`);
  }
}

export function addMonitoredAccount(account: Omit<MonitoredAccount, 'lastChecked'>): boolean {
  try {
    const accounts = readAccountsData();
    
    // Check if account already exists
    if (accounts.some(a => a.platform === account.platform && a.identifier === account.identifier)) {
      return false;
    }
    
    // Generate RSS URL for YouTube accounts
    let rssUrl = '';
    if (account.platform === 'youtube') {
      rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${account.identifier}`;
    }
    
    accounts.push({
      ...account,
      rssUrl,
      lastChecked: new Date().toISOString()
    });
    
    writeAccountsData(accounts);
    logger.info(`Added monitored account: ${account.displayName} (${account.platform})`);
    return true;
  } catch (error) {
    logger.error(`Error adding monitored account: ${error}`);
    return false;
  }
}

export function removeMonitoredAccount(accountId: string): boolean {
  try {
    const accounts = readAccountsData();
    const index = accounts.findIndex(a => a.id === accountId);
    
    if (index === -1) {
      return false;
    }
    
    const removedAccount = accounts.splice(index, 1)[0];
    writeAccountsData(accounts);
    logger.info(`Removed monitored account: ${removedAccount.displayName}`);
    return true;
  } catch (error) {
    logger.error(`Error removing monitored account: ${error}`);
    return false;
  }
}

export function getMonitoredAccounts(platform?: 'youtube' | 'bluesky' | 'instagram'): MonitoredAccount[] {
  const accounts = readAccountsData();
  if (platform) {
    return accounts.filter(a => a.platform === platform && a.enabled);
  }
  return accounts.filter(a => a.enabled);
}

export function getAllMonitoredAccounts(): MonitoredAccount[] {
  return readAccountsData();
}

export function updateAccountLastChecked(accountId: string, lastPostId?: string): void {
  try {
    const accounts = readAccountsData();
    const account = accounts.find(a => a.id === accountId);
    
    if (account) {
      account.lastChecked = new Date().toISOString();
      if (lastPostId) {
        account.lastPostId = lastPostId;
      }
      writeAccountsData(accounts);
    }
  } catch (error) {
    logger.error(`Error updating account last checked: ${error}`);
  }
}

export function toggleAccountEnabled(accountId: string): boolean {
  try {
    const accounts = readAccountsData();
    const account = accounts.find(a => a.id === accountId);
    
    if (!account) {
      return false;
    }
    
    account.enabled = !account.enabled;
    writeAccountsData(accounts);
    logger.info(`Toggled account ${account.displayName}: ${account.enabled ? 'enabled' : 'disabled'}`);
    return true;
  } catch (error) {
    logger.error(`Error toggling account: ${error}`);
    return false;
  }
}

export function updateAccountMetadata(accountId: string, metadata: MonitoredAccount['metadata']): void {
  try {
    const accounts = readAccountsData();
    const account = accounts.find(a => a.id === accountId);
    
    if (account) {
      account.metadata = { ...account.metadata, ...metadata };
      writeAccountsData(accounts);
    }
  } catch (error) {
    logger.error(`Error updating account metadata: ${error}`);
  }
}

export function createYouTubeRSSURL(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

export function generateAccountId(platform: string, identifier: string): string {
  return `${platform}_${identifier}_${Date.now()}`;
}