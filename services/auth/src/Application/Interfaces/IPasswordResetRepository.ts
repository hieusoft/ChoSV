export interface PasswordReset {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface IPasswordResetRepository {
  create(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findValidByHash(tokenHash: string): Promise<PasswordReset | null>;
  markUsed(id: string): Promise<void>;
}
