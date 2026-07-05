export interface ITotpService {
  // Sinh secret mới cho user khi setup 2FA
  generateSecret(): string;
  // otpauth:// URI để client render QR (Google Authenticator...)
  buildOtpAuthUrl(secret: string, accountName: string): string;
  // Verify code 6 số user nhập với secret
  verifyCode(secret: string, code: string): boolean;
}
