import type { Profile } from '../../Domain/Entities/Profile';

export interface UpdateProfileFields {
  fullName?: string;
  university?: string;
  campus?: string;
  phone?: string;
  bio?: string;
}

export interface IProfileRepository {
  findByUserId(userId: string): Promise<Profile | null>;
  create(userId: string, fullName: string): Promise<Profile>;
  update(userId: string, fields: UpdateProfileFields): Promise<Profile>;
  existsByUserId(userId: string): Promise<boolean>;
}
