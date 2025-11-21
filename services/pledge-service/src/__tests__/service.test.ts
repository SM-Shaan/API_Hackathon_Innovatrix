import { PledgeService } from '../service';

describe('PledgeService', () => {
  let pledgeService: PledgeService;
  let mockPledgeRepository: any;
  let mockOutboxRepository: any;
  let mockIdempotencyService: any;
  let mockPool: any;
  let mockLogger: any;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
    };

    mockPledgeRepository = {
      create: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      findById: jest.fn(),
      findByCampaign: jest.fn(),
      findByDonor: jest.fn(),
      findByEmail: jest.fn(),
      findAll: jest.fn(),
      updateStatus: jest.fn(),
    };

    mockOutboxRepository = {
      create: jest.fn(),
    };

    mockIdempotencyService = {
      lock: jest.fn(),
      unlock: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    pledgeService = new PledgeService(
      mockPledgeRepository,
      mockOutboxRepository,
      mockIdempotencyService,
      mockPool,
      mockLogger
    );
  });

  describe('create', () => {
    const dto = {
      campaign_id: 'campaign-123',
      donor_email: 'donor@example.com',
      donor_name: 'John Doe',
      amount: 100,
      idempotency_key: 'idem-key-123',
    };

    it('should return existing pledge for duplicate idempotency key', async () => {
      const existingPledge = {
        id: 'pledge-123',
        ...dto,
        donor_id: null,
        status: 'PENDING',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPledgeRepository.findByIdempotencyKey.mockResolvedValue(existingPledge);

      const result = await pledgeService.create(dto);

      expect(result.wasNew).toBe(false);
      expect(result.pledge).toEqual(existingPledge);
      expect(mockPledgeRepository.create).not.toHaveBeenCalled();
    });

    it('should create new pledge with outbox event in transaction', async () => {
      const newPledge = {
        id: 'pledge-456',
        ...dto,
        donor_id: null,
        status: 'PENDING',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPledgeRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockIdempotencyService.lock.mockResolvedValue(true);
      mockPledgeRepository.create.mockResolvedValue(newPledge);
      mockClient.query.mockResolvedValue({});

      const result = await pledgeService.create(dto);

      expect(result.wasNew).toBe(true);
      expect(result.pledge).toEqual(newPledge);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockOutboxRepository.create).toHaveBeenCalled();
      expect(mockIdempotencyService.unlock).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      mockPledgeRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockIdempotencyService.lock.mockResolvedValue(true);
      mockPledgeRepository.create.mockRejectedValue(new Error('DB error'));

      await expect(pledgeService.create(dto)).rejects.toThrow('DB error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockIdempotencyService.unlock).toHaveBeenCalled();
    });
  });

  describe('markCompleted', () => {
    it('should update status and create outbox event', async () => {
      const pledge = {
        id: 'pledge-123',
        campaign_id: 'campaign-123',
        amount: 100,
        status: 'COMPLETED',
      };

      mockPledgeRepository.updateStatus.mockResolvedValue(pledge);

      const result = await pledgeService.markCompleted('pledge-123');

      expect(result).toEqual(pledge);
      expect(mockOutboxRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'pledge.completed',
        }),
        mockClient
      );
    });
  });
});
