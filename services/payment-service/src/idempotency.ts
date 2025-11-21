import Redis from 'ioredis';

export interface IdempotencyResult<T> {
  isNew: boolean;
  result?: T;
}

export interface WebhookIdempotencyRecord {
  webhookId: string;
  eventType: string;
  processedAt: string;
  result: unknown;
}

export class IdempotencyService {
  private redis: Redis;
  private ttlSeconds: number;

  constructor(redis: Redis, ttlSeconds: number = 86400 * 7) { // 7 days for webhooks
    this.redis = redis;
    this.ttlSeconds = ttlSeconds;
  }

  /**
   * Check if a webhook has already been processed
   */
  async checkWebhook<T>(webhookId: string): Promise<IdempotencyResult<T>> {
    const key = `webhook:${webhookId}`;
    const existing = await this.redis.get(key);
    if (existing) {
      const record = JSON.parse(existing) as WebhookIdempotencyRecord;
      return { isNew: false, result: record.result as T };
    }
    return { isNew: true };
  }

  /**
   * Mark a webhook as processed
   */
  async markWebhookProcessed<T>(
    webhookId: string,
    eventType: string,
    result: T
  ): Promise<void> {
    const key = `webhook:${webhookId}`;
    const record: WebhookIdempotencyRecord = {
      webhookId,
      eventType,
      processedAt: new Date().toISOString(),
      result,
    };
    await this.redis.setex(key, this.ttlSeconds, JSON.stringify(record));
  }

  /**
   * Check and process with idempotency guarantee
   */
  async checkAndProcess<T>(
    idempotencyKey: string,
    operation: () => Promise<T>
  ): Promise<{ result: T; wasNew: boolean }> {
    const key = `idempotency:${idempotencyKey}`;

    // Try to acquire lock
    const lockKey = `lock:${idempotencyKey}`;
    const lockAcquired = await this.redis.set(lockKey, '1', 'EX', 30, 'NX');

    if (!lockAcquired) {
      // Another process is handling this request, wait and check result
      await this.sleep(100);
      const existing = await this.redis.get(key);
      if (existing) {
        return { result: JSON.parse(existing) as T, wasNew: false };
      }
      // If still no result, throw error
      throw new Error('Request is being processed by another instance');
    }

    try {
      // Check if already processed
      const existing = await this.redis.get(key);
      if (existing) {
        return { result: JSON.parse(existing) as T, wasNew: false };
      }

      // Process the operation
      const result = await operation();

      // Store result
      await this.redis.setex(key, this.ttlSeconds, JSON.stringify(result));

      return { result, wasNew: true };
    } finally {
      // Release lock
      await this.redis.del(lockKey);
    }
  }

  /**
   * Generate idempotency key for payment operations
   */
  static generatePaymentKey(pledgeId: string, operation: string): string {
    return `payment:${pledgeId}:${operation}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
