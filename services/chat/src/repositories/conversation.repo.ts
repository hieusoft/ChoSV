// ==========================================
// Repository — Conversation queries
// ==========================================
import { Pool } from 'pg';
import { v4 as uuid } from 'uuid';
import { Conversation } from '../models';

export class ConversationRepo {
  constructor(private pool: Pool) {}

  async findOrCreate(productId: string, buyerId: string, sellerId: string): Promise<Conversation> {
    // Tìm conversation đã tồn tại
    const existing = await this.pool.query<Conversation>(
      `SELECT * FROM conversations
       WHERE product_id = $1 AND buyer_id = $2 AND seller_id = $3`,
      [productId, buyerId, sellerId]
    );
    if (existing.rows.length > 0) return existing.rows[0];

    // Tạo mới
    const result = await this.pool.query<Conversation>(
      `INSERT INTO conversations (id, product_id, buyer_id, seller_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [uuid(), productId, buyerId, sellerId]
    );
    return result.rows[0];
  }

  async findByUser(userId: string, page: number, limit: number): Promise<{ items: Conversation[]; total: number }> {
    const offset = (page - 1) * limit;
    const count = await this.pool.query(
      `SELECT COUNT(*) FROM conversations WHERE buyer_id = $1 OR seller_id = $1`,
      [userId]
    );
    const result = await this.pool.query<Conversation>(
      `SELECT * FROM conversations
       WHERE buyer_id = $1 OR seller_id = $1
       ORDER BY last_message_at DESC NULLS LAST
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return { items: result.rows, total: parseInt(count.rows[0].count, 10) };
  }

  async findById(id: string): Promise<Conversation | null> {
    const result = await this.pool.query<Conversation>(
      `SELECT * FROM conversations WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async updateLastMessage(convId: string, messageId: string): Promise<void> {
    await this.pool.query(
      `UPDATE conversations SET last_message_id = $1, last_message_at = now(), updated_at = now() WHERE id = $2`,
      [messageId, convId]
    );
  }

  async incrementUnread(convId: string, isBuyer: boolean): Promise<void> {
    const col = isBuyer ? 'buyer_unread_count' : 'seller_unread_count';
    await this.pool.query(
      `UPDATE conversations SET ${col} = ${col} + 1, updated_at = now() WHERE id = $1`,
      [convId]
    );
  }

  async resetUnread(convId: string, isBuyer: boolean): Promise<void> {
    const col = isBuyer ? 'buyer_unread_count' : 'seller_unread_count';
    await this.pool.query(
      `UPDATE conversations SET ${col} = 0, updated_at = now() WHERE id = $1`,
      [convId]
    );
  }

  async isParticipant(convId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT id FROM conversations WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)`,
      [convId, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getOtherParticipant(convId: string, userId: string): Promise<string | null> {
    const result = await this.pool.query<{ buyer_id: string; seller_id: string }>(
      `SELECT buyer_id, seller_id FROM conversations WHERE id = $1`,
      [convId]
    );
    if (result.rows.length === 0) return null;
    const c = result.rows[0];
    return c.buyer_id === userId ? c.seller_id : c.buyer_id;
  }

  async isBuyer(convId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT id FROM conversations WHERE id = $1 AND buyer_id = $2`,
      [convId, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
