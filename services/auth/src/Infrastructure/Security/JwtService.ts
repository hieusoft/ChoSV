import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { IJwtService } from '../../Application/Interfaces/IJwtService';

export interface JwtConfig {
  secret: string;
  issuer: string;
  accessExpiry: string;
}

// TTL ngắn cho challenge token giữa bước 1 (mật khẩu) và bước 2 (2FA)
const CHALLENGE_EXPIRY = '5m';

export class JwtService implements IJwtService {
  constructor(private readonly cfg: JwtConfig) {}

  generateAccessToken(userId: string, role: string): string {
    const options: jwt.SignOptions = {
      algorithm: 'HS256',
      subject: userId,
      issuer: this.cfg.issuer,
      expiresIn: this.cfg.accessExpiry as jwt.SignOptions['expiresIn'],
    };
    return jwt.sign({ role }, this.cfg.secret, options);
  }

  generateRefreshToken(): { raw: string; hash: string } {
    const raw = crypto.randomBytes(48).toString('hex');
    return { raw, hash: this.hashRefreshToken(raw) };
  }

  hashRefreshToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  generateChallengeToken(userId: string): string {
    const options: jwt.SignOptions = {
      algorithm: 'HS256',
      subject: userId,
      issuer: this.cfg.issuer,
      expiresIn: CHALLENGE_EXPIRY,
    };
    return jwt.sign({ purpose: '2fa_challenge' }, this.cfg.secret, options);
  }

  verifyChallengeToken(token: string): string | null {
    try {
      const decoded = jwt.verify(token, this.cfg.secret, {
        algorithms: ['HS256'],
        issuer: this.cfg.issuer,
      }) as jwt.JwtPayload;
      if (decoded.purpose !== '2fa_challenge' || !decoded.sub) {
        return null;
      }
      return decoded.sub;
    } catch {
      return null;
    }
  }
}
