import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { createLogger } from './logger';
import { createTotalsRoutes } from './routes';
import { TotalsRepository } from './repository';
import { TotalsService } from './service';
import { EventSubscriber } from './event-subscriber';

const logger = createLogger('totals-service');

const app = express();
const PORT = process.env.PORT || 3005;

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
  res.json({ status: 'healthy', service: 'totals-service', version: '1.0.0' });
});

// Initialize services
const totalsRepository = new TotalsRepository(pool, redis);
const totalsService = new TotalsService(totalsRepository, logger);
const eventSubscriber = new EventSubscriber(redis, totalsService, logger);

// Routes
app.use('/api/totals', createTotalsRoutes(totalsService));

// Initialize and start server
async function start() {
  try {
    await totalsRepository.initialize();
    logger.info('Database initialized');

    await eventSubscriber.start();
    logger.info('Event subscriber started');

    app.listen(PORT, () => {
      logger.info(`Totals service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error(error, 'Failed to start totals service');
    process.exit(1);
  }
}

start();

export { app };
