import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';

export interface Pledge {
  id: string;
  campaign_id: string;
  donor_id: string | null;
  donor_email: string;
  donor_name: string;
  amount: number;
  idempotency_key: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  message?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePledgeDto {
  campaign_id: string;
  donor_id?: string | null;
  donor_email: string;
  donor_name: string;
  amount: number;
  idempotency_key: string;
  message?: string;
}

export class PledgeRepository {
  constructor(private pool: Pool) {}

  async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS pledges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID NOT NULL,
        donor_id UUID,
        donor_email VARCHAR(255) NOT NULL,
        donor_name VARCHAR(255) NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        idempotency_key VARCHAR(255) UNIQUE NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_pledges_campaign ON pledges(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_pledges_donor ON pledges(donor_id);
      CREATE INDEX IF NOT EXISTS idx_pledges_idempotency ON pledges(idempotency_key);
      CREATE INDEX IF NOT EXISTS idx_pledges_status ON pledges(status);
    `);
  }

  async create(dto: CreatePledgeDto, client?: PoolClient): Promise<Pledge> {
    const conn = client || this.pool;
    const id = uuidv4();
    const result = await conn.query(
      `INSERT INTO pledges (id, campaign_id, donor_id, donor_email, donor_name, amount, idempotency_key, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, dto.campaign_id, dto.donor_id, dto.donor_email, dto.donor_name, dto.amount, dto.idempotency_key, dto.message]
    );
    return this.mapRow(result.rows[0]);
  }

  async findById(id: string): Promise<Pledge | null> {
    const result = await this.pool.query('SELECT * FROM pledges WHERE id = $1', [id]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByIdempotencyKey(key: string): Promise<Pledge | null> {
    const result = await this.pool.query(
      'SELECT * FROM pledges WHERE idempotency_key = $1',
      [key]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByCampaign(campaignId: string): Promise<Pledge[]> {
    const result = await this.pool.query(
      'SELECT * FROM pledges WHERE campaign_id = $1 ORDER BY created_at DESC',
      [campaignId]
    );
    return result.rows.map(row => this.mapRow(row));
  }

  async findByDonor(donorId: string): Promise<Pledge[]> {
    const result = await this.pool.query(
      'SELECT * FROM pledges WHERE donor_id = $1 ORDER BY created_at DESC',
      [donorId]
    );
    return result.rows.map(row => this.mapRow(row));
  }

  async findByEmail(email: string): Promise<Pledge[]> {
    const result = await this.pool.query(
      'SELECT * FROM pledges WHERE donor_email = $1 ORDER BY created_at DESC',
      [email]
    );
    return result.rows.map(row => this.mapRow(row));
  }

  async findAll(status?: string): Promise<Pledge[]> {
    let query = 'SELECT * FROM pledges';
    const params: string[] = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';
    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.mapRow(row));
  }

  async updateStatus(id: string, status: Pledge['status'], client?: PoolClient): Promise<Pledge | null> {
    const conn = client || this.pool;
    const result = await conn.query(
      `UPDATE pledges SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  private mapRow(row: Record<string, unknown>): Pledge {
    return {
      id: row.id as string,
      campaign_id: row.campaign_id as string,
      donor_id: row.donor_id as string | null,
      donor_email: row.donor_email as string,
      donor_name: row.donor_name as string,
      amount: parseFloat(row.amount as string),
      idempotency_key: row.idempotency_key as string,
      status: row.status as Pledge['status'],
      message: row.message as string | undefined,
      created_at: row.created_at as Date,
      updated_at: row.updated_at as Date,
    };
  }
}
