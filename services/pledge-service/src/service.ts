import { Pool } from 'pg';
import { PledgeRepository, Pledge, CreatePledgeDto } from './repository';
import { OutboxRepository, EventTypes } from './outbox';
import { IdempotencyService } from './idempotency';
import { Logger } from './logger';

export class PledgeService {
  constructor(
    private pledgeRepository: PledgeRepository,
    private outboxRepository: OutboxRepository,
    private idempotencyService: IdempotencyService,
    private pool: Pool,
    private logger: Logger
  ) {}

  async create(dto: CreatePledgeDto): Promise<{ pledge: Pledge; wasNew: boolean }> {
    this.logger.info({
      campaignId: dto.campaign_id,
      idempotencyKey: dto.idempotency_key
    }, 'Creating pledge');

    // Check idempotency - return existing pledge if already processed
    const existing = await this.pledgeRepository.findByIdempotencyKey(dto.idempotency_key);
    if (existing) {
      this.logger.info({
        pledgeId: existing.id,
        idempotencyKey: dto.idempotency_key
      }, 'Returning existing pledge (idempotent)');
      return { pledge: existing, wasNew: false };
    }

    // Try to acquire lock to prevent race conditions
    const lockAcquired = await this.idempotencyService.lock(dto.idempotency_key);
    if (!lockAcquired) {
      // Another request is processing this key, wait and check again
      await this.sleep(100);
      const existingAfterWait = await this.pledgeRepository.findByIdempotencyKey(dto.idempotency_key);
      if (existingAfterWait) {
        return { pledge: existingAfterWait, wasNew: false };
      }
      throw new Error('Could not acquire lock for pledge creation');
    }

    try {
      // Use transaction to ensure atomicity: pledge + outbox event
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        // Create pledge
        const pledge = await this.pledgeRepository.create(dto, client);

        // Create outbox event (in same transaction)
        await this.outboxRepository.create({
          aggregate_type: 'pledge',
          aggregate_id: pledge.id,
          event_type: EventTypes.PLEDGE_CREATED,
          payload: {
            pledgeId: pledge.id,
            campaignId: pledge.campaign_id,
            donorId: pledge.donor_id,
            donorEmail: pledge.donor_email,
            donorName: pledge.donor_name,
            amount: pledge.amount,
          },
        }, client);

        await client.query('COMMIT');

        this.logger.info({ pledgeId: pledge.id }, 'Pledge created successfully');
        return { pledge, wasNew: true };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } finally {
      await this.idempotencyService.unlock(dto.idempotency_key);
    }
  }

  async getById(id: string): Promise<Pledge | null> {
    return this.pledgeRepository.findById(id);
  }

  async getByCampaign(campaignId: string): Promise<Pledge[]> {
    return this.pledgeRepository.findByCampaign(campaignId);
  }

  async getByDonor(donorId: string): Promise<Pledge[]> {
    return this.pledgeRepository.findByDonor(donorId);
  }

  async getByEmail(email: string): Promise<Pledge[]> {
    return this.pledgeRepository.findByEmail(email);
  }

  async getAll(status?: string): Promise<Pledge[]> {
    return this.pledgeRepository.findAll(status);
  }

  async markCompleted(id: string): Promise<Pledge | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const pledge = await this.pledgeRepository.updateStatus(id, 'COMPLETED', client);

      if (pledge) {
        await this.outboxRepository.create({
          aggregate_type: 'pledge',
          aggregate_id: pledge.id,
          event_type: EventTypes.PLEDGE_COMPLETED,
          payload: {
            pledgeId: pledge.id,
            campaignId: pledge.campaign_id,
            amount: pledge.amount,
          },
        }, client);
      }

      await client.query('COMMIT');
      return pledge;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async markFailed(id: string): Promise<Pledge | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const pledge = await this.pledgeRepository.updateStatus(id, 'FAILED', client);

      if (pledge) {
        await this.outboxRepository.create({
          aggregate_type: 'pledge',
          aggregate_id: pledge.id,
          event_type: EventTypes.PLEDGE_FAILED,
          payload: {
            pledgeId: pledge.id,
            campaignId: pledge.campaign_id,
          },
        }, client);
      }

      await client.query('COMMIT');
      return pledge;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getStats(): Promise<{
    total: number;
    pending: number;
    completed: number;
    failed: number;
    totalAmount: number;
  }> {
    const pledges = await this.pledgeRepository.findAll();
    return {
      total: pledges.length,
      pending: pledges.filter(p => p.status === 'PENDING' || p.status === 'PROCESSING').length,
      completed: pledges.filter(p => p.status === 'COMPLETED').length,
      failed: pledges.filter(p => p.status === 'FAILED').length,
      totalAmount: pledges
        .filter(p => p.status === 'COMPLETED')
        .reduce((sum, p) => sum + p.amount, 0),
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
