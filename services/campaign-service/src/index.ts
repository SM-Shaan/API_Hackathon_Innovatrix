import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { createLogger } from './logger';
import { createCampaignRoutes } from './routes';
import { CampaignRepository } from './repository';
import { CampaignService } from './service';
import { EventBus } from './events';

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
