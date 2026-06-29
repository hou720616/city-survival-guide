"""AI 对话路由。

POST /api/chat：接收消息、上下文与历史记录，以 SSE 流式返回 AI 回复。
"""

import json
import time
from typing import List

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from services.ai_service import ai_service
from utils.logger import logger

router = APIRouter(prefix="/api", tags=["chat"])


# ===== 请求模型 =====
class ChatMessage(BaseModel):
    """单条对话消息。"""

    role: str = Field(max_length=20)
    content: str = Field(max_length=500)


class ChatContext(BaseModel):
    """对话上下文：用户的基本信息。"""

    city: str = Field(max_length=20)
    identity: str = Field(max_length=20)
    income: float
    work_location: str = Field(max_length=50)


class ChatRequest(BaseModel):
    """对话请求。"""

    message: str = Field(max_length=500)
    context: ChatContext
    history: List[ChatMessage] = Field(default_factory=list, max_length=10)


@router.post("/chat")
async def chat(request: ChatRequest) -> StreamingResponse:
    """流式 AI 对话。

    以 Server-Sent Events 格式返回：
    - 每个内容片段：data: {"content": "增量内容"}\\n\\n
    - 结束标记：data: [DONE]\\n\\n
    """
    logger.info(
        "收到对话请求：城市=%s, 历史消息=%d, 消息=%s",
        request.context.city,
        len(request.history),
        request.message[:50],
    )
    start = time.perf_counter()
    history = [msg.model_dump() for msg in request.history]
    context = request.context.model_dump()

    async def event_stream():
        try:
            async for chunk in ai_service.stream_chat(
                request.message, context, history
            ):
                payload = json.dumps({"content": chunk}, ensure_ascii=False)
                yield f"data: {payload}\n\n"
            yield "data: [DONE]\n\n"
            logger.info("对话接口总耗时=%.2fs", time.perf_counter() - start)
        except Exception as e:
            logger.error("对话接口异常 (%.2fs): %s", time.perf_counter() - start, e)
            # 出错时仍以标准格式返回错误信息并正常结束流
            payload = json.dumps({"content": f"[对话出错] {e}"}, ensure_ascii=False)
            yield f"data: {payload}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用 nginx 缓冲，确保流式实时输出
        },
    )
