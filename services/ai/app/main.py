from contextlib import asynccontextmanager

from fastapi import FastAPI

from . import db, prompts_repo
from .analyzer import DEFAULT_PROMPT
from .config import config
from .routes import router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Kết nối DB + seed prompt mặc định (version 1) nếu chưa có.
    # Nếu DB lỗi lúc boot -> vẫn chạy được /analyze (analyzer fallback DEFAULT_PROMPT),
    # nhưng admin prompt endpoints sẽ lỗi tới khi DB sẵn sàng.
    try:
        await db.connect()
        await prompts_repo.seed_default(DEFAULT_PROMPT)
        print("Connected to ai_db, prompt seeded")
    except Exception as exc:  # noqa: BLE001
        print(f"WARN: DB init failed, /analyze vẫn chạy với prompt mặc định: {exc}")
    yield
    await db.disconnect()


app = FastAPI(
    title="AI Service",
    version="1.0.0",
    description=(
        "AI service — phân tích tin đăng: đọc ảnh, so khớp với mô tả người bán, "
        "chấm rủi ro cho moderation. Prompt do admin quản lý (versioned, rollback được). "
        "/analyze nội bộ (moderation gọi thẳng); /prompts qua Kong (chỉ admin)."
    ),
    lifespan=lifespan,
)

app.include_router(router, prefix="/api/ai")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai"}


def run() -> None:
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=config.port)


if __name__ == "__main__":
    run()
