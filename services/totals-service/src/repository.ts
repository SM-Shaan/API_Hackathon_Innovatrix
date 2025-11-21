import { Pool } from 'pg';
import Redis from 'ioredis';

export interface CampaignTotal {
  campaign_id: string;
  total_amount: number;
  pledge_count: number;
  last_updated: Date;
}

export class TotalsRepository {
  private cachePrefix = 'totals:campaign:';
  private cacheTTL = 300; // 5 minutes

  constructor(private pool: Pool, private redis: Redis) {}

  async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS campaign_totals (
        campaign_id UUID PRIMARY KEY,
        total_amount DECIMAL(15, 2) DEFAULT 0,
        pledge_count INTEGER DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_totals_updated ON campaign_totals(last_updated);
    `);
  }

  async getTotal(campaignId: string): Promise<CampaignTotal | null> {
    // Try cache first
    const cached = await this.redis.get(`${this.cachePrefix}${campaignId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Query database
    const result = await this.pool.query(
      'SELECT * FROM campaign_totals WHERE campaign_id = $1',
      [campaignId]
    );

    if (!result.rows[0]) {
      return null;
    }

    const total = this.mapRow(result.rows[0]);

    // Cache the result
    await this.redis.setex(
      `${this.cachePrefix}${campaignId}`,
      this.cacheTTL,
      JSON.stringify(total)
    );

    return total;
  }

  async getAllTotals(): Promise<CampaignTotal[]> {
    const result = await this.pool.query(
      'SELECT * FROM campaign_totals ORDER BY total_amount DESC'
    );
    return result.rows.map(row => this.mapRow(row));
  }

  async incrementTotal(campaignId: string, amount: number): Promise<CampaignTotal> {
    const result = await this.pool.query(
      `INSERT INTO campaign_totals (campaign_id, total_amount, pledge_count)
       VALUES ($1, $2, 1)
       ON CONFLICT (campaign_id)
       DO UPDATE SET
         total_amount = campaign_totals.total_amount + $2,
         pledge_count = campaign_totals.pledge_count + 1,
         last_updated = CURRENT_TIMESTAMP
       RETURNING *`,
      [campaignId, amount]
    );

    const total = this.mapRow(result.rows[0]);

    // Invalidate cache
    await this.redis.del(`${this.cachePrefix}${campaignId}`);

    return total;
  }

  async decrementTotal(campaignId: string, amount: number): Promise<CampaignTotal | null> {
    const result = await this.pool.query(
      `UPDATE campaign_totals
       SET total_amount = GREATEST(0, total_amount - $2),
           pledge_count = GREATEST(0, pledge_count - 1),
           last_updated = CURRENT_TIMESTAMP
       WHERE campaign_id = $1
       RETURNING *`,
      [campaignId, amount]
    );

    if (!result.rows[0]) {
      return null;
    }

    const total = this.mapRow(result.rows[0]);

    // Invalidate cache
    await this.redis.del(`${this.cachePrefix}${campaignId}`);

    return total;
  }

  async initializeCampaign(campaignId: string): Promise<CampaignTotal> {
    const result = await this.pool.query(
      `INSERT INTO campaign_totals (campaign_id, total_amount, pledge_count)
       VALUES ($1, 0, 0)
       ON CONFLICT (campaign_id) DO NOTHING
       RETURNING *`,
      [campaignId]
    );

    if (result.rows[0]) {
      return this.mapRow(result.rows[0]);
    }

    // If already exists, return existing
    const existing = await this.getTotal(campaignId);
    return existing!;
  }

  async rebuildFromPledges(): Promise<void> {
    // Rebuild totals from pledges table (for recovery/consistency)
    await this.pool.query(`
      INSERT INTO campaign_totals (campaign_id, total_amount, pledge_count, last_updated)
      SELECT
        campaign_id,
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(*) as pledge_count,
        NOW() as last_updated
      FROM pledges
      WHERE status = 'COMPLETED'
      GROUP BY campaign_id
      ON CONFLICT (campaign_id)
      DO UPDATE SET
        total_amount = EXCLUDED.total_amount,
        pledge_count = EXCLUDED.pledge_count,
        last_updated = EXCLUDED.last_updated
    `);

    // Clear all cache
    const keys = await this.redis.keys(`${this.cachePrefix}*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  private mapRow(row: Record<string, unknown>): CampaignTotal {
    return {
      campaign_id: row.campaign_id as string,
      total_amount: parseFloat(row.total_amount as string),
      pledge_count: parseInt(row.pledge_count as string),
      last_updated: row.last_updated as Date,
    };
  }
}
