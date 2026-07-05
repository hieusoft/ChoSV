import type {
  EmailVerification,
  IEmailVerificationRepository,
} from '../../Application/Interfaces/IEmailVerificationRepository';
import { pool } from './DbPool';

interface Row {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  verified_at: Date | null;
}

function toEntity(row: Row): EmailVerification {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    verifiedAt: row.verified_at,
  };
}

export class EmailVerificationRepository implements IEmailVerificationRepository {
  async create(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await pool.query(
      `INSERT INTO email_verifications (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt],
    );
  }

  async findValidByHash(tokenHash: string): Promise<EmailVerification | null> {
    const { rows } = await pool.query<Row>(
      `SELECT id, user_id, token_hash, expires_at, verified_at
       FROM email_verifications
       WHERE token_hash = $1 AND verified_at IS NULL AND expires_at > now()`,
      [tokenHash],
    );
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async markVerified(id: string): Promise<void> {
    await pool.query(`UPDATE email_verifications SET verified_at = now() WHERE id = $1`, [id]);
  }
}
