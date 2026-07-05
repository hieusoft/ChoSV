import asyncpg

from .config import config

_pool: asyncpg.Pool | None = None


async def connect() -> None:
    global _pool
    # asyncpg dùng scheme postg:// hoặc postgresql:// đều được; bỏ query param nếu có.
    _pool = await asyncpg.create_pool(config.database_url, min_size=1, max_size=5)


async def disconnect() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("DB pool chưa được khởi tạo")
    return _pool
