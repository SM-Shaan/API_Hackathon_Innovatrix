import { Router, Request, Response } from 'express';
import { NotificationService } from './service';
import { Logger } from './logger';

export const createNotificationRoutes = (
  notificationService: NotificationService,
  logger: Logger
) => {
  const router = Router();

  /**
   * GET /api/notifications
   * Get notifications for current user
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      const email = req.query.email as string;
      const limit = parseInt(req.query.limit as string) || 50;

      if (!userId && !email) {
        return res.status(400).json({ error: 'userId or email is required' });
      }

      const notifications = userId
        ? await notificationService.getNotifications(userId, limit)
        : await notificationService.getNotificationsByEmail(email, limit);

      res.json(notifications);
    } catch (error) {
      logger.error({ error }, 'Failed to get notifications');
      res.status(500).json({ error: 'Failed to get notifications' });
    }
  });

  /**
   * GET /api/notifications/unread/count
   * Get unread notification count
   */
  router.get('/unread/count', async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const count = await notificationService.getUnreadCount(userId);
      res.json({ unreadCount: count });
    } catch (error) {
      logger.error({ error }, 'Failed to get unread count');
      res.status(500).json({ error: 'Failed to get unread count' });
    }
  });

  /**
   * POST /api/notifications/:id/read
   * Mark notification as read
   */
  router.post('/:id/read', async (req: Request, res: Response) => {
    try {
      const notification = await notificationService.markAsRead(req.params.id);

      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      res.json(notification);
    } catch (error) {
      logger.error({ error }, 'Failed to mark notification as read');
      res.status(500).json({ error: 'Failed to mark as read' });
    }
  });

  /**
   * POST /api/notifications/read-all
   * Mark all notifications as read for a user
   */
  router.post('/read-all', async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const count = await notificationService.markAllAsRead(userId);
      res.json({ markedAsRead: count });
    } catch (error) {
      logger.error({ error }, 'Failed to mark all as read');
      res.status(500).json({ error: 'Failed to mark all as read' });
    }
  });

  /**
   * POST /api/notifications/send
   * Manually send a notification (admin)
   */
  router.post('/send', async (req: Request, res: Response) => {
    try {
      const { email, type, channel, subject, content, userId, metadata } = req.body;

      if (!email || !type || !subject || !content) {
        return res.status(400).json({
          error: 'email, type, subject, and content are required',
        });
      }

      const notification = await notificationService.createNotification({
        user_id: userId,
        email,
        type,
        channel: channel || 'manual',
        subject,
        content,
        metadata,
      });

      res.status(201).json(notification);
    } catch (error) {
      logger.error({ error }, 'Failed to send notification');
      res.status(500).json({ error: 'Failed to send notification' });
    }
  });

  /**
   * GET /api/notifications/stats
   * Get notification service stats
   */
  router.get('/stats', async (_req: Request, res: Response) => {
    try {
      const wsStats = notificationService.getWebSocketStats();
      res.json({
        websocket: wsStats,
        status: 'healthy',
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get stats');
      res.status(500).json({ error: 'Failed to get stats' });
    }
  });

  return router;
};
