export interface Profile {
  id: string;
  userId: string;
  fullName: string;
  avatarObjectKey: string | null;
  avatarUrl: string | null;
  university: string | null;
  campus: string | null;
  phone: string | null;
  bio: string | null;
  reputationScore: number;
  totalReviews: number;
  createdAt: Date;
  updatedAt: Date;
}
