"""城市求生指南 - FastAPI 后端服务入口。

启动方式：
    cd api
    pip install -r requirements.txt
    uvicorn main:app --reload

服务默认运行在 http://127.0.0.1:8000 ，与前端 vite 代理目标一致。
"""

# 先加载 .env 环境变量，再导入依赖它的模块（路由 -> AI 服务）
import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import chat, solution, amap, pitfall
from services.ai_service import ai_service
from utils.logger import logger

app = FastAPI(
    title="城市求生指南 API",
    description="为前端 React 应用提供方案生成与 AI 对话能力",
    version="1.0.0",
)

_cors_origins_env = os.getenv("CORS_ORIGINS", "")
_cors_origins = [
    origin.strip() for origin in _cors_origins_env.split(",") if origin.strip()
] or ["http://localhost:5173", "http://127.0.0.1:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由模块
app.include_router(solution.router)
app.include_router(chat.router)
app.include_router(amap.router)
app.include_router(pitfall.router)

logger.info("FastAPI 应用已创建，AI 可用=%s", ai_service.available)


@app.get("/")
async def root():
    """根路径，用于健康检查。"""
    return {
        "message": "城市求生指南 API 服务运行中",
        "docs": "/docs",
        "ai_enabled": ai_service.available,
    }
