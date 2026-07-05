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
  port: env('PRODUCT_PORT', '3003'),
  databaseUrl: env(
    'PRODUCT_DATABASE_URL',
    'postgresql://hieusoft:hieusoft123@localhost:5432/product_db?sslmode=disable',
  ),
  rabbitmqUrl: env('RABBITMQ_URL', 'amqp://hieusoft:hieusoft123@localhost:5672/'),
  // Gọi upload-service trong docker network (service-to-service, không qua Kong).
  uploadServiceUrl: env('UPLOAD_SERVICE_URL', 'http://localhost:3010'),
} as const;
