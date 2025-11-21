import Redis from 'ioredis';

export interface IdempotencyResult<T> {
  isNew: boolean;
  result?: T;
}

export class IdempotencyService {
  private redis: Redis;
  private ttlSeconds: number;

  constructor(redisUrl: string, ttlSeconds: number = 86400) {
    this.redis = new Redis(redisUrl);
    this.ttlSeconds = ttlSeconds;
  }

  async check<T>(key: string): Promise<IdempotencyResult<T>> {
    const existing = await this.redis.get(`idempotency:${key}`);
    if (existing) {
      return { isNew: false, result: JSON.parse(existing) as T };
    }
    return { isNew: true };
  }

  async set<T>(key: string, result: T): Promise<void> {
    await this.redis.setex(
      `idempotency:${key}`,
      this.ttlSeconds,
      JSON.stringify(result)
    );
  }

  async checkAndSet<T>(
    key: string,
    operation: () => Promise<T>
  ): Promise<{ result: T; wasNew: boolean }> {
    const check = await this.check<T>(key);
    if (!check.isNew && check.result) {
      return { result: check.result, wasNew: false };
    }

    const result = await operation();
    await this.set(key, result);
    return { result, wasNew: true };
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}
