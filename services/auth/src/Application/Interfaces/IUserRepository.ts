import type { User } from '../../Domain/Entities/User';

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  emailExists(email: string): Promise<boolean>;
  create(email: string, passwordHash: string, role: string, status: string): Promise<User>;
  updateLastLogin(userId: string): Promise<void>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  setEmailVerified(userId: string): Promise<void>;
  setStatus(userId: string, status: string): Promise<void>;
  setTotpSecret(userId: string, secret: string): Promise<void>;
  setTotpEnabled(userId: string, enabled: boolean): Promise<void>;
}
