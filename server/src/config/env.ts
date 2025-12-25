// server/src/config/env.ts
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Environment configuration
 * All environment variables are loaded and validated here
 */
export const ENV = {
  // Server
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  
  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  
  // Game settings (can override defaults)
  MAX_ROOMS: parseInt(process.env.MAX_ROOMS || '1000', 10),
  MAX_PLAYERS_PER_ROOM: parseInt(process.env.MAX_PLAYERS_PER_ROOM || '4', 10),
  ROOM_CLEANUP_INTERVAL: parseInt(process.env.ROOM_CLEANUP_INTERVAL || '300000', 10), // 5 min
  INACTIVE_ROOM_TIMEOUT: parseInt(process.env.INACTIVE_ROOM_TIMEOUT || '1800000', 10), // 30 min
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  ENABLE_REQUEST_LOGGING: process.env.ENABLE_REQUEST_LOGGING === 'true',
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 min
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
} as const;

/**
 * Validate environment configuration
 */
export function validateEnv(): void {
  const errors: string[] = [];

  if (ENV.PORT < 1 || ENV.PORT > 65535) {
    errors.push('PORT must be between 1 and 65535');
  }

  if (ENV.MAX_ROOMS < 1) {
    errors.push('MAX_ROOMS must be at least 1');
  }

  if (errors.length > 0) {
    console.error('❌ Environment validation failed:');
    errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }

  console.log('✅ Environment validation passed');
}

/**
 * Check if we're in production
 */
export function isProduction(): boolean {
  return ENV.NODE_ENV === 'production';
}

/**
 * Check if we're in development
 */
export function isDevelopment(): boolean {
  return ENV.NODE_ENV === 'development';
}