-- ============================================
-- 09-upload-db.sql — Upload Service
-- Bảng: upload_files (metadata file trên Cloudflare R2)
-- Mô hình đơn giản: draft (đã upload, chưa dùng) -> saved (đã gắn vào entity).
-- Cron dọn draft quá hạn (xóa R2 object + row).
-- ============================================
\c upload_db

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- owner_id → auth_db.users.id (UUID, không FK — microservices pattern)
-- linked_entity_id → id entity ở service nghiệp vụ (product/profile/report...)
CREATE TABLE upload_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    object_key TEXT NOT NULL UNIQUE,
    public_url TEXT NOT NULL,
    file_name VARCHAR(255),
    content_type VARCHAR(100),
    file_size INTEGER,
    purpose VARCHAR(50) NOT NULL,
    -- draft: đã presign/upload nhưng chưa gắn vào entity nào (cron sẽ dọn nếu quá hạn)
    -- saved: đã gắn vào entity nghiệp vụ (an toàn, cron không đụng)
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    linked_service VARCHAR(50),
    linked_entity_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    saved_at TIMESTAMPTZ
);
CREATE INDEX idx_upload_files_owner_id ON upload_files(owner_id);
CREATE INDEX idx_upload_files_status ON upload_files(status);
CREATE INDEX idx_upload_files_purpose ON upload_files(purpose);
CREATE INDEX idx_upload_files_linked_entity ON upload_files(linked_service, linked_entity_id);
-- cron quét draft cũ theo created_at
CREATE INDEX idx_upload_files_status_created ON upload_files(status, created_at);
