-- ============================================
-- 07-ai-db.sql — AI Service
-- Bảng: ai_logs, ai_prompts, ai_usage
-- ============================================
\c ai_db

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- user_id → auth_db.users.id
CREATE TABLE ai_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    task_type VARCHAR(50) NOT NULL,
    input JSONB NOT NULL,
    output JSONB,
    model VARCHAR(100),
    provider VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'success',
    error_message TEXT,
    latency_ms INTEGER,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_logs_user_id ON ai_logs(user_id);
CREATE INDEX idx_ai_logs_task_type ON ai_logs(task_type);
CREATE INDEX idx_ai_logs_status ON ai_logs(status);
CREATE INDEX idx_ai_logs_created_at ON ai_logs(created_at DESC);

CREATE TABLE ai_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    task_type VARCHAR(50) NOT NULL,
    prompt_template TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_ai_prompt_name_version UNIQUE (name, version)
);
CREATE INDEX idx_ai_prompts_task_type ON ai_prompts(task_type);
CREATE INDEX idx_ai_prompts_is_active ON ai_prompts(is_active);

CREATE TABLE ai_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    usage_date DATE NOT NULL,
    task_type VARCHAR(50) NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_ai_usage_user_date_task UNIQUE (user_id, usage_date, task_type)
);
CREATE INDEX idx_ai_usage_user_id ON ai_usage(user_id);
CREATE INDEX idx_ai_usage_date ON ai_usage(usage_date);
CREATE INDEX idx_ai_usage_task_type ON ai_usage(task_type);
