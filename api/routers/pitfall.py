"""避坑指南 API 路由。

GET  /api/pitfalls?city=南京        - 查询避坑记录列表
POST /api/pitfalls                  - 提交一条避坑记录
"""
from fastapi import APIRouter, Request, Query
from pydantic import BaseModel, Field

from services.pitfall_service import submit_pitfall, get_pitfalls
from models.pitfall import delete_pitfall
from utils.logger import logger

router = APIRouter(prefix="/api/pitfalls", tags=["pitfalls"])

# 预置标签选项，供前端下拉选择
PRESET_TAGS = [
    # 租房相关
    "房东不退押金",
    "隔音超烂",
    "水电乱收费",
    "甲醛超标",
    "中介跑路",
    "房屋漏水发霉",
    "邻里噪音扰民",
    "物业不作为",
    "合同有坑",
    # 交通出行
    "路口超堵",
    "机械车位NO！！！",
    "地铁站太远",
    "停车难于登天",
    "公交线路少",
    # 生活配套
    "买菜不方便",
    "医院太远",
    # 周边环境
    "附近工地吵",
    # 安全设施
    "小区治安差",
    "电梯经常坏",
    "其他",
]


class PitfallSubmit(BaseModel):
    city: str = Field(..., min_length=1, description="城市名")
    location: str = Field(..., min_length=1, max_length=100, description="小区/楼栋名")
    tag: str = Field(..., min_length=1, max_length=50, description="标签")
    description: str = Field(default="", max_length=500, description="详细描述")


@router.get("")
async def list_pitfalls(city: str = Query(default="", description="城市筛选")):
    """获取避坑记录列表。"""
    city_param = city.strip() if city else None
    records = get_pitfalls(city=city_param, limit=100)
    return {"data": records, "total": len(records), "tags": PRESET_TAGS}


@router.post("")
async def create_pitfall(body: PitfallSubmit, request: Request):
    """提交一条避坑记录。

    IP 限制：每个 IP 最多提交 3 条。
    内容过滤：含敏感词会被拦截或替换。
    """
    client_ip = request.client.host if request.client else "unknown"
    logger.info("避坑提交请求: city=%s, location=%s, ip=%s", body.city, body.location, client_ip)

    record, error = await submit_pitfall(
        city=body.city,
        location=body.location,
        tag=body.tag,
        description=body.description,
        client_ip=client_ip,
    )

    if error:
        return {"error": error}

    return {"data": record}


@router.delete("/{pitfall_id}")
async def remove_pitfall(pitfall_id: int, request: Request):
    """删除一条避坑记录，仅允许删除自己 IP 提交的记录。"""
    client_ip = request.client.host if request.client else "unknown"
    logger.info("避坑删除请求: id=%d, ip=%s", pitfall_id, client_ip)

    deleted = delete_pitfall(pitfall_id, client_ip)
    if not deleted:
        return {"error": "记录不存在或无权删除"}

    return {"message": "删除成功"}