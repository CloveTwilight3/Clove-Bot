import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from './logger';

const COUNTER_FILE = join(process.cwd(), 'data', 'ticket-counter.json');

interface TicketData {
  counter: number;
  lastReset: string;
}

// Ensure data directory exists
import { mkdirSync } from 'fs';
const dataDir = join(process.cwd(), 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

function readCounter(): TicketData {
  try {
    if (!existsSync(COUNTER_FILE)) {
      const initialData: TicketData = {
        counter: 0,
        lastReset: new Date().toISOString()
      };
      writeFileSync(COUNTER_FILE, JSON.stringify(initialData, null, 2));
      return initialData;
    }
    
    const data = readFileSync(COUNTER_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    logger.error(`Error reading ticket counter: ${error}`);
    return { counter: 0, lastReset: new Date().toISOString() };
  }
}

function writeCounter(data: TicketData): void {
  try {
    writeFileSync(COUNTER_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    logger.error(`Error writing ticket counter: ${error}`);
  }
}

export function getNextTicketNumber(): string {
  const data = readCounter();
  data.counter += 1;
  writeCounter(data);
  
  // Format as 3-digit number (001, 002, etc.)
  const ticketNumber = data.counter.toString().padStart(3, '0');
  logger.info(`Generated ticket number: ${ticketNumber}`);
  
  return ticketNumber;
}

export function getCurrentTicketCount(): number {
  const data = readCounter();
  return data.counter;
}

export function resetTicketCounter(): void {
  const data: TicketData = {
    counter: 0,
    lastReset: new Date().toISOString()
  };
  writeCounter(data);
  logger.info('Ticket counter reset to 0');
}

export function getTicketStats(): TicketData {
  return readCounter();
}