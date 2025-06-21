// src/utils/prideEventManager.ts
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { logger } from './logger';

const PRIDE_EVENTS_FILE = join(process.cwd(), 'data', 'pride-events.json');

export interface PrideEvent {
  id: string;
  title: string;
  description: string;
  date: string; // ISO string
  location?: string;
  organizer?: string;
  url?: string;
  tags: string[]; // e.g., ['lesbian', 'gay', 'bisexual', 'trans', 'nonbinary', 'general']
  isRecurring: boolean;
  recurringType?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  notificationSent: boolean;
  createdBy: string; // Discord user ID
  createdAt: string;
  reminded: boolean; // For 24h reminders
}

// Ensure data directory exists
const dataDir = join(process.cwd(), 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

function readEventsData(): PrideEvent[] {
  try {
    if (!existsSync(PRIDE_EVENTS_FILE)) {
      writeFileSync(PRIDE_EVENTS_FILE, JSON.stringify([], null, 2));
      return [];
    }
    
    const data = readFileSync(PRIDE_EVENTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    logger.error(`Error reading pride events data: ${error}`);
    return [];
  }
}

function writeEventsData(events: PrideEvent[]): void {
  try {
    writeFileSync(PRIDE_EVENTS_FILE, JSON.stringify(events, null, 2));
  } catch (error) {
    logger.error(`Error writing pride events data: ${error}`);
  }
}

export function addPrideEvent(event: Omit<PrideEvent, 'id' | 'createdAt' | 'notificationSent' | 'reminded'>): string {
  const events = readEventsData();
  
  const newEvent: PrideEvent = {
    ...event,
    id: `pride_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    notificationSent: false,
    reminded: false
  };
  
  events.push(newEvent);
  writeEventsData(events);
  
  logger.info(`Added pride event: ${newEvent.title} on ${newEvent.date}`);
  return newEvent.id;
}

export function removePrideEvent(eventId: string): boolean {
  const events = readEventsData();
  const index = events.findIndex(e => e.id === eventId);
  
  if (index === -1) {
    return false;
  }
  
  const removedEvent = events.splice(index, 1)[0];
  writeEventsData(events);
  
  logger.info(`Removed pride event: ${removedEvent.title}`);
  return true;
}

export function getAllPrideEvents(): PrideEvent[] {
  return readEventsData();
}

export function getUpcomingPrideEvents(daysAhead: number = 30): PrideEvent[] {
  const events = readEventsData();
  const now = new Date();
  const futureDate = new Date(now.getTime() + (daysAhead * 24 * 60 * 60 * 1000));
  
  return events.filter(event => {
    const eventDate = new Date(event.date);
    return eventDate >= now && eventDate <= futureDate;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function getEventsNeedingNotification(): PrideEvent[] {
  const events = readEventsData();
  const now = new Date();
  
  return events.filter(event => {
    const eventDate = new Date(event.date);
    const timeDiff = eventDate.getTime() - now.getTime();
    const hoursUntilEvent = timeDiff / (1000 * 60 * 60);
    
    // Send notification 1-2 hours before event starts
    return !event.notificationSent && hoursUntilEvent <= 2 && hoursUntilEvent > 0;
  });
}

export function getEventsNeedingReminder(): PrideEvent[] {
  const events = readEventsData();
  const now = new Date();
  
  return events.filter(event => {
    const eventDate = new Date(event.date);
    const timeDiff = eventDate.getTime() - now.getTime();
    const hoursUntilEvent = timeDiff / (1000 * 60 * 60);
    
    // Send reminder 24 hours before event
    return !event.reminded && hoursUntilEvent <= 25 && hoursUntilEvent > 23;
  });
}

export function markEventNotified(eventId: string): void {
  const events = readEventsData();
  const event = events.find(e => e.id === eventId);
  
  if (event) {
    event.notificationSent = true;
    writeEventsData(events);
  }
}

export function markEventReminded(eventId: string): void {
  const events = readEventsData();
  const event = events.find(e => e.id === eventId);
  
  if (event) {
    event.reminded = true;
    writeEventsData(events);
  }
}

export function updatePrideEvent(eventId: string, updates: Partial<PrideEvent>): boolean {
  const events = readEventsData();
  const event = events.find(e => e.id === eventId);
  
  if (!event) {
    return false;
  }
  
  Object.assign(event, updates);
  writeEventsData(events);
  
  logger.info(`Updated pride event: ${event.title}`);
  return true;
}

export function getPrideEventsByTag(tag: string): PrideEvent[] {
  const events = readEventsData();
  return events.filter(event => 
    event.tags.some(t => t.toLowerCase().includes(tag.toLowerCase()))
  );
}

// Predefined pride flag colors for different identities
export const PRIDE_COLORS = {
  general: 0xFF0000, // Rainbow flag red
  lesbian: 0xD62900, // Lesbian flag orange
  gay: 0x732982, // Gay flag purple
  bisexual: 0xD9006F, // Bisexual flag magenta
  trans: 0x5BCFFB, // Trans flag light blue
  nonbinary: 0xFFF433, // Non-binary flag yellow
  pansexual: 0xFF218C, // Pansexual flag pink
  asexual: 0x000000, // Asexual flag black
  aromantic: 0x3FA83F, // Aromantic flag green
  queer: 0xFF69B4, // General queer pink
  intersex: 0xFFD800, // Intersex flag yellow
  agender: 0x00FF00, // Agender flag green
  demisexual: 0x682077, // Demisexual flag purple
  genderfluid: 0xFF77A8, // Genderfluid flag pink
  polyamory: 0x0066CC // Polyamory flag blue
};

export function getPrideColor(tags: string[]): number {
  // Return color based on first matching tag
  for (const tag of tags) {
    const normalizedTag = tag.toLowerCase().replace(/[^a-z]/g, '');
    if (PRIDE_COLORS[normalizedTag as keyof typeof PRIDE_COLORS]) {
      return PRIDE_COLORS[normalizedTag as keyof typeof PRIDE_COLORS];
    }
  }
  return PRIDE_COLORS.general; // Default to rainbow
}