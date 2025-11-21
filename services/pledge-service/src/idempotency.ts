import Redis from 'ioredis';

export interface IdempotencyResult<T> {
  isNew: boolean;
  result?: T;
}

export class IdempotencyService {
  private redis: Redis;
  private ttlSeconds: number;

  constructor(redis: Redis, ttlSeconds: number = 86400) {
    this.redis = redis;
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

  async lock(key: string, ttlMs: number = 30000): Promise<boolean> {
    const result = await this.redis.set(
      `lock:${key}`,
      '1',
      'PX',
      ttlMs,
      'NX'
    );
    return result === 'OK';
  }

  async unlock(key: string): Promise<void> {
    await this.redis.del(`lock:${key}`);
  }
}
