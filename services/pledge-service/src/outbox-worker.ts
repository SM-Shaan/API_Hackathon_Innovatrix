import Redis from 'ioredis';
import { OutboxRepository } from './outbox';
import { Logger } from './logger';

export class OutboxWorker {
  private running = false;
  private intervalMs: number;

  constructor(
    private outboxRepository: OutboxRepository,
    private redis: Redis,
    private logger: Logger,
    intervalMs: number = 1000
  ) {
    this.intervalMs = intervalMs;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.process();
  }

  stop(): void {
    this.running = false;
  }

  private async process(): Promise<void> {
    while (this.running) {
      try {
        await this.publishPendingEvents();
        await this.cleanup();
      } catch (error) {
        this.logger.error(error, 'Outbox worker error');
      }
      await this.sleep(this.intervalMs);
    }
  }

  private async publishPendingEvents(): Promise<void> {
    const events = await this.outboxRepository.findUnpublished(50);

    if (events.length === 0) return;

    const publishedIds: string[] = [];

    for (const event of events) {
      try {
        // Publish to Redis pub/sub
        await this.redis.publish('events', JSON.stringify({
          id: event.id,
          type: event.event_type,
          aggregateType: event.aggregate_type,
          aggregateId: event.aggregate_id,
          payload: event.payload,
          timestamp: event.created_at.toISOString(),
        }));

        publishedIds.push(event.id);
        this.logger.debug({ eventId: event.id, type: event.event_type }, 'Event published');
      } catch (error) {
        this.logger.error({ eventId: event.id, error }, 'Failed to publish event');
      }
    }

    if (publishedIds.length > 0) {
      await this.outboxRepository.markMultipleAsPublished(publishedIds);
      this.logger.info({ count: publishedIds.length }, 'Published outbox events');
    }
  }

  private async cleanup(): Promise<void> {
    // Clean up old published events every hour (check every run but only delete if time)
    const lastCleanupKey = 'outbox:last_cleanup';
    const lastCleanup = await this.redis.get(lastCleanupKey);
    const now = Date.now();

    if (!lastCleanup || now - parseInt(lastCleanup) > 3600000) {
      const deleted = await this.outboxRepository.deletePublished(24);
      if (deleted > 0) {
        this.logger.info({ deleted }, 'Cleaned up old outbox events');
      }
      await this.redis.set(lastCleanupKey, now.toString());
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
