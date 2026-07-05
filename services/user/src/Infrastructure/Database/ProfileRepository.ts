import type { Profile } from '../../Domain/Entities/Profile';
import type {
  IProfileRepository,
  UpdateProfileFields,
} from '../../Application/Interfaces/IProfileRepository';
import { pool } from './DbPool';

interface ProfileRow {
  id: string;
  user_id: string;
  full_name: string;
  avatar_object_key: string | null;
  avatar_url: string | null;
  university: string | null;
  campus: string | null;
  phone: string | null;
  bio: string | null;
  reputation_score: number;
  total_reviews: number;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS =
  'id, user_id, full_name, avatar_object_key, avatar_url, university, campus, phone, bio, reputation_score, total_reviews, created_at, updated_at';

function toEntity(row: ProfileRow): Profile {
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    avatarObjectKey: row.avatar_object_key,
    avatarUrl: row.avatar_url,
    university: row.university,
    campus: row.campus,
    phone: row.phone,
    bio: row.bio,
    reputationScore: row.reputation_score,
    totalReviews: row.total_reviews,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ProfileRepository implements IProfileRepository {
  async findByUserId(userId: string): Promise<Profile | null> {
    const { rows } = await pool.query<ProfileRow>(
      `SELECT ${COLUMNS} FROM profiles WHERE user_id = $1`,
      [userId],
    );
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async create(userId: string, fullName: string): Promise<Profile> {
    const { rows } = await pool.query<ProfileRow>(
      `INSERT INTO profiles (user_id, full_name) VALUES ($1, $2)
       RETURNING ${COLUMNS}`,
      [userId, fullName],
    );
    return toEntity(rows[0]);
  }

  async update(userId: string, fields: UpdateProfileFields): Promise<Profile> {
    // Build SET động chỉ cho các field được cung cấp.
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    const map: Record<keyof UpdateProfileFields, string> = {
      fullName: 'full_name',
      university: 'university',
      campus: 'campus',
      phone: 'phone',
      bio: 'bio',
    };
    for (const key of Object.keys(map) as (keyof UpdateProfileFields)[]) {
      if (fields[key] !== undefined) {
        sets.push(`${map[key]} = $${i++}`);
        values.push(fields[key]);
      }
    }
    if (sets.length === 0) {
      const existing = await this.findByUserId(userId);
      return existing!;
    }
    sets.push(`updated_at = now()`);
    values.push(userId);
    const { rows } = await pool.query<ProfileRow>(
      `UPDATE profiles SET ${sets.join(', ')} WHERE user_id = $${i} RETURNING ${COLUMNS}`,
      values,
    );
    return toEntity(rows[0]);
  }

  async existsByUserId(userId: string): Promise<boolean> {
    const { rows } = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM profiles WHERE user_id = $1) AS exists`,
      [userId],
    );
    return rows[0].exists;
  }
}
