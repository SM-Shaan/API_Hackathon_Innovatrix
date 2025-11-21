import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { Registry, collectDefaultMetrics, Counter, Histogram } from 'prom-client';
import { createLogger } from './logger';
import { createCampaignRoutes } from './routes';
import { CampaignRepository } from './repository';
import { CampaignService } from './service';
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

const logger = createLogger('campaign-service');

const app = express();
const PORT = process.env.PORT || 3002;

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
  res.json({ status: 'healthy', service: 'campaign-service', version: '1.0.0' });
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
const campaignRepository = new CampaignRepository(pool);
const eventBus = new EventBus(redis);
const campaignService = new CampaignService(campaignRepository, eventBus, logger);

// Routes
app.use('/api/campaigns', createCampaignRoutes(campaignService));

// Initialize database and start server
async function start() {
  try {
    await campaignRepository.initialize();
    logger.info('Database initialized');

    await eventBus.start();
    logger.info('Event bus started');

    app.listen(PORT, () => {
      logger.info(`Campaign service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error(error, 'Failed to start campaign service');
    process.exit(1);
  }
}

start();

export { app };
