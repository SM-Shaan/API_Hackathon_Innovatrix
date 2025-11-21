import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { Registry, collectDefaultMetrics, Counter, Histogram } from 'prom-client';
import { createLogger } from './logger';
import { createPledgeRoutes } from './routes';
import { PledgeRepository } from './repository';
import { OutboxRepository } from './outbox';
import { PledgeService } from './service';
import { IdempotencyService } from './idempotency';
import { OutboxWorker } from './outbox-worker';

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

const logger = createLogger('pledge-service');

const app = express();
const PORT = process.env.PORT || 3003;

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
  res.json({ status: 'healthy', service: 'pledge-service', version: '1.0.0' });
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
const pledgeRepository = new PledgeRepository(pool);
const outboxRepository = new OutboxRepository(pool);
const idempotencyService = new IdempotencyService(redis);
const pledgeService = new PledgeService(
  pledgeRepository,
  outboxRepository,
  idempotencyService,
  pool,
  logger
);

// Outbox worker for reliable event publishing
const outboxWorker = new OutboxWorker(outboxRepository, redis, logger);

// Routes
app.use('/api/pledges', createPledgeRoutes(pledgeService));

// Initialize database and start server
async function start() {
  try {
    await pledgeRepository.initialize();
    await outboxRepository.initialize();
    logger.info('Database initialized');

    // Start outbox worker
    outboxWorker.start();
    logger.info('Outbox worker started');

    app.listen(PORT, () => {
      logger.info(`Pledge service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error(error, 'Failed to start pledge service');
    process.exit(1);
  }
}

start();

export { app };
