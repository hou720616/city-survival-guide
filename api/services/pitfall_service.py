"""避坑指南 - 业务逻辑。

包含：
- 内容过滤（敏感词）
- IP 限制（每个 IP 最多 3 条）
- 高德地理编码（将小区名转为经纬度）
"""
import re
from typing import List, Optional, Tuple

import httpx
from dotenv import load_dotenv

from models.pitfall import insert_pitfall, count_by_ip, list_pitfalls
from utils.logger import logger

load_dotenv()

# 高德地理编码 API
AMAP_GEO_URL = "https://restapi.amap.com/v3/geocode/geo"
AMAP_WEB_KEY = os.getenv("AMAP_WEB_KEY", "")

# 每个 IP 最多提交数（临时放开限制，方便测试多发帖）
MAX_PER_IP = 999

# 敏感词过滤列表
BLOCKED_WORDS = [
    "诈骗", "骗子", "杀人", "贩毒", "赌博", "嫖娼",
    "黄色", "色情", "枪支", "武器", "恐怖", "邪教",
    "fuck", "shit", "damn", "asshole",
]

# 敏感词 → 替换词
SENSITIVE_MAP = {
    "sb": "**",
    "煞笔": "**",
    "傻逼": "**",
    "妈的": "**",
    "操你": "**",
    "卧槽": "**",
    "尼玛": "**",
    "脑残": "**",
    "垃圾": "**",
    "去死": "**",
}


def filter_content(text: str) -> Tuple[str, bool]:
    """过滤敏感词，返回 (过滤后文本, 是否拦截)。

    拦截词：直接拒绝提交。
    替换词：替换为 ** 后允许提交。
    """
    lower = text.lower()

    # 检查拦截词
    for word in BLOCKED_WORDS:
        if word.lower() in lower:
            return text, True

    # 替换敏感词
    result = text
    for word, replacement in SENSITIVE_MAP.items():
        pattern = re.compile(re.escape(word), re.IGNORECASE)
        result = pattern.sub(replacement, result)

    return result, False


def check_ip_limit(client_ip: str) -> Tuple[bool, int]:
    """检查 IP 是否超限，返回 (是否允许, 已提交数)。"""
    count = count_by_ip(client_ip)
    return count < MAX_PER_IP, count


async def geocode_location(
    address: str, city: str
) -> Optional[Tuple[float, float]]:
    """通过高德地理编码将地址转为经纬度，返回 (lng, lat) 或 None。"""
    params = {
        "key": AMAP_WEB_KEY,
        "address": address,
        "city": city,
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(AMAP_GEO_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        if data.get("status") != "1" or not data.get("geocodes"):
            logger.warning("高德地理编码失败: address=%s, info=%s", address, data.get("info"))
            return None

        geocode = data["geocodes"][0]
        location_str = geocode.get("location", "")
        if not location_str:
            return None

        lng_str, lat_str = location_str.split(",")
        return float(lng_str), float(lat_str)
    except Exception as e:
        logger.error("高德地理编码异常: address=%s, error=%s", address, e)
        return None


async def submit_pitfall(
    city: str,
    location: str,
    tag: str,
    description: str,
    client_ip: str,
) -> Tuple[Optional[dict], Optional[str]]:
    """提交一条避坑记录。

    流程：
    1. 内容过滤
    2. IP 限制检查
    3. 高德地理编码获取经纬度
    4. 写入数据库

    Returns:
        (记录字典, 错误信息)。成功时 error 为 None。
    """
    # 1. 内容过滤
    for field, name in [(tag, "标签"), (description, "描述"), (location, "小区名")]:
        filtered, blocked = filter_content(field)
        if blocked:
            return None, f"{name}包含不当内容，请修改后重新提交"

    # 2. IP 限制
    allowed, count = check_ip_limit(client_ip)
    if not allowed:
        return None, f"每个IP最多提交 {MAX_PER_IP} 条避坑记录，您已提交 {count} 条"

    # 3. 地理编码
    full_address = f"{city}{location}" if city not in location else location
    coords = await geocode_location(full_address, city)
    if not coords:
        return None, f"未找到「{location}」的地理位置，请检查小区名是否正确"

    lng, lat = coords

    # 4. 内容再过滤一次（替换敏感词）
    tag_filtered, _ = filter_content(tag)
    desc_filtered, _ = filter_content(description)

    # 5. 写入数据库
    record = insert_pitfall(
        city=city,
        location=location,
        address=full_address,
        lng=lng,
        lat=lat,
        tag=tag_filtered,
        description=desc_filtered,
        client_ip=client_ip,
    )
    logger.info(
        "避坑记录已提交: id=%d, city=%s, location=%s, ip=%s",
        record["id"],
        city,
        location,
        client_ip,
    )
    return record, None


def get_pitfalls(city: Optional[str] = None, limit: int = 100) -> List[dict]:
    """获取避坑记录列表。"""
    return list_pitfalls(city=city, limit=limit)