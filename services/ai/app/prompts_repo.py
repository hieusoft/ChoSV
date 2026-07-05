from __future__ import annotations

import asyncpg

from .db import pool

# Mỗi loại tác vụ AI có 1 prompt active. Hiện chỉ có kiểm duyệt tin đăng.
TASK_MODERATION = "product_moderation"
DEFAULT_PROMPT_NAME = "product_moderation_default"


async def get_active_prompt(task_type: str) -> asyncpg.Record | None:
    """Prompt đang active của task_type (chỉ 1). None nếu chưa có."""
    return await pool().fetchrow(
        """SELECT id, name, version, task_type, prompt_template,
                  created_by, is_active, created_at, updated_at
           FROM ai_prompts
           WHERE task_type = $1 AND is_active = TRUE
           ORDER BY version DESC
           LIMIT 1""",
        task_type,
    )


async def list_versions(task_type: str) -> list[asyncpg.Record]:
    """Tất cả version của task_type, mới nhất trước — cho admin xem lịch sử."""
    return await pool().fetch(
        """SELECT id, name, version, task_type, prompt_template,
                  created_by, is_active, created_at, updated_at
           FROM ai_prompts
           WHERE task_type = $1
           ORDER BY version DESC""",
        task_type,
    )


async def get_by_id(prompt_id: str) -> asyncpg.Record | None:
    return await pool().fetchrow(
        """SELECT id, name, version, task_type, prompt_template,
                  created_by, is_active, created_at, updated_at
           FROM ai_prompts WHERE id = $1""",
        prompt_id,
    )


async def create_version(
    task_type: str,
    name: str,
    prompt_template: str,
    created_by: str | None,
) -> asyncpg.Record:
    """Tạo version mới + kích hoạt nó (deactivate các version cũ cùng task_type).

    Version tự tăng = max(version)+1. Toàn bộ trong 1 transaction để không bao
    giờ có 2 version cùng active, và version không nhảy số khi chạy song song.
    """
    async with pool().acquire() as conn:
        async with conn.transaction():
            next_version = await conn.fetchval(
                "SELECT COALESCE(MAX(version), 0) + 1 FROM ai_prompts WHERE task_type = $1",
                task_type,
            )
            await conn.execute(
                "UPDATE ai_prompts SET is_active = FALSE, updated_at = now() WHERE task_type = $1 AND is_active = TRUE",
                task_type,
            )
            row = await conn.fetchrow(
                """INSERT INTO ai_prompts
                     (name, version, task_type, prompt_template, created_by, is_active)
                   VALUES ($1, $2, $3, $4, $5, TRUE)
                   RETURNING id, name, version, task_type, prompt_template,
                             created_by, is_active, created_at, updated_at""",
                name,
                next_version,
                task_type,
                prompt_template,
                created_by,
            )
            return row


async def activate_version(prompt_id: str) -> asyncpg.Record | None:
    """Kích hoạt 1 version cũ (rollback). Deactivate các version khác cùng task_type."""
    async with pool().acquire() as conn:
        async with conn.transaction():
            target = await conn.fetchrow(
                "SELECT id, task_type FROM ai_prompts WHERE id = $1",
                prompt_id,
            )
            if target is None:
                return None
            await conn.execute(
                "UPDATE ai_prompts SET is_active = FALSE, updated_at = now() WHERE task_type = $1",
                target["task_type"],
            )
            return await conn.fetchrow(
                """UPDATE ai_prompts SET is_active = TRUE, updated_at = now()
                   WHERE id = $1
                   RETURNING id, name, version, task_type, prompt_template,
                             created_by, is_active, created_at, updated_at""",
                prompt_id,
            )


async def seed_default(prompt_template: str) -> None:
    """Seed version 1 nếu task kiểm duyệt chưa có prompt nào (chạy lúc boot)."""
    exists = await pool().fetchval(
        "SELECT 1 FROM ai_prompts WHERE task_type = $1 LIMIT 1",
        TASK_MODERATION,
    )
    if exists:
        return
    await pool().execute(
        """INSERT INTO ai_prompts
             (name, version, task_type, prompt_template, is_active)
           VALUES ($1, 1, $2, $3, TRUE)""",
        DEFAULT_PROMPT_NAME,
        TASK_MODERATION,
        prompt_template,
    )
