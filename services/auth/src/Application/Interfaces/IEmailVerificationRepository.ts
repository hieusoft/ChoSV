export interface EmailVerification {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  verifiedAt: Date | null;
}

export interface IEmailVerificationRepository {
  create(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findValidByHash(tokenHash: string): Promise<EmailVerification | null>;
  markVerified(id: string): Promise<void>;
}
