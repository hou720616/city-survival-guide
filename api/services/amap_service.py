"""高德地图 Web API 服务。

提供行政区划查询能力，支持：
- 按城市获取下级行政区列表（如"南京"→各区）
- 按行政区获取下级街道/板块列表（如"江宁区"→各街道）
- 获取行政区边界坐标
"""

import os
from typing import List, Optional

import httpx
from dotenv import load_dotenv

from utils.logger import logger

load_dotenv()

# 高德 Web API Key（不同于前端 JS API Key）
# 必须通过环境变量设置，未配置时高德 API 调用将直接失败
AMAP_WEB_KEY = os.getenv("AMAP_WEB_KEY", "")
AMAP_DISTRICT_URL = "https://restapi.amap.com/v3/config/district"


async def get_city_districts(city: str) -> List[str]:
    """获取指定城市下的行政区列表。

    例如：传入"南京"，返回 ["江宁区", "鼓楼区", "玄武区", "秦淮区", ...]。

    Args:
        city: 城市名称，如"南京"、"北京"。

    Returns:
        行政区名称列表，按名称排序。获取失败时返回空列表。
    """
    params = {
        "key": AMAP_WEB_KEY,
        "keywords": city,
        "subdistrict": 1,
        "extensions": "base",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(AMAP_DISTRICT_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        if data.get("status") != "1":
            logger.warning("高德城市行政区查询失败: %s", data.get("info", "未知错误"))
            return []

        districts = data.get("districts", [])
        if not districts:
            logger.warning("高德城市行政区查询无结果: city=%s", city)
            return []

        parent = districts[0]
        sub_districts = parent.get("districts", [])
        if not sub_districts:
            logger.warning("高德城市行政区查询无下级: city=%s", city)
            return []

        names = sorted(
            [d["name"] for d in sub_districts if d.get("name")],
        )
        logger.info("高德城市行政区查询成功: %s -> %d 个区", city, len(names))
        return names

    except httpx.TimeoutException:
        logger.error("高德城市行政区查询超时: city=%s", city)
        return []
    except Exception as e:
        logger.error("高德城市行政区查询异常: %s", e)
        return []


async def _do_district_query(keywords: str) -> Optional[List[str]]:
    """执行一次行政区划查询，返回下级名称列表，失败返回 None。"""
    params = {
        "key": AMAP_WEB_KEY,
        "keywords": keywords,
        "subdistrict": 1,
        "extensions": "base",
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(AMAP_DISTRICT_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    if data.get("status") != "1":
        return None

    districts = data.get("districts", [])
    if not districts:
        return None

    parent = districts[0]
    sub_districts = parent.get("districts", [])
    if not sub_districts:
        return None

    return sorted([d["name"] for d in sub_districts if d.get("name")])


async def get_sub_districts(
    district_name: str, city: Optional[str] = None
) -> List[str]:
    """获取指定行政区下的下级行政区划名称。

    例如：传入"江宁区"，返回 ["百家湖街道", "东山街道", "秣陵街道", ...]。

    会尝试多种关键词格式（如"江宁区"、"南京市江宁区"），
    直到找到有下级区域数据的结果。

    Args:
        district_name: 行政区名称，如"江宁区"、"朝阳区"。
        city: 可选，城市名用于限定搜索范围。

    Returns:
        下级行政区划名称列表，按名称排序。获取失败时返回空列表。
    """
    # 构建候选关键词列表，按优先级排序
    candidates = [district_name]
    if city:
        city_with_suffix = city if city.endswith("市") else f"{city}市"
        candidates.append(f"{city_with_suffix}{district_name}")
        candidates.append(f"{city}{district_name}")

    for keywords in candidates:
        try:
            result = await _do_district_query(keywords)
            if result:
                logger.info(
                    "高德行政区划查询成功: keywords=%s -> 下级区域 %d 个: %s",
                    keywords,
                    len(result),
                    result[:10],
                )
                return result
            logger.debug("高德行政区划查询无下级: keywords=%s", keywords)
        except httpx.TimeoutException:
            logger.warning("高德行政区划查询超时: keywords=%s", keywords)
        except Exception as e:
            logger.warning("高德行政区划查询异常: keywords=%s, error=%s", keywords, e)

    logger.warning(
        "高德行政区划查询全部失败: district=%s, city=%s, tried=%s",
        district_name,
        city,
        candidates,
    )
    return []


async def get_district_boundary(
    district_name: str, city: Optional[str] = None
) -> Optional[str]:
    """获取行政区边界坐标（用于可能的地图边界绘制）。

    Args:
        district_name: 行政区名称。
        city: 可选，城市名。

    Returns:
        polyline 坐标串，获取失败返回 None。
    """
    keywords = district_name
    if city and city not in district_name:
        keywords = f"{city}{district_name}"

    params = {
        "key": AMAP_WEB_KEY,
        "keywords": keywords,
        "subdistrict": 0,
        "extensions": "all",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(AMAP_DISTRICT_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        if data.get("status") != "1":
            return None

        districts = data.get("districts", [])
        if not districts:
            return None

        polyline = districts[0].get("polyline")
        return polyline

    except Exception as e:
        logger.error("高德行政区边界查询异常: %s", e)
        return None