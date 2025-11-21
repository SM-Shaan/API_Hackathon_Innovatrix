import { IdempotencyService } from '../idempotency';

// Mock Redis
const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

describe('IdempotencyService', () => {
  let idempotencyService: IdempotencyService;

  beforeEach(() => {
    jest.clearAllMocks();
    idempotencyService = new IdempotencyService(mockRedis as any);
  });

  describe('checkWebhook', () => {
    it('should return isNew: true for new webhook', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await idempotencyService.checkWebhook('webhook-123');

      expect(result.isNew).toBe(true);
      expect(result.result).toBeUndefined();
      expect(mockRedis.get).toHaveBeenCalledWith('webhook:webhook-123');
    });

    it('should return existing result for processed webhook', async () => {
      const existingRecord = {
        webhookId: 'webhook-123',
        eventType: 'payment.completed',
        processedAt: '2025-01-01T00:00:00.000Z',
        result: { paymentId: 'pay-456', status: 'completed' },
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(existingRecord));

      const result = await idempotencyService.checkWebhook<{ paymentId: string }>('webhook-123');

      expect(result.isNew).toBe(false);
      expect(result.result).toEqual(existingRecord.result);
    });
  });

  describe('markWebhookProcessed', () => {
    it('should store webhook with TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await idempotencyService.markWebhookProcessed(
        'webhook-123',
        'payment.completed',
        { paymentId: 'pay-456' }
      );

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'webhook:webhook-123',
        expect.any(Number), // TTL
        expect.stringContaining('webhook-123')
      );
    });
  });

  describe('checkAndProcess', () => {
    it('should process new request and store result', async () => {
      mockRedis.set.mockResolvedValue('OK'); // Lock acquired
      mockRedis.get.mockResolvedValue(null); // No existing result
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.del.mockResolvedValue(1);

      const operation = jest.fn().mockResolvedValue({ result: 'success' });

      const result = await idempotencyService.checkAndProcess('key-123', operation);

      expect(result.wasNew).toBe(true);
      expect(result.result).toEqual({ result: 'success' });
      expect(operation).toHaveBeenCalled();
    });

    it('should return cached result for duplicate request', async () => {
      mockRedis.set.mockResolvedValue('OK'); // Lock acquired
      mockRedis.get.mockResolvedValue(JSON.stringify({ result: 'cached' })); // Existing result
      mockRedis.del.mockResolvedValue(1);

      const operation = jest.fn();

      const result = await idempotencyService.checkAndProcess('key-123', operation);

      expect(result.wasNew).toBe(false);
      expect(result.result).toEqual({ result: 'cached' });
      expect(operation).not.toHaveBeenCalled();
    });
  });

  describe('generatePaymentKey', () => {
    it('should generate consistent keys', () => {
      const key1 = IdempotencyService.generatePaymentKey('pledge-123', 'create');
      const key2 = IdempotencyService.generatePaymentKey('pledge-123', 'create');

      expect(key1).toBe(key2);
      expect(key1).toBe('payment:pledge-123:create');
    });

    it('should generate different keys for different operations', () => {
      const key1 = IdempotencyService.generatePaymentKey('pledge-123', 'create');
      const key2 = IdempotencyService.generatePaymentKey('pledge-123', 'capture');

      expect(key1).not.toBe(key2);
    });
  });
});
