import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { Registry, collectDefaultMetrics, Counter, Histogram } from 'prom-client';
import { createLogger } from './logger';
import { createPaymentRoutes } from './routes';
import { PaymentRepository } from './repository';
import { PaymentService } from './service';
import { IdempotencyService } from './idempotency';
import { EventBus, PaymentEventTypes } from './events';

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

const logger = createLogger('payment-service');

const app = express();
const PORT = process.env.PORT || 3004;

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
    service: 'payment-service',
    version: '1.0.0',
    features: [
      'idempotent-webhooks',
      'state-machine',
      'event-driven',
    ],
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
const paymentRepository = new PaymentRepository(pool);
const idempotencyService = new IdempotencyService(redis);
const eventBus = new EventBus(redis, logger);
const paymentService = new PaymentService(
  paymentRepository,
  idempotencyService,
  eventBus,
  pool,
  logger
);

// Routes
app.use('/api/payments', createPaymentRoutes(paymentService, logger));

// Subscribe to pledge events
function setupEventHandlers() {
  // Listen for pledge creation events to auto-create payments
  eventBus.subscribe(PaymentEventTypes.PLEDGE_CREATED, async (event) => {
    logger.info({ event }, 'Received pledge created event');

    try {
      // Auto-initiate payment when pledge is created
      const { pledgeId, amount, donorEmail, campaignId, idempotencyKey } = event.payload;

      await paymentService.initiatePayment({
        pledge_id: pledgeId as string,
        amount: amount as number,
        idempotency_key: idempotencyKey as string || `pledge-${pledgeId}`,
        donor_email: donorEmail as string,
        campaign_id: campaignId as string,
      });

      logger.info({ pledgeId }, 'Payment initiated for pledge');
    } catch (error) {
      logger.error({ error, event }, 'Failed to initiate payment for pledge');
    }
  });

  // Listen for payment requested events
  eventBus.subscribe(PaymentEventTypes.PLEDGE_PAYMENT_REQUESTED, async (event) => {
    logger.info({ event }, 'Received payment request event');

    try {
      const { pledgeId, amount, idempotencyKey } = event.payload;

      await paymentService.initiatePayment({
        pledge_id: pledgeId as string,
        amount: amount as number,
        idempotency_key: idempotencyKey as string,
      });
    } catch (error) {
      logger.error({ error, event }, 'Failed to process payment request');
    }
  });
}

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down payment service...');
  await eventBus.close();
  await redis.quit();
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Initialize database and start server
async function start() {
  try {
    // Initialize database tables
    await paymentRepository.initialize();
    logger.info('Database initialized');

    // Start event bus
    await eventBus.start();
    setupEventHandlers();
    logger.info('Event bus started and handlers registered');

    app.listen(PORT, () => {
      logger.info(`Payment service running on port ${PORT}`);
      logger.info('Key features:');
      logger.info('  - Idempotent webhook processing');
      logger.info('  - Payment state machine (PENDING -> AUTHORIZED -> CAPTURED -> COMPLETED)');
      logger.info('  - Event-driven architecture');
    });
  } catch (error) {
    logger.error(error, 'Failed to start payment service');
    process.exit(1);
  }
}

start();

export { app };
