import type { Session } from '../../Domain/Entities/Session';

export interface ISessionRepository {
  create(
    userId: string,
    refreshTokenHash: string,
    expiresAt: Date,
    deviceName: string | null,
  ): Promise<void>;
  findActiveByHash(hash: string): Promise<Session | null>;
  revokeByHash(hash: string): Promise<void>;
}
