import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';

export interface OutboxEvent {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  published: boolean;
  created_at: Date;
}

export interface CreateOutboxEventDto {
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: Record<string, unknown>;
}

export class OutboxRepository {
  constructor(private pool: Pool) {}

  async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS outbox_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        aggregate_type VARCHAR(100) NOT NULL,
        aggregate_id UUID NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        payload JSONB NOT NULL,
        published BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON outbox_events(published) WHERE published = FALSE;
      CREATE INDEX IF NOT EXISTS idx_outbox_created ON outbox_events(created_at);
    `);
  }

  async create(dto: CreateOutboxEventDto, client?: PoolClient): Promise<OutboxEvent> {
    const conn = client || this.pool;
    const id = uuidv4();
    const result = await conn.query(
      `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, dto.aggregate_type, dto.aggregate_id, dto.event_type, JSON.stringify(dto.payload)]
    );
    return this.mapRow(result.rows[0]);
  }

  async findUnpublished(limit: number = 100): Promise<OutboxEvent[]> {
    const result = await this.pool.query(
      `SELECT * FROM outbox_events WHERE published = FALSE ORDER BY created_at ASC LIMIT $1`,
      [limit]
    );
    return result.rows.map(row => this.mapRow(row));
  }

  async markAsPublished(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE outbox_events SET published = TRUE WHERE id = $1`,
      [id]
    );
  }

  async markMultipleAsPublished(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.pool.query(
      `UPDATE outbox_events SET published = TRUE WHERE id = ANY($1)`,
      [ids]
    );
  }

  async deletePublished(olderThanHours: number = 24): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM outbox_events
       WHERE published = TRUE
       AND created_at < NOW() - INTERVAL '${olderThanHours} hours'`
    );
    return result.rowCount ?? 0;
  }

  private mapRow(row: Record<string, unknown>): OutboxEvent {
    return {
      id: row.id as string,
      aggregate_type: row.aggregate_type as string,
      aggregate_id: row.aggregate_id as string,
      event_type: row.event_type as string,
      payload: row.payload as Record<string, unknown>,
      published: row.published as boolean,
      created_at: row.created_at as Date,
    };
  }
}

export const EventTypes = {
  PLEDGE_CREATED: 'pledge.created',
  PLEDGE_COMPLETED: 'pledge.completed',
  PLEDGE_FAILED: 'pledge.failed',
} as const;
