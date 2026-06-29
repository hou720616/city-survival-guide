"""方案生成的提示词模板。"""

from typing import List, Optional


def build_solution_prompt(
    user_input: dict,
    sub_district_hint: Optional[str] = None,
) -> str:
    """根据用户输入构建方案生成的系统提示词。

    Args:
        user_input: 用户输入信息，包含城市、身份、收入等字段。
        sub_district_hint: 可选，工作地点所在行政区的下级板块列表描述，
            由高德 API 实时查询获得，用于约束 AI 推荐范围。

    Returns:
        完整的提示词字符串，要求大模型返回严格 JSON 格式的方案。
    """
    # 将用户输入格式化为易读的描述
    city = user_input.get("city", "未知城市")
    identity = user_input.get("identity", "未知身份")
    income = user_input.get("income", "未知")
    work_location = user_input.get("work_location", "未知")
    commute_max_time = user_input.get("commute_max_time", 60)
    accept_share = "愿意" if user_input.get("accept_share") else "不愿意"
    life_preferences = user_input.get("life_preferences", [])
    special_needs = user_input.get("special_needs", "无")

    user_desc = f"""用户画像：
- 目标城市：{city}
- 身份：{identity}
- 月收入：{income} 元
- 工作地点：{work_location}
- 可接受最长通勤时间：{commute_max_time} 分钟
- 是否接受合租：{accept_share}
- 生活偏好：{"、".join(life_preferences) if life_preferences else "无特殊要求"}
- 特殊需求：{special_needs}"""

    # 区域约束：优先使用高德 API 实时查询的下级板块数据，
    # 如果不可用则要求在工作地点所在行政区内推荐
    if sub_district_hint:
        area_constraint = f"""\n【重要：推荐区域约束】
用户的工作地点在「{work_location}」，经高德地图实时查询，该行政区包含以下板块/街道：
{sub_district_hint}

请在上述板块中挑选 3 个最适合用户的板块作为推荐区域，每个推荐区域格式为：
"{city}{work_location}的XX板块（说明理由）"
推荐时应综合考虑通勤便利性、租金水平、生活配套等因素。"""
    else:
        area_constraint = f"""\n【重要：推荐区域约束】
用户的工作地点在「{work_location}」。推荐的租房区域必须优先考虑「{work_location}」所在的行政区及周边紧邻区域，
不能推荐跨越大半个城市的其他行政区。推荐区域格式为：
"{city}{work_location}附近的XX区域（说明理由）"
如果不确定{work_location}内部的具体板块，请推荐{work_location}内的知名居住区或地铁站周边区域。"""

    system_prompt = f"""你是一位资深的「城市生存顾问」，专门帮助初到大城市的人快速安顿下来。
请根据以下用户信息，生成一份详细、实用、可落地的「城市求生方案」。

{user_desc}
{area_constraint}

请严格按照以下 JSON 格式返回（不要输出任何 JSON 之外的内容，不要使用 markdown 代码块包裹）：

{{
  "user_profile": {{
    "priority_issues": ["优先解决问题1", "优先解决问题2", "优先解决问题3"],
    "risk_level": "低" 或 "中等" 或 "高"
  }},
  "housing": {{
    "recommended_areas": ["推荐区域1（含理由）", "推荐区域2（含理由）", "推荐区域3（含理由）"],
    "price_range": [最低月租金, 最高月租金],
    "tips": ["租房贴士1", "租房贴士2", "租房贴士3", "租房贴士4"]
  }},
  "commute": {{
    "best_option": "最佳通勤方案描述（包含交通工具与路线）",
    "time": "约 X 分钟",
    "cost": "约 X 元/月"
  }},
  "budget": {{
    "first_month": 首月总预算（含押金、中介费等一次性支出）,
    "monthly": 每月常规支出,
    "breakdown": {{
      "rent": 月租金,
      "transport": 交通费,
      "food": 餐饮费,
      "utilities": 水电燃气网费,
      "other": 其他支出
    }}
  }},
  "tasks": ["到达城市后需办理的事项1（含具体步骤）", "事项2", "事项3", "事项4", "事项5", "事项6"],
  "warnings": ["避坑提醒1", "避坑提醒2", "避坑提醒3", "避坑提醒4"]
}}

要求：
1. 所有内容必须基于用户所在城市「{city}」的实际情况。
2. 预算数字要合理，租金不应超过用户月收入的 50%。
3. 通勤方案要在用户可接受的最长通勤时间（{commute_max_time} 分钟）内。
4. 是否合租的偏好（{accept_share}）要体现在租房建议中。
5. 办事清单要具体可执行，包含证件办理、生活安置等。
6. 避坑提醒要针对 {identity} 群体的常见陷阱。
7. 只返回纯 JSON，不要包含任何解释性文字或 markdown 标记。"""

    return system_prompt


# 方案 JSON 解析失败时使用的兜底提示
SOLUTION_PARSE_ERROR_HINT = (
    "请确保返回的是合法的 JSON 对象，且包含 user_profile、housing、commute、"
    "budget、tasks、warnings 六个字段。"
)
