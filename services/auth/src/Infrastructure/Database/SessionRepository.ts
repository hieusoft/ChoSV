import type { Session } from '../../Domain/Entities/Session';
import type { ISessionRepository } from '../../Application/Interfaces/ISessionRepository';
import { pool } from './DbPool';

interface SessionRow {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
}

function toEntity(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    refreshTokenHash: row.refresh_token_hash,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

export class SessionRepository implements ISessionRepository {
  async create(
    userId: string,
    refreshTokenHash: string,
    expiresAt: Date,
    deviceName: string | null,
  ): Promise<void> {
    await pool.query(
      `INSERT INTO sessions (user_id, refresh_token_hash, device_name, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, refreshTokenHash, deviceName, expiresAt],
    );
  }

  async findActiveByHash(hash: string): Promise<Session | null> {
    const { rows } = await pool.query<SessionRow>(
      `SELECT id, user_id, refresh_token_hash, expires_at, revoked_at
       FROM sessions
       WHERE refresh_token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`,
      [hash],
    );
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async revokeByHash(hash: string): Promise<void> {
    await pool.query(`UPDATE sessions SET revoked_at = now() WHERE refresh_token_hash = $1`, [
      hash,
    ]);
  }
}
