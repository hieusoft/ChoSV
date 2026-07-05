from typing import Literal

from pydantic import BaseModel, Field

RiskLevel = Literal["low", "medium", "high", "critical"]


class AnalyzeRequest(BaseModel):
    title: str = Field(..., min_length=1)
    description: str = Field(default="")
    image_urls: list[str] = Field(default_factory=list)


class AnalyzeResponse(BaseModel):
    # Ảnh có khớp với title/description người bán đưa không.
    matches_description: bool
    match_score: int = Field(..., ge=0, le=100)
    # AI thấy gì trong ảnh (để admin đọc nhanh).
    image_summary: str
    # Vì sao lệch / nghi ngờ (nếu có).
    mismatch_reasons: list[str] = Field(default_factory=list)
    # Rủi ro tổng hợp -> map thẳng vào moderation_queue.
    risk_score: int = Field(..., ge=0, le=100)
    risk_level: RiskLevel
    signals: list[str] = Field(default_factory=list)
    # Nếu AI lỗi / không phân tích được -> True, moderation nên fallback cho admin duyệt tay.
    degraded: bool = False


# ---- Quản lý prompt (admin) ----


class CreatePromptRequest(BaseModel):
    prompt_template: str = Field(..., min_length=1)
    # Tên gợi nhớ cho version; không bắt buộc.
    name: str = Field(default="product_moderation", max_length=100)


class PromptDto(BaseModel):
    id: str
    name: str
    version: int
    task_type: str
    prompt_template: str
    created_by: str | None = None
    is_active: bool
    created_at: str
    updated_at: str
