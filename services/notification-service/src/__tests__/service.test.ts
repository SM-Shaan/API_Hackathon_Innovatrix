import { NotificationService } from '../service';
import { DomainEvent } from '../events';

// Mock dependencies
const mockRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findByUserId: jest.fn(),
  findByEmail: jest.fn(),
  findPending: jest.fn(),
  updateStatus: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
  getUnreadCount: jest.fn(),
  getPreferences: jest.fn(),
  upsertPreferences: jest.fn(),
  initialize: jest.fn(),
};

const mockEmailService = {
  sendEmail: jest.fn(),
};

const mockWsManager = {
  sendToUser: jest.fn(),
  sendToEmail: jest.fn(),
  broadcast: jest.fn(),
  broadcastToAll: jest.fn(),
  getConnectedClients: jest.fn(),
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

describe('NotificationService', () => {
  let notificationService: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    notificationService = new NotificationService(
      mockRepository as any,
      mockEmailService as any,
      mockWsManager as any,
      mockLogger as any
    );
  });

  describe('createNotification', () => {
    it('should create and send email notification', async () => {
      const notification = {
        id: 'notif-123',
        email: 'test@example.com',
        type: 'EMAIL',
        channel: 'donation',
        subject: 'Test Subject',
        content: '<p>Test Content</p>',
        status: 'PENDING',
      };

      mockRepository.create.mockResolvedValue(notification);
      mockEmailService.sendEmail.mockResolvedValue({ success: true, messageId: 'msg-123' });
      mockRepository.updateStatus.mockResolvedValue({ ...notification, status: 'SENT' });

      const result = await notificationService.createNotification({
        email: 'test@example.com',
        type: 'EMAIL',
        channel: 'donation',
        subject: 'Test Subject',
        content: '<p>Test Content</p>',
      });

      expect(result.id).toBe('notif-123');
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test Content</p>',
      });
      expect(mockRepository.updateStatus).toHaveBeenCalledWith('notif-123', 'SENT');
    });

    it('should create and send websocket notification', async () => {
      const notification = {
        id: 'notif-456',
        user_id: 'user-123',
        email: 'test@example.com',
        type: 'WEBSOCKET',
        channel: 'donation',
        subject: 'Real-time Update',
        content: 'You received a donation!',
        status: 'PENDING',
        metadata: {},
      };

      mockRepository.create.mockResolvedValue(notification);
      mockWsManager.sendToUser.mockReturnValue(1);
      mockRepository.updateStatus.mockResolvedValue({ ...notification, status: 'SENT' });

      const result = await notificationService.createNotification({
        user_id: 'user-123',
        email: 'test@example.com',
        type: 'WEBSOCKET',
        channel: 'donation',
        subject: 'Real-time Update',
        content: 'You received a donation!',
      });

      expect(result.id).toBe('notif-456');
      expect(mockWsManager.sendToUser).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          type: 'notification',
          channel: 'donation',
        })
      );
    });

    it('should handle email send failure', async () => {
      const notification = {
        id: 'notif-789',
        email: 'test@example.com',
        type: 'EMAIL',
        channel: 'donation',
        subject: 'Test',
        content: 'Test',
        status: 'PENDING',
      };

      mockRepository.create.mockResolvedValue(notification);
      mockEmailService.sendEmail.mockResolvedValue({ success: false, error: 'SMTP error' });
      mockRepository.updateStatus.mockResolvedValue({ ...notification, status: 'FAILED' });

      await notificationService.createNotification({
        email: 'test@example.com',
        type: 'EMAIL',
        channel: 'donation',
        subject: 'Test',
        content: 'Test',
      });

      expect(mockRepository.updateStatus).toHaveBeenCalledWith('notif-789', 'FAILED');
    });
  });

  describe('handleEvent', () => {
    it('should handle pledge completed event', async () => {
      const event: DomainEvent = {
        id: 'event-123',
        type: 'pledge.completed',
        aggregateType: 'pledge',
        aggregateId: 'pledge-123',
        payload: {
          donorEmail: 'donor@example.com',
          donorName: 'John Doe',
          amount: 100,
          campaignTitle: 'Test Campaign',
          pledgeId: 'pledge-123',
        },
        timestamp: new Date().toISOString(),
      };

      mockRepository.create.mockResolvedValue({
        id: 'notif-123',
        email: 'donor@example.com',
        type: 'EMAIL',
        status: 'PENDING',
      });
      mockEmailService.sendEmail.mockResolvedValue({ success: true });
      mockRepository.updateStatus.mockResolvedValue({});

      await notificationService.handleEvent(event);

      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockEmailService.sendEmail).toHaveBeenCalled();
    });

    it('should broadcast unknown events to websocket', async () => {
      const event: DomainEvent = {
        id: 'event-456',
        type: 'unknown.event',
        aggregateType: 'unknown',
        aggregateId: 'unknown-123',
        payload: { data: 'test' },
        timestamp: new Date().toISOString(),
      };

      await notificationService.handleEvent(event);

      expect(mockWsManager.broadcast).toHaveBeenCalledWith(
        'global',
        expect.objectContaining({
          type: 'event',
          channel: 'global',
        })
      );
    });
  });

  describe('getNotifications', () => {
    it('should get notifications by user ID', async () => {
      const notifications = [
        { id: 'notif-1', user_id: 'user-123' },
        { id: 'notif-2', user_id: 'user-123' },
      ];

      mockRepository.findByUserId.mockResolvedValue(notifications);

      const result = await notificationService.getNotifications('user-123');

      expect(result).toHaveLength(2);
      expect(mockRepository.findByUserId).toHaveBeenCalledWith('user-123', 50);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const notification = { id: 'notif-123', status: 'READ' };
      mockRepository.markAsRead.mockResolvedValue(notification);

      const result = await notificationService.markAsRead('notif-123');

      expect(result?.status).toBe('READ');
      expect(mockRepository.markAsRead).toHaveBeenCalledWith('notif-123');
    });
  });

  describe('getWebSocketStats', () => {
    it('should return connected client count', () => {
      mockWsManager.getConnectedClients.mockReturnValue(5);

      const stats = notificationService.getWebSocketStats();

      expect(stats.connectedClients).toBe(5);
    });
  });
});
