import asyncpg
from fastapi import APIRouter, Header, HTTPException

from . import analyzer, prompts_repo
from .schemas import AnalyzeRequest, AnalyzeResponse, CreatePromptRequest, PromptDto

router = APIRouter()


def _to_prompt_dto(row: asyncpg.Record) -> PromptDto:
    return PromptDto(
        id=str(row["id"]),
        name=row["name"],
        version=row["version"],
        task_type=row["task_type"],
        prompt_template=row["prompt_template"],
        created_by=str(row["created_by"]) if row["created_by"] else None,
        is_active=row["is_active"],
        created_at=row["created_at"].isoformat(),
        updated_at=row["updated_at"].isoformat(),
    )


# ---- Nội bộ: moderation gọi thẳng qua docker network (KHÔNG qua Kong) ----


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    return await analyzer.analyze(req)


# ---- Admin: quản lý prompt (qua Kong, chỉ admin). Kong forward X-User-Id/Role ----


def _require_admin(x_user_role: str | None, x_user_id: str | None) -> str:
    if not x_user_id:
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    if x_user_role != "admin":
        raise HTTPException(status_code=403, detail="ADMIN_ONLY")
    return x_user_id


@router.get("/prompts", response_model=list[PromptDto])
async def list_prompts(
    x_user_id: str | None = Header(default=None),
    x_user_role: str | None = Header(default=None),
) -> list[PromptDto]:
    _require_admin(x_user_role, x_user_id)
    rows = await prompts_repo.list_versions(prompts_repo.TASK_MODERATION)
    return [_to_prompt_dto(r) for r in rows]


@router.post("/prompts", response_model=PromptDto, status_code=201)
async def create_prompt(
    body: CreatePromptRequest,
    x_user_id: str | None = Header(default=None),
    x_user_role: str | None = Header(default=None),
) -> PromptDto:
    admin_id = _require_admin(x_user_role, x_user_id)
    row = await prompts_repo.create_version(
        task_type=prompts_repo.TASK_MODERATION,
        name=body.name,
        prompt_template=body.prompt_template,
        created_by=admin_id,
    )
    analyzer.invalidate_cache()  # prompt đổi -> analyzer nạp lại lần gọi sau
    return _to_prompt_dto(row)


@router.post("/prompts/{prompt_id}/activate", response_model=PromptDto)
async def activate_prompt(
    prompt_id: str,
    x_user_id: str | None = Header(default=None),
    x_user_role: str | None = Header(default=None),
) -> PromptDto:
    _require_admin(x_user_role, x_user_id)
    row = await prompts_repo.activate_version(prompt_id)
    if row is None:
        raise HTTPException(status_code=404, detail="PROMPT_NOT_FOUND")
    analyzer.invalidate_cache()
    return _to_prompt_dto(row)
