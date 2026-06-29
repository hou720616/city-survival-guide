"""高德地图行政区划查询路由。

提供两个接口：
- GET /api/amap/districts：获取城市下级行政区列表
- GET /api/amap/sub-districts：获取行政区下级街道/板块列表
"""

from fastapi import APIRouter, HTTPException, Query

from services.amap_service import get_city_districts, get_sub_districts
from utils.logger import logger

router = APIRouter(prefix="/api/amap", tags=["amap"])


@router.get("/districts")
async def districts(city: str = Query(..., min_length=1, max_length=20)):
    """获取指定城市下的行政区列表。

    例如：GET /api/amap/districts?city=南京
    返回：["江宁区", "鼓楼区", "玄武区", "秦淮区", ...]
    """
    logger.info("查询城市行政区: city=%s", city)
    try:
        result = await get_city_districts(city)
        if not result:
            raise HTTPException(
                status_code=404,
                detail=f"未找到城市「{city}」的行政区数据，请检查城市名称",
            )
        return {"city": city, "districts": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("行政区查询接口异常: %s", e)
        raise HTTPException(status_code=500, detail=f"查询失败: {e}")


@router.get("/sub-districts")
async def sub_districts(
    district: str = Query(..., min_length=1, max_length=50),
    city: str = Query("", max_length=20),
):
    """获取指定行政区下的下级街道/板块列表。

    例如：GET /api/amap/sub-districts?city=南京&district=江宁区
    返回：["百家湖街道", "东山街道", "秣陵街道", ...]
    """
    logger.info("查询行政区下级: city=%s, district=%s", city, district)
    city_param = city if city else None
    try:
        result = await get_sub_districts(district, city_param)
        if not result:
            raise HTTPException(
                status_code=404,
                detail=f"未找到「{district}」的下级区域数据",
            )
        return {"district": district, "sub_districts": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("下级区域查询接口异常: %s", e)
        raise HTTPException(status_code=500, detail=f"查询失败: {e}")