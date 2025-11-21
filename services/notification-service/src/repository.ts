import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

export type NotificationType = 'EMAIL' | 'WEBSOCKET' | 'PUSH';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'READ';

export interface Notification {
  id: string;
  user_id: string | null;
  email: string;
  type: NotificationType;
  channel: string;
  subject: string;
  content: string;
  status: NotificationStatus;
  metadata: Record<string, unknown>;
  sent_at: Date | null;
  read_at: Date | null;
  created_at: Date;
}

export interface CreateNotificationDto {
  user_id?: string;
  email: string;
  type: NotificationType;
  channel: string;
  subject: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  email_enabled: boolean;
  push_enabled: boolean;
  websocket_enabled: boolean;
  donation_alerts: boolean;
  campaign_updates: boolean;
  marketing: boolean;
  created_at: Date;
  updated_at: Date;
}

export class NotificationRepository {
  constructor(private pool: Pool) {}

  async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID,
        email VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        channel VARCHAR(100) NOT NULL,
        subject VARCHAR(500) NOT NULL,
        content TEXT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        metadata JSONB DEFAULT '{}',
        sent_at TIMESTAMP,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_email ON notifications(email);
      CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
      CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

      CREATE TABLE IF NOT EXISTS notification_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE NOT NULL,
        email_enabled BOOLEAN DEFAULT TRUE,
        push_enabled BOOLEAN DEFAULT TRUE,
        websocket_enabled BOOLEAN DEFAULT TRUE,
        donation_alerts BOOLEAN DEFAULT TRUE,
        campaign_updates BOOLEAN DEFAULT TRUE,
        marketing BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_prefs_user ON notification_preferences(user_id);
    `);
  }

  async create(dto: CreateNotificationDto): Promise<Notification> {
    const id = uuidv4();
    const result = await this.pool.query(
      `INSERT INTO notifications (id, user_id, email, type, channel, subject, content, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        dto.user_id || null,
        dto.email,
        dto.type,
        dto.channel,
        dto.subject,
        dto.content,
        JSON.stringify(dto.metadata || {}),
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  async findById(id: string): Promise<Notification | null> {
    const result = await this.pool.query('SELECT * FROM notifications WHERE id = $1', [id]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByUserId(userId: string, limit = 50): Promise<Notification[]> {
    const result = await this.pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
    return result.rows.map(row => this.mapRow(row));
  }

  async findByEmail(email: string, limit = 50): Promise<Notification[]> {
    const result = await this.pool.query(
      'SELECT * FROM notifications WHERE email = $1 ORDER BY created_at DESC LIMIT $2',
      [email, limit]
    );
    return result.rows.map(row => this.mapRow(row));
  }

  async findPending(limit = 100): Promise<Notification[]> {
    const result = await this.pool.query(
      `SELECT * FROM notifications WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT $1`,
      [limit]
    );
    return result.rows.map(row => this.mapRow(row));
  }

  async updateStatus(id: string, status: NotificationStatus): Promise<Notification | null> {
    const updates: string[] = ['status = $2'];
    if (status === 'SENT') {
      updates.push('sent_at = CURRENT_TIMESTAMP');
    } else if (status === 'READ') {
      updates.push('read_at = CURRENT_TIMESTAMP');
    }

    const result = await this.pool.query(
      `UPDATE notifications SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      [id, status]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async markAsRead(id: string): Promise<Notification | null> {
    return this.updateStatus(id, 'READ');
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.pool.query(
      `UPDATE notifications SET status = 'READ', read_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND status = 'SENT' AND read_at IS NULL`,
      [userId]
    );
    return result.rowCount || 0;
  }

  async getUnreadCount(userId: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND status = 'SENT' AND read_at IS NULL`,
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  // Preferences methods
  async getPreferences(userId: string): Promise<NotificationPreference | null> {
    const result = await this.pool.query(
      'SELECT * FROM notification_preferences WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  async upsertPreferences(
    userId: string,
    prefs: Partial<Omit<NotificationPreference, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<NotificationPreference> {
    const result = await this.pool.query(
      `INSERT INTO notification_preferences (id, user_id, email_enabled, push_enabled, websocket_enabled, donation_alerts, campaign_updates, marketing)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id) DO UPDATE SET
         email_enabled = COALESCE($3, notification_preferences.email_enabled),
         push_enabled = COALESCE($4, notification_preferences.push_enabled),
         websocket_enabled = COALESCE($5, notification_preferences.websocket_enabled),
         donation_alerts = COALESCE($6, notification_preferences.donation_alerts),
         campaign_updates = COALESCE($7, notification_preferences.campaign_updates),
         marketing = COALESCE($8, notification_preferences.marketing),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        uuidv4(),
        userId,
        prefs.email_enabled ?? true,
        prefs.push_enabled ?? true,
        prefs.websocket_enabled ?? true,
        prefs.donation_alerts ?? true,
        prefs.campaign_updates ?? true,
        prefs.marketing ?? false,
      ]
    );
    return result.rows[0];
  }

  private mapRow(row: Record<string, unknown>): Notification {
    return {
      id: row.id as string,
      user_id: row.user_id as string | null,
      email: row.email as string,
      type: row.type as NotificationType,
      channel: row.channel as string,
      subject: row.subject as string,
      content: row.content as string,
      status: row.status as NotificationStatus,
      metadata: (row.metadata || {}) as Record<string, unknown>,
      sent_at: row.sent_at as Date | null,
      read_at: row.read_at as Date | null,
      created_at: row.created_at as Date,
    };
  }
}
