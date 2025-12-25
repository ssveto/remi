// server/src/utils/logger.ts
import { ENV } from '../config/env';

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Simple logger utility
 */
export class Logger {
  private minLevel: LogLevel;

  constructor(minLevel: LogLevel = LogLevel.INFO) {
    this.minLevel = minLevel;
  }

  debug(message: string, ...args: any[]): void {
    if (this.minLevel <= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${this.timestamp()} ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.minLevel <= LogLevel.INFO) {
      console.log(`[INFO] ${this.timestamp()} ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.minLevel <= LogLevel.WARN) {
      console.warn(`[WARN] ${this.timestamp()} ${message}`, ...args);
    }
  }

  error(message: string, error?: Error | any, ...args: any[]): void {
    if (this.minLevel <= LogLevel.ERROR) {
      console.error(`[ERROR] ${this.timestamp()} ${message}`, ...args);
      if (error) {
        console.error(error);
      }
    }
  }

  gameEvent(event: string, data?: any): void {
    if (ENV.NODE_ENV === 'development') {
      console.log(`[GAME] ${this.timestamp()} ${event}`, data || '');
    }
  }

  private timestamp(): string {
    return new Date().toISOString();
  }
}

// Create default logger instance
const logLevel = ENV.LOG_LEVEL === 'debug' ? LogLevel.DEBUG :
                 ENV.LOG_LEVEL === 'warn' ? LogLevel.WARN :
                 ENV.LOG_LEVEL === 'error' ? LogLevel.ERROR :
                 LogLevel.INFO;

export const logger = new Logger(logLevel);