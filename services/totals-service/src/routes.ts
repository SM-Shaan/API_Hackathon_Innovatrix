import { Router, Request, Response } from 'express';
import { TotalsService } from './service';

export const createTotalsRoutes = (totalsService: TotalsService) => {
  const router = Router();

  // Get all campaign totals
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const totals = await totalsService.getAllTotals();
      res.json(totals);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get totals' });
    }
  });

  // Get stats
  router.get('/stats', async (_req: Request, res: Response) => {
    try {
      const stats = await totalsService.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get stats' });
    }
  });

  // Get total for specific campaign
  router.get('/campaign/:campaignId', async (req: Request, res: Response) => {
    try {
      const total = await totalsService.getTotal(req.params.campaignId);
      if (!total) {
        return res.json({
          campaign_id: req.params.campaignId,
          total_amount: 0,
          pledge_count: 0,
        });
      }
      res.json(total);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get campaign total' });
    }
  });

  // Rebuild totals from pledges (admin operation)
  router.post('/rebuild', async (_req: Request, res: Response) => {
    try {
      await totalsService.rebuildTotals();
      res.json({ message: 'Totals rebuilt successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to rebuild totals' });
    }
  });

  return router;
};
