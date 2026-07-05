import { Pool } from 'pg';
import { config } from './config';

export const pool = new Pool({ connectionString: config.databaseUrl });

export async function assertDbConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}

export type UploadStatus = 'draft' | 'saved';

export interface UploadFile {
  id: string;
  owner_id: string;
  object_key: string;
  public_url: string;
  file_name: string | null;
  content_type: string | null;
  file_size: number | null;
  purpose: string;
  status: UploadStatus;
  linked_service: string | null;
  linked_entity_id: string | null;
  created_at: Date;
  saved_at: Date | null;
}

const COLUMNS =
  'id, owner_id, object_key, public_url, file_name, content_type, file_size, purpose, status, linked_service, linked_entity_id, created_at, saved_at';

export async function createDraft(input: {
  ownerId: string;
  objectKey: string;
  publicUrl: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  purpose: string;
}): Promise<UploadFile> {
  const { rows } = await pool.query<UploadFile>(
    `INSERT INTO upload_files
       (owner_id, object_key, public_url, file_name, content_type, file_size, purpose, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
     RETURNING ${COLUMNS}`,
    [
      input.ownerId,
      input.objectKey,
      input.publicUrl,
      input.fileName,
      input.contentType,
      input.fileSize,
      input.purpose,
    ],
  );
  return rows[0];
}

export async function findById(id: string): Promise<UploadFile | null> {
  const { rows } = await pool.query<UploadFile>(
    `SELECT ${COLUMNS} FROM upload_files WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function markSaved(
  id: string,
  linkedService: string,
  linkedEntityId: string | null,
): Promise<UploadFile> {
  const { rows } = await pool.query<UploadFile>(
    `UPDATE upload_files
     SET status = 'saved', linked_service = $2, linked_entity_id = $3, saved_at = now()
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [id, linkedService, linkedEntityId],
  );
  return rows[0];
}

// Trả về draft (un-save): dùng khi product bỏ ảnh -> để cron dọn.
export async function markDraft(id: string): Promise<UploadFile> {
  const { rows } = await pool.query<UploadFile>(
    `UPDATE upload_files
     SET status = 'draft', linked_service = NULL, linked_entity_id = NULL, saved_at = NULL
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [id],
  );
  return rows[0];
}

// Lấy draft cũ hơn ttlHours để cron dọn.
export async function findExpiredDrafts(ttlHours: number): Promise<UploadFile[]> {
  const { rows } = await pool.query<UploadFile>(
    `SELECT ${COLUMNS} FROM upload_files
     WHERE status = 'draft' AND created_at < now() - ($1 || ' hours')::interval`,
    [String(ttlHours)],
  );
  return rows;
}

export async function deleteById(id: string): Promise<void> {
  await pool.query(`DELETE FROM upload_files WHERE id = $1`, [id]);
}
