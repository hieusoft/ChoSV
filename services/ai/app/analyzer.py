import json
import re

from . import prompts_repo
from .ai_client import AiClientError, ai_client
from .schemas import AnalyzeRequest, AnalyzeResponse

# Prompt mặc định (dùng để seed version 1 + fallback nếu DB trống/lỗi).
# Placeholder do service thay lúc chạy: {title} {description} {num_images}.
# Dùng .replace() nên KHÔNG cần escape dấu ngoặc JSON trong ví dụ -> admin sửa thoải mái.
DEFAULT_PROMPT = """Bạn là hệ thống kiểm duyệt tin đăng cho chợ đồ cũ sinh viên.
Người bán đăng một sản phẩm với thông tin sau:

Tiêu đề: {title}
Mô tả: {description}
Số ảnh đính kèm: {num_images}

Nhiệm vụ:
1. Đọc (các) ảnh đính kèm, mô tả ngắn gọn bằng tiếng Việt bạn thấy gì.
2. So sánh nội dung ảnh với tiêu đề + mô tả của người bán. Chúng có khớp không?
   (Ví dụ lệch: ảnh là laptop nhưng mô tả nói điện thoại; ảnh chụp màn hình/ảnh mạng thay vì hàng thật.)
3. Phát hiện dấu hiệu vi phạm/lừa đảo: hàng cấm (vũ khí, bằng giả, chất cấm), giá bất thường,
   số điện thoại/Zalo trong mô tả để kéo giao dịch ra ngoài, thúc ép chuyển khoản trước.

CHỈ trả về JSON hợp lệ theo đúng schema sau, KHÔNG kèm giải thích ngoài JSON:
{
  "matches_description": true/false,
  "match_score": 0-100,
  "image_summary": "mô tả ngắn nội dung ảnh",
  "mismatch_reasons": ["lý do lệch nếu có"],
  "risk_score": 0-100,
  "risk_level": "low|medium|high|critical",
  "signals": ["dấu hiệu nghi ngờ, mỗi cái 1 chuỗi ngắn tiếng Việt"]
}"""

# Cache prompt active trong process. Admin đổi prompt -> gọi invalidate_cache().
_cached_template: str | None = None


def invalidate_cache() -> None:
    global _cached_template
    _cached_template = None


async def _get_template() -> str:
    """Lấy prompt active từ DB (có cache). Fallback DEFAULT_PROMPT nếu trống/lỗi
    -> moderation không bao giờ chết vì thiếu prompt."""
    global _cached_template
    if _cached_template is not None:
        return _cached_template
    try:
        row = await prompts_repo.get_active_prompt(prompts_repo.TASK_MODERATION)
        _cached_template = row["prompt_template"] if row else DEFAULT_PROMPT
    except Exception:
        _cached_template = DEFAULT_PROMPT
    return _cached_template


def _render(template: str, req: AnalyzeRequest) -> str:
    # Chỉ thay 3 placeholder biết trước bằng .replace() -> không đụng dấu ngoặc JSON.
    return (
        template.replace("{title}", req.title)
        .replace("{description}", req.description or "(không có mô tả)")
        .replace("{num_images}", str(len(req.image_urls)))
    )


def _extract_json(raw: str) -> dict:
    """Model hay bọc JSON trong ```json ... ``` hoặc kèm text. Bóc ra object đầu tiên."""
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        text = fence.group(1)
    else:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            text = text[start : end + 1]
    return json.loads(text)


def _clamp(v, lo: int, hi: int, default: int) -> int:
    try:
        n = int(v)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, n))


def _derive_level(score: int) -> str:
    if score <= 30:
        return "low"
    if score <= 60:
        return "medium"
    if score <= 85:
        return "high"
    return "critical"


def _degraded(reason: str, summary: str = "") -> AnalyzeResponse:
    # AI lỗi -> KHÔNG tự allow. degraded=true để moderation đẩy admin duyệt tay.
    return AnalyzeResponse(
        matches_description=False,
        match_score=0,
        image_summary=summary,
        mismatch_reasons=[],
        risk_score=50,
        risk_level="medium",
        signals=[reason],
        degraded=True,
    )


async def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    template = await _get_template()
    prompt = _render(template, req)

    try:
        raw = await ai_client.complete(prompt, req.image_urls)
    except AiClientError as exc:
        return _degraded(f"AI không phân tích được: {exc}")

    try:
        data = _extract_json(raw)
    except (json.JSONDecodeError, ValueError):
        return _degraded("AI trả về không đúng định dạng JSON", summary=raw[:200])

    risk_score = _clamp(data.get("risk_score"), 0, 100, 50)
    match_score = _clamp(data.get("match_score"), 0, 100, 0)
    level = data.get("risk_level")
    if level not in ("low", "medium", "high", "critical"):
        level = _derive_level(risk_score)

    signals = data.get("signals") or []
    if not isinstance(signals, list):
        signals = [str(signals)]
    reasons = data.get("mismatch_reasons") or []
    if not isinstance(reasons, list):
        reasons = [str(reasons)]

    return AnalyzeResponse(
        matches_description=bool(data.get("matches_description", False)),
        match_score=match_score,
        image_summary=str(data.get("image_summary", "")),
        mismatch_reasons=[str(r) for r in reasons],
        risk_score=risk_score,
        risk_level=level,  # type: ignore[arg-type]
        signals=[str(s) for s in signals],
        degraded=False,
    )
