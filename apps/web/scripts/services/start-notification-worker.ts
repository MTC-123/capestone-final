#!/usr/bin/env tsx
/**
 * Notification Worker Startup Script
 *
 * This script starts the background worker that processes WhatsApp notification jobs
 * from the Redis queue. Run this as a separate process alongside the main application.
 *
 * Usage:
 *   npm run worker:start
 *   OR
 *   tsx scripts/start-notification-worker.ts
 *
 * Environment Variables:
 *   REDIS_URL - Redis connection URL (default: redis://localhost:6379)
 *   TWILIO_ACCOUNT_SID - Twilio account SID
 *   TWILIO_AUTH_TOKEN - Twilio auth token
 *   TWILIO_WHATSAPP_NUMBER - WhatsApp sender number
 */

import { startNotificationWorker, stopNotificationWorker } from '../../src/lib/notifications/worker';
import { closeRedisConnection } from '../../src/lib/notifications/queue';

console.log('RICER Notification Worker');
console.log('=========================');
console.log(`Started at: ${new Date().toISOString()}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Redis URL: ${process.env.REDIS_URL || 'redis://localhost:6379'}`);
console.log('');

// Start the worker
startNotificationWorker();

// Graceful shutdown
const shutdown = async () => {
  console.log('\nShutting down worker...');
  stopNotificationWorker();
  await closeRedisConnection();
  console.log('Worker stopped');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Keep the process alive
process.stdin.resume();

console.log('Worker is running. Press Ctrl+C to stop.');
