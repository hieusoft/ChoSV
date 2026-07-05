import { randomUUID } from 'crypto';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { config, CONTENT_TYPE_EXT, PURPOSE_FOLDERS } from './config';
import * as db from './db';
import * as r2 from './r2';

// ---- validation ----

const presignSchema = z.object({
  purpose: z.enum(['product_image', 'avatar', 'report_attachment', 'chat_image']),
  file_name: z.string().min(1).max(255),
  content_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  file_size: z.number().int().positive(),
});

const saveSchema = z.object({
  linked_service: z.string().min(1).max(50),
  linked_entity_id: z.string().uuid().optional(),
});

// ---- response helpers ----

function ok(res: Response, data: unknown, status = 200) {
  res.status(status).json({ success: true, data });
}
function fail(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ success: false, error: { code, message } });
}

// Kong forward X-User-Id / X-User-Role. Chặn nếu gọi trực tiếp thiếu identity.
function requireUser(req: Request, res: Response): { userId: string; role: string | null } | null {
  const userId = req.header('X-User-Id');
  if (!userId) {
    fail(res, 401, 'UNAUTHORIZED', 'Missing user identity');
    return null;
  }
  return { userId, role: req.header('X-User-Role') ?? null };
}

function isOwnerOrAdmin(file: db.UploadFile, userId: string, role: string | null): boolean {
  return file.owner_id === userId || role === 'admin';
}

export function buildRouter(): Router {
  const router = Router();

  // POST /api/uploads/presign — tạo draft + presigned PUT URL
  router.post('/presign', async (req, res) => {
    const auth = requireUser(req, res);
    if (!auth) return;

    const parsed = presignSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    }
    const dto = parsed.data;
    if (dto.file_size > config.maxFileSizeBytes) {
      return fail(res, 400, 'UPLOAD_FILE_TOO_LARGE', 'File exceeds max size');
    }

    // object key sinh server-side: {folder}/{ownerId}/{uuid}.{ext} — không tin filename client
    const folder = PURPOSE_FOLDERS[dto.purpose];
    const ext = CONTENT_TYPE_EXT[dto.content_type];
    const objectKey = `${folder}/${auth.userId}/${randomUUID()}.${ext}`;
    const publicUrl = r2.getPublicUrl(objectKey);

    const draft = await db.createDraft({
      ownerId: auth.userId,
      objectKey,
      publicUrl,
      fileName: dto.file_name,
      contentType: dto.content_type,
      fileSize: dto.file_size,
      purpose: dto.purpose,
    });

    const uploadUrl = await r2.createPresignedPutUrl(objectKey, dto.content_type);

    ok(
      res,
      {
        upload_id: draft.id,
        upload_url: uploadUrl,
        object_key: objectKey,
        public_url: publicUrl,
        headers: { 'Content-Type': dto.content_type },
        expires_in: config.presignExpiresSeconds,
      },
      201,
    );
  });

  // GET /api/uploads/:id — metadata (owner/admin)
  router.get('/:id', async (req, res) => {
    const auth = requireUser(req, res);
    if (!auth) return;

    const file = await db.findById(req.params.id);
    if (!file) return fail(res, 404, 'UPLOAD_NOT_FOUND', 'Upload not found');
    if (!isOwnerOrAdmin(file, auth.userId, auth.role)) {
      return fail(res, 403, 'UPLOAD_FORBIDDEN', 'Not the owner');
    }
    ok(res, { upload: file });
  });

  // POST /api/uploads/:id/save — draft -> saved (HEAD verify R2 + gắn entity). Idempotent.
  router.post('/:id/save', async (req, res) => {
    const auth = requireUser(req, res);
    if (!auth) return;

    const parsed = saveSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    }
    const dto = parsed.data;

    const file = await db.findById(req.params.id);
    if (!file) return fail(res, 404, 'UPLOAD_NOT_FOUND', 'Upload not found');
    if (!isOwnerOrAdmin(file, auth.userId, auth.role)) {
      return fail(res, 403, 'UPLOAD_FORBIDDEN', 'Not the owner');
    }

    // Idempotent: đã saved đúng service/entity thì trả luôn.
    if (
      file.status === 'saved' &&
      file.linked_service === dto.linked_service &&
      file.linked_entity_id === (dto.linked_entity_id ?? null)
    ) {
      return ok(res, { upload: file });
    }

    // Verify client đã upload thật lên R2 trước khi save.
    const exists = await r2.objectExists(file.object_key);
    if (!exists) {
      return fail(res, 400, 'UPLOAD_OBJECT_NOT_FOUND', 'Object not uploaded to R2 yet');
    }

    const saved = await db.markSaved(file.id, dto.linked_service, dto.linked_entity_id ?? null);
    ok(res, { upload: saved });
  });

  // POST /api/uploads/:id/unsave — saved -> draft (để cron dọn). Dùng khi sửa/xóa product bỏ ảnh.
  router.post('/:id/unsave', async (req, res) => {
    const auth = requireUser(req, res);
    if (!auth) return;

    const file = await db.findById(req.params.id);
    if (!file) return fail(res, 404, 'UPLOAD_NOT_FOUND', 'Upload not found');
    if (!isOwnerOrAdmin(file, auth.userId, auth.role)) {
      return fail(res, 403, 'UPLOAD_FORBIDDEN', 'Not the owner');
    }

    // Idempotent: đã draft thì trả luôn.
    if (file.status === 'draft') return ok(res, { upload: file });

    const draft = await db.markDraft(file.id);
    ok(res, { upload: draft });
  });

  return router;
}
