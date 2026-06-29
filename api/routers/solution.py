"""方案生成路由。

POST /api/solution/generate：接收用户输入，调用 AI 生成结构化城市求生方案。
"""

import asyncio
import time
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.ai_service import ai_service
from utils.logger import logger

router = APIRouter(prefix="/api/solution", tags=["solution"])


# ===== 请求模型 =====
class SolutionRequest(BaseModel):
    """用户输入信息。"""

    city: str = Field(max_length=20)
    identity: str = Field(max_length=20)
    income: float
    work_location: str = Field(max_length=50)
    commute_max_time: int
    accept_share: bool = False
    life_preferences: List[str] = Field(default_factory=list, max_length=10)
    special_needs: str = Field(default="", max_length=200)


# ===== 响应模型 =====
class UserProfile(BaseModel):
    priority_issues: List[str]
    risk_level: str


class HousingAdvice(BaseModel):
    recommended_areas: List[str]
    price_range: List[float]
    tips: List[str]


class CommuteAlternative(BaseModel):
    option: str
    time: str
    cost: str


class CommutePlan(BaseModel):
    best_option: str
    time: str
    cost: str
    alternatives: Optional[List[CommuteAlternative]] = None


class BudgetBreakdown(BaseModel):
    rent: float
    transport: float
    food: float
    utilities: float
    other: float


class BudgetPlan(BaseModel):
    first_month: float
    monthly: float
    breakdown: BudgetBreakdown


class Solution(BaseModel):
    user_profile: UserProfile
    housing: HousingAdvice
    commute: CommutePlan
    budget: BudgetPlan
    tasks: List[str]
    warnings: List[str]


class SolutionResponse(BaseModel):
    success: bool
    data: Solution


@router.post("/generate", response_model=SolutionResponse)
async def generate_solution(request: SolutionRequest) -> SolutionResponse:
    """生成城市求生方案。

    接收用户输入，调用 AI 服务生成结构化方案并返回。
    AI 服务在未配置 API Key 时会自动回退到 mock 数据。
    """
    logger.info(
        "收到方案生成请求：城市=%s, 身份=%s, 收入=%.0f, 通勤<=%d分钟",
        request.city,
        request.identity,
        request.income,
        request.commute_max_time,
    )
    start = time.perf_counter()
    try:
        # generate_solution 已是 async 方法，内部会调用高德 API 获取板块数据
        data = await ai_service.generate_solution(request.model_dump())
        try:
            solution = Solution.model_validate(data)
        except Exception as ve:
            # AI 返回的 JSON 结构不符合模型要求，记录原始数据并回退 mock
            logger.error("方案数据校验失败，原始数据: %s", data)
            logger.error("校验错误: %s", ve)
            mock_data = await asyncio.to_thread(
                ai_service._mock_solution, request.model_dump()
            )
            solution = Solution.model_validate(mock_data)
            logger.warning("已回退到 mock 方案")
        logger.info("方案生成接口总耗时=%.2fs", time.perf_counter() - start)
        return SolutionResponse(success=True, data=solution)
    except Exception as e:
        logger.error("方案生成接口异常 (%.2fs): %s", time.perf_counter() - start, e)
        raise HTTPException(status_code=500, detail=f"方案生成失败: {e}")
