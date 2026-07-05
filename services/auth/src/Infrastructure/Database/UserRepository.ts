import type { User } from '../../Domain/Entities/User';
import type { IUserRepository } from '../../Application/Interfaces/IUserRepository';
import { pool } from './DbPool';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  status: string;
  email_verified: boolean;
  totp_secret: string | null;
  totp_enabled: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS =
  'id, email, password_hash, role, status, email_verified, totp_secret, totp_enabled, last_login_at, created_at, updated_at';

function toEntity(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    status: row.status,
    emailVerified: row.email_verified,
    totpSecret: row.totp_secret,
    totpEnabled: row.totp_enabled,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class UserRepository implements IUserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const { rows } = await pool.query<UserRow>(
      `SELECT ${COLUMNS} FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email],
    );
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async findById(id: string): Promise<User | null> {
    const { rows } = await pool.query<UserRow>(
      `SELECT ${COLUMNS} FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async emailExists(email: string): Promise<boolean> {
    const { rows } = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1 AND deleted_at IS NULL) AS exists`,
      [email],
    );
    return rows[0].exists;
  }

  async create(email: string, passwordHash: string, role: string, status: string): Promise<User> {
    const { rows } = await pool.query<UserRow>(
      `INSERT INTO users (email, password_hash, role, status) VALUES ($1, $2, $3, $4)
       RETURNING ${COLUMNS}`,
      [email, passwordHash, role, status],
    );
    return toEntity(rows[0]);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await pool.query(
      `UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = $1`,
      [userId],
    );
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await pool.query(
      `UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`,
      [userId, passwordHash],
    );
  }

  async setEmailVerified(userId: string): Promise<void> {
    await pool.query(
      `UPDATE users SET email_verified = TRUE, updated_at = now() WHERE id = $1`,
      [userId],
    );
  }

  async setStatus(userId: string, status: string): Promise<void> {
    await pool.query(
      `UPDATE users SET status = $2, updated_at = now() WHERE id = $1`,
      [userId, status],
    );
  }

  async setTotpSecret(userId: string, secret: string): Promise<void> {
    await pool.query(
      `UPDATE users SET totp_secret = $2, updated_at = now() WHERE id = $1`,
      [userId, secret],
    );
  }

  async setTotpEnabled(userId: string, enabled: boolean): Promise<void> {
    await pool.query(
      `UPDATE users SET totp_enabled = $2, updated_at = now() WHERE id = $1`,
      [userId, enabled],
    );
  }
}
