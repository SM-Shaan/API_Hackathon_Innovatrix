import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { PaymentState } from './state-machine';

export interface Payment {
  id: string;
  pledge_id: string;
  amount: number;
  currency: string;
  state: PaymentState;
  provider: string;
  provider_payment_id: string | null;
  provider_ref: string | null;
  idempotency_key: string;
  failure_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePaymentDto {
  pledge_id: string;
  amount: number;
  currency?: string;
  provider?: string;
  idempotency_key: string;
  metadata?: Record<string, unknown>;
}

export interface WebhookEvent {
  id: string;
  payment_id: string;
  webhook_id: string;
  event_type: string;
  provider: string;
  payload: Record<string, unknown>;
  processed: boolean;
  processed_at: Date | null;
  created_at: Date;
}

export class PaymentRepository {
  constructor(private pool: Pool) {}

  async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pledge_id UUID NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'USD',
        state VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        provider VARCHAR(50) NOT NULL DEFAULT 'stripe',
        provider_payment_id VARCHAR(255),
        provider_ref VARCHAR(255),
        idempotency_key VARCHAR(255) UNIQUE NOT NULL,
        failure_reason TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_payments_pledge ON payments(pledge_id);
      CREATE INDEX IF NOT EXISTS idx_payments_state ON payments(state);
      CREATE INDEX IF NOT EXISTS idx_payments_provider_id ON payments(provider_payment_id);
      CREATE INDEX IF NOT EXISTS idx_payments_idempotency ON payments(idempotency_key);

      CREATE TABLE IF NOT EXISTS webhook_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        payment_id UUID REFERENCES payments(id),
        webhook_id VARCHAR(255) UNIQUE NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        payload JSONB NOT NULL,
        processed BOOLEAN DEFAULT FALSE,
        processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_webhook_events_payment ON webhook_events(payment_id);
      CREATE INDEX IF NOT EXISTS idx_webhook_events_webhook_id ON webhook_events(webhook_id);
    `);
  }

  async create(dto: CreatePaymentDto, client?: PoolClient): Promise<Payment> {
    const executor = client || this.pool;
    const id = uuidv4();
    const result = await executor.query(
      `INSERT INTO payments (id, pledge_id, amount, currency, provider, idempotency_key, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        id,
        dto.pledge_id,
        dto.amount,
        dto.currency || 'USD',
        dto.provider || 'stripe',
        dto.idempotency_key,
        JSON.stringify(dto.metadata || {}),
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  async findById(id: string): Promise<Payment | null> {
    const result = await this.pool.query('SELECT * FROM payments WHERE id = $1', [id]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByPledgeId(pledgeId: string): Promise<Payment | null> {
    const result = await this.pool.query(
      'SELECT * FROM payments WHERE pledge_id = $1 ORDER BY created_at DESC LIMIT 1',
      [pledgeId]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByIdempotencyKey(key: string): Promise<Payment | null> {
    const result = await this.pool.query(
      'SELECT * FROM payments WHERE idempotency_key = $1',
      [key]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByProviderPaymentId(providerPaymentId: string): Promise<Payment | null> {
    const result = await this.pool.query(
      'SELECT * FROM payments WHERE provider_payment_id = $1',
      [providerPaymentId]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async updateState(
    id: string,
    state: PaymentState,
    providerData?: {
      provider_payment_id?: string;
      provider_ref?: string;
      failure_reason?: string;
    },
    client?: PoolClient
  ): Promise<Payment | null> {
    const executor = client || this.pool;
    const updates: string[] = ['state = $2', 'updated_at = CURRENT_TIMESTAMP'];
    const values: unknown[] = [id, state];
    let paramIndex = 3;

    if (providerData?.provider_payment_id) {
      updates.push(`provider_payment_id = $${paramIndex++}`);
      values.push(providerData.provider_payment_id);
    }
    if (providerData?.provider_ref) {
      updates.push(`provider_ref = $${paramIndex++}`);
      values.push(providerData.provider_ref);
    }
    if (providerData?.failure_reason) {
      updates.push(`failure_reason = $${paramIndex++}`);
      values.push(providerData.failure_reason);
    }

    const result = await executor.query(
      `UPDATE payments SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findAll(filters?: { state?: PaymentState; pledgeId?: string }): Promise<Payment[]> {
    let query = 'SELECT * FROM payments WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.state) {
      query += ` AND state = $${paramIndex++}`;
      params.push(filters.state);
    }
    if (filters?.pledgeId) {
      query += ` AND pledge_id = $${paramIndex++}`;
      params.push(filters.pledgeId);
    }

    query += ' ORDER BY created_at DESC';
    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.mapRow(row));
  }

  // Webhook event methods
  async saveWebhookEvent(
    paymentId: string,
    webhookId: string,
    eventType: string,
    provider: string,
    payload: Record<string, unknown>,
    client?: PoolClient
  ): Promise<WebhookEvent> {
    const executor = client || this.pool;
    const id = uuidv4();
    const result = await executor.query(
      `INSERT INTO webhook_events (id, payment_id, webhook_id, event_type, provider, payload)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (webhook_id) DO NOTHING
       RETURNING *`,
      [id, paymentId, webhookId, eventType, provider, JSON.stringify(payload)]
    );
    return result.rows[0] ? this.mapWebhookRow(result.rows[0]) : null as unknown as WebhookEvent;
  }

  async findWebhookByWebhookId(webhookId: string): Promise<WebhookEvent | null> {
    const result = await this.pool.query(
      'SELECT * FROM webhook_events WHERE webhook_id = $1',
      [webhookId]
    );
    return result.rows[0] ? this.mapWebhookRow(result.rows[0]) : null;
  }

  async markWebhookProcessed(webhookId: string, client?: PoolClient): Promise<void> {
    const executor = client || this.pool;
    await executor.query(
      'UPDATE webhook_events SET processed = TRUE, processed_at = CURRENT_TIMESTAMP WHERE webhook_id = $1',
      [webhookId]
    );
  }

  async getTransaction(): Promise<PoolClient> {
    const client = await this.pool.connect();
    await client.query('BEGIN');
    return client;
  }

  async commitTransaction(client: PoolClient): Promise<void> {
    await client.query('COMMIT');
    client.release();
  }

  async rollbackTransaction(client: PoolClient): Promise<void> {
    await client.query('ROLLBACK');
    client.release();
  }

  private mapRow(row: Record<string, unknown>): Payment {
    return {
      id: row.id as string,
      pledge_id: row.pledge_id as string,
      amount: parseFloat(row.amount as string),
      currency: row.currency as string,
      state: row.state as PaymentState,
      provider: row.provider as string,
      provider_payment_id: row.provider_payment_id as string | null,
      provider_ref: row.provider_ref as string | null,
      idempotency_key: row.idempotency_key as string,
      failure_reason: row.failure_reason as string | null,
      metadata: (row.metadata || {}) as Record<string, unknown>,
      created_at: row.created_at as Date,
      updated_at: row.updated_at as Date,
    };
  }

  private mapWebhookRow(row: Record<string, unknown>): WebhookEvent {
    return {
      id: row.id as string,
      payment_id: row.payment_id as string,
      webhook_id: row.webhook_id as string,
      event_type: row.event_type as string,
      provider: row.provider as string,
      payload: (row.payload || {}) as Record<string, unknown>,
      processed: row.processed as boolean,
      processed_at: row.processed_at as Date | null,
      created_at: row.created_at as Date,
    };
  }
}
