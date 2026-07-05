import { config } from './config';
import { findExpiredDrafts, deleteById } from './db';
import { deleteObject } from './r2';

// Dọn draft quá hạn: xóa R2 object + row. Draft = ảnh đã upload nhưng
// không service nào gắn vào entity (user bỏ ngang, hoặc product đã un-save khi sửa/xóa).
export async function cleanupExpiredDrafts(): Promise<number> {
  const drafts = await findExpiredDrafts(config.draftTtlHours);
  let removed = 0;
  for (const draft of drafts) {
    try {
      await deleteObject(draft.object_key);
    } catch (err) {
      // Object có thể chưa từng được PUT lên R2 (presign rồi bỏ) -> bỏ qua lỗi xóa.
      console.warn(`cleanup: cannot delete R2 object ${draft.object_key}:`, (err as Error).message);
    }
    await deleteById(draft.id);
    removed++;
  }
  if (removed > 0) {
    console.log(`cleanup: removed ${removed} expired draft(s) older than ${config.draftTtlHours}h`);
  }
  return removed;
}

// Chạy định kỳ. Không chặn startup nếu 1 lần quét lỗi.
export function startCleanupCron(): void {
  const intervalMs = config.cleanupIntervalMinutes * 60 * 1000;
  const run = () => {
    cleanupExpiredDrafts().catch((err) => {
      console.error('cleanup cron error:', (err as Error).message);
    });
  };
  run(); // quét 1 lần lúc khởi động để dọn draft tồn từ trước
  setInterval(run, intervalMs);
  console.log(
    `Draft cleanup cron: every ${config.cleanupIntervalMinutes}min, TTL ${config.draftTtlHours}h`,
  );
}
