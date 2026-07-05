export interface IJwtService {
  generateAccessToken(userId: string, role: string): string;
  generateRefreshToken(): { raw: string; hash: string };
  hashRefreshToken(raw: string): string;
  // Challenge token: cấp sau khi đúng mật khẩu nhưng cần bước 2FA.
  // Chỉ dùng để xác nhận đã qua bước 1, không phải access token.
  generateChallengeToken(userId: string): string;
  verifyChallengeToken(token: string): string | null;
}
