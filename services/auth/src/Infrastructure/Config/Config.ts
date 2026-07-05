import dotenv from 'dotenv';

dotenv.config();

function env(key: string, fallback?: string): string {
  const v = process.env[key];
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env var: ${key}`);
  }
  return v;
}

export const config = {
  port: env('AUTH_PORT', '3001'),
  databaseUrl: env(
    'AUTH_DATABASE_URL',
    'postgresql://hieusoft:hieusoft123@localhost:5432/auth_db?sslmode=disable',
  ),
  jwt: {
    secret: env('JWT_SECRET', 'your-super-secret-jwt-key-change-in-production'),
    // Kong jwt plugin dùng `iss` (issuer) để tra credential -> secret.
    // key của credential trong Kong phải khớp đúng giá trị này.
    issuer: env('JWT_ISSUER', 'auth-service'),
    accessExpiry: env('JWT_ACCESS_EXPIRY', '15m'),
    refreshExpiryDays: parseInt(env('JWT_REFRESH_EXPIRY_DAYS', '7'), 10),
  },
  // Issuer hiển thị trong app TOTP (Google Authenticator...) khi quét QR
  totpIssuer: env('TOTP_ISSUER', 'Hieusoft Marketplace'),
  // TTL (giờ) cho token verify email / reset password
  emailVerificationExpiryHours: parseInt(env('EMAIL_VERIFICATION_EXPIRY_HOURS', '24'), 10),
  passwordResetExpiryHours: parseInt(env('PASSWORD_RESET_EXPIRY_HOURS', '1'), 10),
  rabbitmqUrl: env('RABBITMQ_URL', 'amqp://hieusoft:hieusoft123@localhost:5672/'),
} as const;
