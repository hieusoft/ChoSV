import os

from dotenv import load_dotenv

load_dotenv()


def _env(key: str, default: str | None = None) -> str:
    val = os.getenv(key, default)
    if val is None or val == "":
        raise RuntimeError(f"Missing required env var: {key}")
    return val


class Config:
    # Vision API tương thích OpenAI chat/completions.
    api_url: str = _env("AI_API_BASE_URL", "https://htmustc.id.vn/v1").rstrip("/")
    api_key: str = _env("AI_API_KEY")
    model: str = _env("AI_MODEL", "gpt-5.5")
    port: int = int(_env("AI_PORT", "3007"))
    request_timeout: float = float(_env("AI_REQUEST_TIMEOUT", "90"))
    database_url: str = _env(
        "AI_DATABASE_URL",
        "postgresql://hieusoft:hieusoft123@localhost:5432/ai_db",
    )

    @property
    def completions_url(self) -> str:
        return f"{self.api_url}/chat/completions"


config = Config()
