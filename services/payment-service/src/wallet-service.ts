import { Pool, PoolClient } from 'pg';
import { Logger } from './logger';

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  created_at: Date;
  updated_at: Date;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  amount: number;
  type: 'debit' | 'credit';
  description: string;
  reference_id?: string;
  created_at: Date;
}

export class WalletService {
  constructor(
    private pool: Pool,
    private logger: Logger
  ) {}

  /**
   * Initialize wallet tables
   */
  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Create wallets table
      await client.query(`
        CREATE TABLE IF NOT EXISTS wallets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL UNIQUE,
          balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
          currency VARCHAR(3) NOT NULL DEFAULT 'USD',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Create wallet_transactions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS wallet_transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          wallet_id UUID NOT NULL REFERENCES wallets(id),
          amount DECIMAL(15,2) NOT NULL,
          type VARCHAR(10) NOT NULL CHECK (type IN ('debit', 'credit')),
          description TEXT NOT NULL,
          reference_id VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Create indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);');
      await client.query('CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);');
      
      this.logger.info('Wallet service initialized');
    } finally {
      client.release();
    }
  }

  /**
   * Create a wallet for a new user
   */
  async createWallet(userId: string, initialBalance: number = 10000): Promise<Wallet> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO wallets (user_id, balance)
        VALUES ($1, $2)
        RETURNING *
      `, [userId, initialBalance]);

      const wallet = result.rows[0];

      // Record initial credit transaction
      await client.query(`
        INSERT INTO wallet_transactions (wallet_id, amount, type, description)
        VALUES ($1, $2, 'credit', 'Initial wallet funding')
      `, [wallet.id, initialBalance]);

      this.logger.info({ userId, walletId: wallet.id, balance: initialBalance }, 'Wallet created');
      return wallet;
    } finally {
      client.release();
    }
  }

  /**
   * Get wallet by user ID
   */
  async getWalletByUserId(userId: string): Promise<Wallet | null> {
    const result = await this.pool.query(
      'SELECT * FROM wallets WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Check if wallet has sufficient balance
   */
  async hasSufficientBalance(userId: string, amount: number): Promise<boolean> {
    const wallet = await this.getWalletByUserId(userId);
    return wallet ? wallet.balance >= amount : false;
  }

  /**
   * Process a payment (debit from wallet)
   */
  async processPayment(userId: string, amount: number, description: string, referenceId?: string): Promise<{ success: boolean; wallet?: Wallet; error?: string }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Get wallet with row lock
      const walletResult = await client.query(
        'SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (walletResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Wallet not found' };
      }

      const wallet = walletResult.rows[0];

      // Check balance
      if (wallet.balance < amount) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Insufficient balance' };
      }

      // Update wallet balance
      const updatedWalletResult = await client.query(`
        UPDATE wallets 
        SET balance = balance - $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `, [amount, wallet.id]);

      // Record debit transaction
      await client.query(`
        INSERT INTO wallet_transactions (wallet_id, amount, type, description, reference_id)
        VALUES ($1, $2, 'debit', $3, $4)
      `, [wallet.id, amount, description, referenceId]);

      await client.query('COMMIT');

      const updatedWallet = updatedWalletResult.rows[0];
      this.logger.info(
        { userId, amount, newBalance: updatedWallet.balance, referenceId },
        'Payment processed successfully'
      );

      return { success: true, wallet: updatedWallet };
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error({ error, userId, amount }, 'Payment processing failed');
      return { success: false, error: 'Payment processing failed' };
    } finally {
      client.release();
    }
  }

  /**
   * Add funds to wallet (for testing/admin purposes)
   */
  async addFunds(userId: string, amount: number, description: string = 'Funds added'): Promise<Wallet | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Update wallet balance
      const result = await client.query(`
        UPDATE wallets 
        SET balance = balance + $1, updated_at = NOW()
        WHERE user_id = $2
        RETURNING *
      `, [amount, userId]);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const wallet = result.rows[0];

      // Record credit transaction
      await client.query(`
        INSERT INTO wallet_transactions (wallet_id, amount, type, description)
        VALUES ($1, $2, 'credit', $3)
      `, [wallet.id, amount, description]);

      await client.query('COMMIT');
      
      this.logger.info({ userId, amount, newBalance: wallet.balance }, 'Funds added to wallet');
      return wallet;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error({ error, userId, amount }, 'Failed to add funds');
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Get wallet transaction history
   */
  async getTransactionHistory(userId: string, limit: number = 50): Promise<WalletTransaction[]> {
    const result = await this.pool.query(`
      SELECT wt.* 
      FROM wallet_transactions wt
      JOIN wallets w ON wt.wallet_id = w.id
      WHERE w.user_id = $1
      ORDER BY wt.created_at DESC
      LIMIT $2
    `, [userId, limit]);

    return result.rows;
  }
}