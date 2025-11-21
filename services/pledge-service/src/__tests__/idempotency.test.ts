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

  describe('check', () => {
    it('should return isNew: true for new keys', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await idempotencyService.check('new-key');

      expect(result.isNew).toBe(true);
      expect(result.result).toBeUndefined();
    });

    it('should return existing result for duplicate keys', async () => {
      const existingResult = { pledgeId: '123', amount: 100 };
      mockRedis.get.mockResolvedValue(JSON.stringify(existingResult));

      const result = await idempotencyService.check('existing-key');

      expect(result.isNew).toBe(false);
      expect(result.result).toEqual(existingResult);
    });
  });

  describe('set', () => {
    it('should store result with TTL', async () => {
      const key = 'test-key';
      const result = { success: true };

      await idempotencyService.set(key, result);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `idempotency:${key}`,
        86400,
        JSON.stringify(result)
      );
    });
  });

  describe('lock', () => {
    it('should acquire lock successfully', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await idempotencyService.lock('test-key');

      expect(result).toBe(true);
    });

    it('should fail to acquire lock if already locked', async () => {
      mockRedis.set.mockResolvedValue(null);

      const result = await idempotencyService.lock('test-key');

      expect(result).toBe(false);
    });
  });
});
