import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

export interface Campaign {
  id: string;
  title: string;
  description: string;
  goal_amount: number;
  current_amount: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  owner_id: string;
  image_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCampaignDto {
  title: string;
  description: string;
  goal_amount: number;
  owner_id: string;
  image_url?: string;
}

export interface UpdateCampaignDto {
  title?: string;
  description?: string;
  goal_amount?: number;
  status?: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  image_url?: string;
}

export class CampaignRepository {
  constructor(private pool: Pool) {}

  async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        goal_amount DECIMAL(15, 2) NOT NULL,
        current_amount DECIMAL(15, 2) DEFAULT 0,
        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        owner_id UUID NOT NULL,
        image_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
      CREATE INDEX IF NOT EXISTS idx_campaigns_owner ON campaigns(owner_id);
    `);
  }

  async create(dto: CreateCampaignDto): Promise<Campaign> {
    const id = uuidv4();
    const result = await this.pool.query(
      `INSERT INTO campaigns (id, title, description, goal_amount, owner_id, image_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, dto.title, dto.description, dto.goal_amount, dto.owner_id, dto.image_url]
    );
    return this.mapRow(result.rows[0]);
  }

  async findById(id: string): Promise<Campaign | null> {
    const result = await this.pool.query('SELECT * FROM campaigns WHERE id = $1', [id]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findAll(status?: string): Promise<Campaign[]> {
    let query = 'SELECT * FROM campaigns';
    const params: string[] = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.mapRow(row));
  }

  async findByOwner(ownerId: string): Promise<Campaign[]> {
    const result = await this.pool.query(
      'SELECT * FROM campaigns WHERE owner_id = $1 ORDER BY created_at DESC',
      [ownerId]
    );
    return result.rows.map(row => this.mapRow(row));
  }

  async update(id: string, dto: UpdateCampaignDto): Promise<Campaign | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (dto.title !== undefined) {
      fields.push(`title = $${paramIndex++}`);
      values.push(dto.title);
    }
    if (dto.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(dto.description);
    }
    if (dto.goal_amount !== undefined) {
      fields.push(`goal_amount = $${paramIndex++}`);
      values.push(dto.goal_amount);
    }
    if (dto.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(dto.status);
    }
    if (dto.image_url !== undefined) {
      fields.push(`image_url = $${paramIndex++}`);
      values.push(dto.image_url);
    }

    if (fields.length === 0) return this.findById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const result = await this.pool.query(
      `UPDATE campaigns SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async updateAmount(id: string, amount: number): Promise<Campaign | null> {
    const result = await this.pool.query(
      `UPDATE campaigns
       SET current_amount = current_amount + $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [amount, id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM campaigns WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private mapRow(row: Record<string, unknown>): Campaign {
    return {
      id: row.id as string,
      title: row.title as string,
      description: row.description as string,
      goal_amount: parseFloat(row.goal_amount as string),
      current_amount: parseFloat(row.current_amount as string),
      status: row.status as Campaign['status'],
      owner_id: row.owner_id as string,
      image_url: row.image_url as string | undefined,
      created_at: row.created_at as Date,
      updated_at: row.updated_at as Date,
    };
  }
}
