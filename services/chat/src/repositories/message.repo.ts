// ==========================================
// Repository — Message queries
// ==========================================
import { Pool } from 'pg';
import { v4 as uuid } from 'uuid';
import { Message } from '../models';

export class MessageRepo {
  constructor(private pool: Pool) {}

  async create(
    conversationId: string,
    senderId: string,
    content: string,
    messageType: 'text' | 'image' | 'system' = 'text'
  ): Promise<Message> {
    const result = await this.pool.query<Message>(
      `INSERT INTO messages (id, conversation_id, sender_id, content, message_type)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [uuid(), conversationId, senderId, content, messageType]
    );
    return result.rows[0];
  }

  async findByConversation(conversationId: string, limit: number = 30, beforeId?: string): Promise<Message[]> {
    let query = `SELECT * FROM messages WHERE conversation_id = $1 AND deleted_at IS NULL`;
    const params: any[] = [conversationId];

    if (beforeId) {
      const before = await this.pool.query<Message>(
        `SELECT created_at FROM messages WHERE id = $1`,
        [beforeId]
      );
      if (before.rows.length > 0) {
        query += ` AND created_at < $2`;
        params.push(before.rows[0].created_at);
      }
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await this.pool.query<Message>(query, params);
    return result.rows.reverse(); // Trả về thứ tự cũ → mới
  }

  async markAsRead(conversationId: string, readerId: string): Promise<void> {
    await this.pool.query(
      `UPDATE messages SET is_read = true, read_at = now()
       WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false`,
      [conversationId, readerId]
    );
  }

  async findById(id: string): Promise<Message | null> {
    const result = await this.pool.query<Message>(
      `SELECT * FROM messages WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] || null;
  }
}
