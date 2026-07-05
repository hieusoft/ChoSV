import type { TokenPair } from '../../../Domain/Entities/Token';
import type { User } from '../../../Domain/Entities/User';

export interface UserBriefDto {
  id: string;
  email: string;
  role: string;
  status: string;
  email_verified: boolean;
}

export interface TokensDto {
  access_token: string;
  refresh_token: string;
}

export interface AuthResponseDto {
  user: UserBriefDto;
  tokens: TokensDto;
}

// Login khi user đã bật 2FA: chưa cấp token, trả challenge để gọi /2fa/verify
export interface TwoFactorChallengeDto {
  requires_2fa: true;
  challenge_token: string;
}

// Kết quả login: hoặc đăng nhập luôn, hoặc yêu cầu 2FA
export type LoginResultDto = AuthResponseDto | TwoFactorChallengeDto;

// Kết quả setup 2FA: secret + otpauth URL để client render QR
export interface TotpSetupDto {
  secret: string;
  otpauth_url: string;
}

export function toUserBrief(user: User): UserBriefDto {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    email_verified: user.emailVerified,
  };
}

export function toTokensDto(tokens: TokenPair): TokensDto {
  return {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  };
}
