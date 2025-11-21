import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { CampaignService } from './service';

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

export const createCampaignRoutes = (campaignService: CampaignService) => {
  const router = Router();

  // Get all campaigns
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { status } = req.query;
      const campaigns = await campaignService.getAll(status as string);
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get campaigns' });
    }
  });

  // Get campaign stats (admin)
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const stats = await campaignService.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get stats' });
    }
  });

  // Get campaign by ID
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const campaign = await campaignService.getById(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      res.json(campaign);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get campaign' });
    }
  });

  // Create campaign (authenticated)
  router.post('/', async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const { title, description, goal_amount, image_url } = req.body;

      if (!title || !goal_amount) {
        return res.status(400).json({ error: 'Title and goal amount are required' });
      }

      const campaign = await campaignService.create({
        title,
        description,
        goal_amount: parseFloat(goal_amount),
        owner_id: decoded.userId,
        image_url,
      });

      res.status(201).json(campaign);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create campaign' });
    }
  });

  // Update campaign (owner or admin only)
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Check ownership or admin
      const existing = await campaignService.getById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      if (existing.owner_id !== decoded.userId && decoded.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Not authorized to update this campaign' });
      }

      const { title, description, goal_amount, status, image_url } = req.body;

      const campaign = await campaignService.update(req.params.id, {
        title,
        description,
        goal_amount: goal_amount ? parseFloat(goal_amount) : undefined,
        status,
        image_url,
      });

      res.json(campaign);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update campaign' });
    }
  });

  // Delete campaign (owner or admin only)
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Check ownership or admin
      const existing = await campaignService.getById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      if (existing.owner_id !== decoded.userId && decoded.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Not authorized to delete this campaign' });
      }

      await campaignService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete campaign' });
    }
  });

  // Update campaign amount (internal use)
  router.post('/:id/amount', async (req: Request, res: Response) => {
    try {
      const { amount } = req.body;
      if (typeof amount !== 'number') {
        return res.status(400).json({ error: 'Amount is required' });
      }

      const campaign = await campaignService.updateAmount(req.params.id, amount);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      res.json(campaign);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update campaign amount' });
    }
  });

  // Get campaigns by owner
  router.get('/owner/:ownerId', async (req: Request, res: Response) => {
    try {
      const campaigns = await campaignService.getByOwner(req.params.ownerId);
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get campaigns' });
    }
  });

  return router;
};
