import type {
  PasswordReset,
  IPasswordResetRepository,
} from '../../Application/Interfaces/IPasswordResetRepository';
import { pool } from './DbPool';

interface Row {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
}

function toEntity(row: Row): PasswordReset {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
  };
}

export class PasswordResetRepository implements IPasswordResetRepository {
  async create(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt],
    );
  }

  async findValidByHash(tokenHash: string): Promise<PasswordReset | null> {
    const { rows } = await pool.query<Row>(
      `SELECT id, user_id, token_hash, expires_at, used_at
       FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
      [tokenHash],
    );
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async markUsed(id: string): Promise<void> {
    await pool.query(`UPDATE password_reset_tokens SET used_at = now() WHERE id = $1`, [id]);
  }
}
