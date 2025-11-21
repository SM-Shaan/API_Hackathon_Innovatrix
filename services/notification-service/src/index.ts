import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import pinoHttp from 'pino-http';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { Registry, collectDefaultMetrics, Counter, Histogram } from 'prom-client';
import { createLogger } from './logger';
import { createNotificationRoutes } from './routes';
import { NotificationRepository } from './repository';
import { NotificationService } from './service';
import { EmailService } from './email';
import { WebSocketManager } from './websocket';
import { EventBus } from './events';

// Prometheus metrics setup
const register = new Registry();
collectDefaultMetrics({ register });

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

const logger = createLogger('notification-service');

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3006;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'careforall',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// Redis connection
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Middleware
app.use(cors());
app.use(express.json());
app.use(pinoHttp({ logger }));

// Health check
app.get('/health', (_, res) => {
  res.json({
    status: 'healthy',
    service: 'notification-service',
    version: '1.0.0',
    features: ['email', 'websocket', 'event-driven'],
  });
});

// Prometheus metrics endpoint
app.get('/metrics', async (_, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestsTotal.inc({ method: req.method, route: req.path, status: res.statusCode });
    httpRequestDuration.observe({ method: req.method, route: req.path, status: res.statusCode }, duration);
  });
  next();
});

// Initialize services
const notificationRepository = new NotificationRepository(pool);
const emailService = new EmailService(logger);
const wsManager = new WebSocketManager(server, logger);
const eventBus = new EventBus(redis, logger);
const notificationService = new NotificationService(
  notificationRepository,
  emailService,
  wsManager,
  logger
);

// Routes
app.use('/api/notifications', createNotificationRoutes(notificationService, logger));

// Setup event handlers
function setupEventHandlers() {
  // Subscribe to all events for real-time notifications
  eventBus.subscribeAll(async (event) => {
    await notificationService.handleEvent(event);
  });
}

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down notification service...');
  await eventBus.close();
  await redis.quit();
  await pool.end();
  server.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Initialize database and start server
async function start() {
  try {
    // Initialize database tables
    await notificationRepository.initialize();
    logger.info('Database initialized');

    // Start event bus
    await eventBus.start();
    setupEventHandlers();
    logger.info('Event bus started - listening for events');

    server.listen(PORT, () => {
      logger.info(`Notification service running on port ${PORT}`);
      logger.info('Features:');
      logger.info('  - Email notifications (SMTP/demo mode)');
      logger.info('  - WebSocket real-time updates (ws://localhost:${PORT}/ws)');
      logger.info('  - Event-driven notifications');
    });
  } catch (error) {
    logger.error(error, 'Failed to start notification service');
    process.exit(1);
  }
}

start();

export { app, server };
