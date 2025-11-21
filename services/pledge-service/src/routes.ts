import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { PledgeService } from './service';

const JWT_SECRET = process.env.JWT_SECRET || 'careforall-secret-key-change-in-production';

interface TokenPayload {
  userId: string;
  email: string;
  role: 'ADMIN' | 'DONOR';
}

const verifyToken = (token: string): TokenPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
};

export const createPledgeRoutes = (pledgeService: PledgeService) => {
  const router = Router();

  // Create a new pledge/donation
  router.post('/', async (req: Request, res: Response) => {
    try {
      const {
        campaign_id,
        donor_email,
        donor_name,
        amount,
        message,
        idempotency_key
      } = req.body;

      // Validate required fields
      if (!campaign_id || !donor_email || !donor_name || !amount) {
        return res.status(400).json({
          error: 'campaign_id, donor_email, donor_name, and amount are required'
        });
      }

      // Get donor_id from token if authenticated
      let donor_id: string | null = null;
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        const decoded = verifyToken(token);
        if (decoded) {
          donor_id = decoded.userId;
        }
      }

      // Generate idempotency key if not provided
      const finalIdempotencyKey = idempotency_key || uuidv4();

      const { pledge, wasNew } = await pledgeService.create({
        campaign_id,
        donor_id,
        donor_email,
        donor_name,
        amount: parseFloat(amount),
        idempotency_key: finalIdempotencyKey,
        message,
      });

      res.status(wasNew ? 201 : 200).json({
        pledge,
        idempotent: !wasNew,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create pledge';
      res.status(500).json({ error: message });
    }
  });

  // Get pledge stats (admin)
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const stats = await pledgeService.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get stats' });
    }
  });

  // Get all pledges (admin)
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { status } = req.query;
      const pledges = await pledgeService.getAll(status as string);
      res.json(pledges);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get pledges' });
    }
  });

  // Get pledge by ID
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const pledge = await pledgeService.getById(req.params.id);
      if (!pledge) {
        return res.status(404).json({ error: 'Pledge not found' });
      }
      res.json(pledge);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get pledge' });
    }
  });

  // Get pledges by campaign
  router.get('/campaign/:campaignId', async (req: Request, res: Response) => {
    try {
      const pledges = await pledgeService.getByCampaign(req.params.campaignId);
      res.json(pledges);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get pledges' });
    }
  });

  // Get pledges by donor (authenticated)
  router.get('/donor/me', async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const pledges = await pledgeService.getByDonor(decoded.userId);
      res.json(pledges);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get pledges' });
    }
  });

  // Get pledges by email (for unregistered users)
  router.get('/email/:email', async (req: Request, res: Response) => {
    try {
      const pledges = await pledgeService.getByEmail(req.params.email);
      res.json(pledges);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get pledges' });
    }
  });

  // Mark pledge as completed (internal use / webhook)
  router.post('/:id/complete', async (req: Request, res: Response) => {
    try {
      const pledge = await pledgeService.markCompleted(req.params.id);
      if (!pledge) {
        return res.status(404).json({ error: 'Pledge not found' });
      }
      res.json(pledge);
    } catch (error) {
      res.status(500).json({ error: 'Failed to complete pledge' });
    }
  });

  // Mark pledge as failed (internal use / webhook)
  router.post('/:id/fail', async (req: Request, res: Response) => {
    try {
      const pledge = await pledgeService.markFailed(req.params.id);
      if (!pledge) {
        return res.status(404).json({ error: 'Pledge not found' });
      }
      res.json(pledge);
    } catch (error) {
      res.status(500).json({ error: 'Failed to mark pledge as failed' });
    }
  });

  return router;
};
