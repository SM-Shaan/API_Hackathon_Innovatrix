import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { Pool } from 'pg';
import { createLogger } from './logger';
import { createUserRoutes } from './routes';
import { UserRepository } from './repository';
import { UserService } from './service';

const logger = createLogger('user-service');

const app = express();
const PORT = process.env.PORT || 3001;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'careforall',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(pinoHttp({ logger }));

// Health check
app.get('/health', (_, res) => {
  res.json({ status: 'healthy', service: 'user-service', version: '1.0.0' });
});

// Initialize services
const userRepository = new UserRepository(pool);
const userService = new UserService(userRepository, logger);

// Routes
app.use('/api/users', createUserRoutes(userService));

// Initialize database and start server
async function start() {
  try {
    // Initialize database tables
    await userRepository.initialize();
    logger.info('Database initialized');

    app.listen(PORT, () => {
      logger.info(`User service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error(error, 'Failed to start user service');
    process.exit(1);
  }
}

start();

export { app };
