-- ============================================
-- 06-moderation-db.sql — Moderation Service
-- Bảng: reports, moderation_queue, moderation_actions
-- ============================================
\c moderation_db

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- reporter_id → auth_db.users.id
-- target_type + target_id → polymorphic reference (product/user/message)
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL,
    target_type VARCHAR(30) NOT NULL,
    target_id UUID NOT NULL,
    reason VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);
CREATE INDEX idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX idx_reports_target ON reports(target_type, target_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);

-- target_type + target_id → polymorphic reference
-- assigned_admin_id → auth_db.users.id
CREATE TABLE moderation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type VARCHAR(30) NOT NULL,
    target_id UUID NOT NULL,
    risk_score INTEGER NOT NULL DEFAULT 0,
    risk_level VARCHAR(30) NOT NULL DEFAULT 'low',
    signals JSONB,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    assigned_admin_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);
CREATE INDEX idx_moderation_queue_target ON moderation_queue(target_type, target_id);
CREATE INDEX idx_moderation_queue_status ON moderation_queue(status);
CREATE INDEX idx_moderation_queue_risk_level ON moderation_queue(risk_level);
CREATE INDEX idx_moderation_queue_created_at ON moderation_queue(created_at DESC);

-- admin_id → auth_db.users.id
CREATE TABLE moderation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID,
    target_type VARCHAR(30) NOT NULL,
    target_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_moderation_actions_admin_id ON moderation_actions(admin_id);
CREATE INDEX idx_moderation_actions_target ON moderation_actions(target_type, target_id);
CREATE INDEX idx_moderation_actions_action ON moderation_actions(action);
CREATE INDEX idx_moderation_actions_created_at ON moderation_actions(created_at DESC);
