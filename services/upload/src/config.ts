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

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Invalid integer env var: ${key}`);
  return n;
}

export const config = {
  port: env('UPLOAD_PORT', '3010'),
  databaseUrl: env(
    'UPLOAD_DATABASE_URL',
    'postgresql://hieusoft:hieusoft123@localhost:5432/upload_db?sslmode=disable',
  ),
  r2: {
    accessKeyId: env('R2_ACCESS_KEY_ID'),
    secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
    bucket: env('R2_BUCKET_NAME'),
    endpoint: env('R2_ENDPOINT'),
    publicUrl: env('R2_PUBLIC_URL').replace(/\/+$/, ''), // bỏ trailing slash
  },
  // giới hạn upload
  maxFileSizeBytes: envInt('UPLOAD_MAX_FILE_SIZE_BYTES', 5 * 1024 * 1024),
  presignExpiresSeconds: envInt('UPLOAD_PRESIGN_EXPIRES_SECONDS', 300),
  // cron dọn draft: xóa draft cũ hơn N giờ, quét mỗi M phút
  draftTtlHours: envInt('UPLOAD_DRAFT_TTL_HOURS', 24),
  cleanupIntervalMinutes: envInt('UPLOAD_CLEANUP_INTERVAL_MINUTES', 60),
} as const;

// purpose hợp lệ + folder trên R2
export const PURPOSE_FOLDERS: Record<string, string> = {
  product_image: 'products',
  avatar: 'avatars',
  report_attachment: 'reports',
  chat_image: 'chat',
};

// content_type cho phép -> extension
export const CONTENT_TYPE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
