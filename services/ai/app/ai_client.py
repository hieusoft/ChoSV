import httpx

from .config import config


class AiClientError(Exception):
    """Gọi vision API thất bại (lỗi mạng, upstream, hoặc status != 2xx)."""


class AiClient:
    """Wrapper quanh vision API tương thích OpenAI chat/completions.

    Ảnh truyền dạng URL pass-through (đã verify API tự fetch được URL),
    nên KHÔNG cần tải ảnh về + base64 -> nhẹ hơn nhiều.
    """

    def __init__(self) -> None:
        self._url = config.completions_url
        self._headers = {
            "Authorization": f"Bearer {config.api_key}",
            "Content-Type": "application/json",
        }
        self._timeout = config.request_timeout

    async def complete(self, text_prompt: str, image_urls: list[str]) -> str:
        content: list[dict] = [{"type": "text", "text": text_prompt}]
        for url in image_urls:
            content.append({"type": "image_url", "image_url": {"url": url}})

        payload = {
            "model": config.model,
            "messages": [{"role": "user", "content": content}],
        }

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(self._url, headers=self._headers, json=payload)
        except httpx.HTTPError as exc:
            raise AiClientError(f"network error: {exc}") from exc

        if resp.status_code != 200:
            raise AiClientError(f"upstream {resp.status_code}: {resp.text[:300]}")

        try:
            data = resp.json()
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, ValueError) as exc:
            raise AiClientError(f"unexpected response shape: {exc}") from exc


ai_client = AiClient()
