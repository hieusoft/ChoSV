import { authenticator } from 'otplib';
import type { ITotpService } from '../../Application/Interfaces/ITotpService';

export class TotpService implements ITotpService {
  constructor(private readonly issuer: string) {}

  generateSecret(): string {
    return authenticator.generateSecret();
  }

  buildOtpAuthUrl(secret: string, accountName: string): string {
    return authenticator.keyuri(accountName, this.issuer, secret);
  }

  verifyCode(secret: string, code: string): boolean {
    return authenticator.verify({ token: code, secret });
  }
}
