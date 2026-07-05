import type { Profile } from '../../../Domain/Entities/Profile';

// Profile đầy đủ (chủ sở hữu xem — GET /me)
export interface ProfileDto {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  university: string | null;
  campus: string | null;
  phone: string | null;
  bio: string | null;
  reputation_score: number;
  total_reviews: number;
  created_at: string;
  updated_at: string;
}

// Profile public (người khác xem — GET /{user_id}) — ẩn phone
export interface PublicProfileDto {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  university: string | null;
  campus: string | null;
  bio: string | null;
  reputation_score: number;
  total_reviews: number;
}

export function toProfileDto(p: Profile): ProfileDto {
  return {
    id: p.id,
    user_id: p.userId,
    full_name: p.fullName,
    avatar_url: p.avatarUrl,
    university: p.university,
    campus: p.campus,
    phone: p.phone,
    bio: p.bio,
    reputation_score: p.reputationScore,
    total_reviews: p.totalReviews,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
  };
}

export function toPublicProfileDto(p: Profile): PublicProfileDto {
  return {
    id: p.id,
    user_id: p.userId,
    full_name: p.fullName,
    avatar_url: p.avatarUrl,
    university: p.university,
    campus: p.campus,
    bio: p.bio,
    reputation_score: p.reputationScore,
    total_reviews: p.totalReviews,
  };
}
