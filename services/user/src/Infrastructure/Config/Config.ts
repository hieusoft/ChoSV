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
  port: env('USER_PORT', '3002'),
  databaseUrl: env(
    'USER_DATABASE_URL',
    'postgresql://hieusoft:hieusoft123@localhost:5432/user_db?sslmode=disable',
  ),
  rabbitmqUrl: env('RABBITMQ_URL', 'amqp://hieusoft:hieusoft123@localhost:5672/'),
} as const;
