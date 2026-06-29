"""AI 服务层。

封装智谱 AI（GLM-4-Flash）的调用，提供方案生成与流式对话能力。
当未配置 ZHIPUAI_API_KEY 环境变量时，自动回退到 mock 数据，
确保项目可以独立演示。
"""

import asyncio
import json
import os
import re
import time
from typing import AsyncGenerator, Dict, List, Optional

from dotenv import load_dotenv

# 在创建单例前加载 .env，确保 ZHIPUAI_API_KEY 可用（无论从哪个入口导入）
load_dotenv()

from prompts.chat_prompt import build_chat_system_prompt
from prompts.solution_prompt import build_solution_prompt
from services.amap_service import get_sub_districts
from utils.logger import logger

# 尝试导入智谱 AI SDK；若未安装则仅使用 mock 模式
# 注意：zhipuai v2.1.x 只有同步 ZhipuAI，无 AsyncZhipuAI，流式调用用 asyncio.to_thread 包装
try:
    from zhipuai import ZhipuAI

    _ZHIPUAI_AVAILABLE = True
except ImportError:  # pragma: no cover - SDK 未安装时回退
    ZhipuAI = None  # type: ignore
    _ZHIPUAI_AVAILABLE = False


# ===== 常见城市的真实区域数据（用于 mock 方案） =====
_CITY_AREAS: Dict[str, List[str]] = {
    "北京": ["回龙观", "天通苑", "十里堡", "管庄", "常营"],
    "上海": ["浦东金桥", "闵行莘庄", "宝山共富", "嘉定南翔", "松江九亭"],
    "广州": ["天河棠下", "海珠客村", "番禺大石", "白云嘉禾望岗", "黄埔"],
    "深圳": ["龙华民治", "宝安西乡", "龙岗布吉", "坪山", "光明"],
    "杭州": ["滨江浦沿", "余杭未来科技城", "萧山", "下沙", "临平"],
    "成都": ["高新区中和", "武侯区簇桥", "成华区建设路", "龙泉驿", "双流"],
    "武汉": ["光谷", "江夏", "白沙洲", "后湖", "四新"],
    "南京": ["江宁", "浦口", "仙林", "桥北", "六合"],
    "西安": ["长安区", "未央区", "灞桥", "高新二期", "曲江二期"],
    "重庆": ["渝北回兴", "沙坪坝大学城", "南岸茶园", "九龙坡", "大渡口"],
    "苏州": ["园区东沙湖", "吴中", "相城", "新区", "吴江"],
    "天津": ["西青中北镇", "北辰", "东丽", "津南", "武清"],
}


def _get_areas(city: str) -> List[str]:
    """获取指定城市的推荐区域，未知城市返回通用区域名。"""
    if city in _CITY_AREAS:
        return _CITY_AREAS[city]
    # 未知城市使用通用命名，确保城市名体现在结果中
    return [f"{city}新区", f"{city}老城区", f"{city}高新区", f"{city}近郊"]


def _calc_budget(income: float, city: str, accept_share: bool) -> Dict:
    """根据收入、城市、是否合租计算预算明细。"""
    # 租金控制在收入的 25%~35%
    rent_ratio = 0.28 if accept_share else 0.33
    rent = int(income * rent_ratio)
    # 一线城市租金基数较高
    if city in ("北京", "上海", "深圳", "广州"):
        rent = max(rent, 1800 if accept_share else 3000)
    else:
        rent = max(rent, 1000 if accept_share else 1800)

    transport = 250
    food = int(min(income * 0.25, 2500))
    food = max(food, 1200)
    utilities = 300
    other = 500

    monthly = rent + transport + food + utilities + other
    # 首月含押金（押一付一）+ 中介费（半个月租金）
    first_month = monthly + rent + int(rent * 0.5)

    return {
        "first_month": first_month,
        "monthly": monthly,
        "breakdown": {
            "rent": rent,
            "transport": transport,
            "food": food,
            "utilities": utilities,
            "other": other,
        },
    }


def _identity_tasks(identity: str, city: str) -> List[str]:
    """根据身份生成办事清单。"""
    base = [
        f"办理{city}居住证：先做居住登记，满半年后申领，租房合同是关键材料",
        f"到工作单位附近办理银行卡，确认工资发放账户",
        "下载当地政务 App，绑定社保与公积金查询",
        f"熟悉{city}地铁/公交路线，办理交通卡或开通手机交通卡",
        "在租房所在社区登记，了解周边医院、超市、菜市场位置",
    ]
    if identity == "应届生":
        base.extend([
            "办理报到证与档案转移手续",
            "确认社保公积金开户，了解应届生落户政策",
        ])
    elif identity == "打工人":
        base.extend([
            "办理社保关系转移接续",
            "确认公积金异地转移或新开户",
        ])
    elif identity == "自由职业者":
        base.extend([
            "了解灵活就业人员社保参保方式",
            "办理个体工商户或确定税务申报方式",
        ])
    elif identity == "带娃家庭":
        base.extend([
            f"了解{city}学区政策与入学报名时间节点",
            "为孩子办理医保与疫苗接种本转移",
        ])
    elif identity == "随迁老人":
        base.extend([
            "办理老年人优待证，了解异地医保结算政策",
            "熟悉社区老年活动中心与就近医院",
        ])
    return base


def _identity_warnings(identity: str, city: str) -> List[str]:
    """根据身份生成避坑提醒。"""
    common = [
        "警惕低价房源，谨防二房东与黑中介，务必核验房产证与房东身份",
        f"签合同前确认{city}该区域真实租金水平，避免被抬价",
        "押金条款要写清退还条件与时间，入住时拍照留证房屋现状",
    ]
    if identity == "应届生":
        common.append("警惕以『高薪招聘』为名的培训贷与中介费骗局")
    elif identity == "打工人":
        common.append("试用期社保必须缴纳，警惕不签劳动合同的公司")
    elif identity == "自由职业者":
        common.append("灵活就业社保缴费基数与比例要算清，避免断缴")
    elif identity == "带娃家庭":
        common.append(f"注意{city}入学顺位政策，租房落户与购房落户顺位不同")
    elif identity == "随迁老人":
        common.append("异地就医备案要提前办，否则报销比例会降低")
    return common


class AIService:
    """AI 服务：方案生成与流式对话。

    优先使用智谱 AI（GLM-4-Flash）；未配置 API Key 时回退到 mock 实现。
    内置 token 预算熔断：累计用量超过阈值后自动降级到 mock，防止超额消费。
    """

    # 全局 token 预算上限（800 万，留余量给调试）
    TOKEN_BUDGET = 8_000_000
    # 已使用的 token 数（进程级共享）
    _tokens_used = 0

    def __init__(self) -> None:
        self.api_key: Optional[str] = os.getenv("ZHIPUAI_API_KEY")
        self.model: str = "glm-4.7-flash"
        self._sync_client = None
        # 仅当 SDK 可用且配置了 API Key 时初始化客户端
        if _ZHIPUAI_AVAILABLE and self.api_key:
            self._sync_client = ZhipuAI(api_key=self.api_key)
            logger.info("智谱 AI 客户端已初始化，模型=%s", self.model)
        else:
            reason = "SDK 未安装" if not _ZHIPUAI_AVAILABLE else "未配置 ZHIPUAI_API_KEY"
            logger.warning("AI 服务以 mock 模式运行：%s", reason)

    @property
    def available(self) -> bool:
        """是否可用真实 AI 服务（SDK 已安装且配置了 API Key 且未超预算）。"""
        return (
            _ZHIPUAI_AVAILABLE
            and bool(self.api_key)
            and self._tokens_used < self.TOKEN_BUDGET
        )

    @property
    def budget_exceeded(self) -> bool:
        """token 预算是否已耗尽。"""
        return self._tokens_used >= self.TOKEN_BUDGET

    def _add_tokens(self, usage) -> None:
        """从响应 usage 中累加 token 用量。"""
        if usage and hasattr(usage, "total_tokens"):
            self.__class__._tokens_used += usage.total_tokens
            logger.info(
                "Token 用量: +%d, 累计 %d/%d (%.1f%%)",
                usage.total_tokens,
                self._tokens_used,
                self.TOKEN_BUDGET,
                self._tokens_used / self.TOKEN_BUDGET * 100,
            )

    # ===== 方案生成 =====

    async def generate_solution(self, user_input: dict) -> dict:
        """生成结构化城市求生方案。

        Args:
            user_input: 用户输入，包含 city、identity、income 等字段。

        Returns:
            方案字典，结构同前端 Solution 类型。
        """
        city = user_input.get("city", "?")
        work_location = user_input.get("work_location", "")
        logger.info("方案生成开始：城市=%s, 工作地点=%s, 身份=%s", city, work_location, user_input.get("identity"))

        # 调用高德 API 获取工作地点所在行政区的下级板块数据
        sub_district_hint = await self._fetch_sub_district_hint(city, work_location)

        if not self.available:
            logger.debug("AI 不可用，使用 mock 方案")
            return self._mock_solution(user_input, sub_district_hint)

        prompt = build_solution_prompt(user_input, sub_district_hint)
        logger.debug("方案提示词长度=%d 字符", len(prompt))
        start = time.perf_counter()
        try:
            response = await asyncio.to_thread(
                self._sync_client.chat.completions.create,
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
            )
            api_elapsed = time.perf_counter() - start
            self._add_tokens(response.usage)
            content = response.choices[0].message.content
            logger.info(
                "智谱 AI 方案调用耗时=%.2fs (响应长度=%d 字符)",
                api_elapsed,
                len(content),
            )

            parse_start = time.perf_counter()
            result = self._parse_solution_json(content)
            logger.debug("JSON 解析耗时=%.3fs", time.perf_counter() - parse_start)
            logger.info("方案生成完成，总耗时=%.2fs", time.perf_counter() - start)
            return result
        except Exception as e:
            logger.error("智谱 AI 方案调用失败 (%.2fs)，回退到 mock: %s", time.perf_counter() - start, e)
            return self._mock_solution(user_input, sub_district_hint)

    async def _fetch_sub_district_hint(
        self, city: str, work_location: str
    ) -> Optional[str]:
        """调用高德 API 获取工作地点所在行政区的下级板块列表。

        获取失败时返回 None，此时 prompt 会使用降级约束（不依赖 API 数据）。
        """
        if not work_location or not city:
            return None

        # work_location 可能是"江宁区-秣陵街道"格式，提取行政区部分
        district = work_location.split("-")[0].strip() if "-" in work_location else work_location

        try:
            sub_districts = await get_sub_districts(district, city)
            if not sub_districts:
                logger.warning(
                    "未获取到 %s 的下级板块数据，将使用降级区域约束",
                    district,
                )
                return None

            # 格式化板块列表为提示文本
            hint = "、".join(sub_districts)
            logger.info("已获取 %s 的下级板块: %d 个", work_location, len(sub_districts))
            return hint
        except Exception as e:
            logger.error("获取下级板块数据异常: %s", e)
            return None

    def _parse_solution_json(self, content: str) -> dict:
        """从模型返回内容中解析 JSON 方案，带容错修复。"""
        text = content.strip()
        # 去除可能的 markdown 代码块包裹
        match = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
        if match:
            text = match.group(1).strip()
        # 尝试提取首个 { 到末尾 } 的内容
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            text = text[start : end + 1]

        # 尝试直接解析
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # 容错修复：AI 返回的 JSON 常见格式问题
        try:
            fixed = self._repair_json(text)
            return json.loads(fixed)
        except json.JSONDecodeError as e:
            logger.warning("JSON 解析失败(已尝试修复)，原始内容前200字符: %s", content[:200])
            raise e

    @staticmethod
    def _repair_json(text: str) -> str:
        """修复 AI 返回 JSON 中的常见格式问题。"""
        # 1. 移除尾随逗号（对象和数组中）
        text = re.sub(r",\s*([}\]])", r"\1", text)
        # 2. 修复未闭合的引号（在行末）
        lines = text.split("\n")
        repaired_lines = []
        for line in lines:
            stripped = line.strip()
            # 检查是否有奇数个未转义的双引号
            if stripped.count('"') % 2 != 0:
                # 尝试在行末补一个引号
                line = line.rstrip() + '"'
            repaired_lines.append(line)
        text = "\n".join(repaired_lines)
        return text

    # ===== 流式对话 =====

    async def stream_chat(
        self, message: str, context: dict, history: List[dict]
    ) -> AsyncGenerator[str, None]:
        """流式对话，逐段返回增量内容。

        Args:
            message: 用户当前消息。
            context: 对话上下文（城市、身份等）。
            history: 历史消息列表，每项含 role 与 content。

        Yields:
            增量内容字符串。
        """
        logger.info("对话请求：城市=%s, 消息=%s", context.get("city"), message[:50])

        if not self.available:
            logger.debug("AI 不可用，使用 mock 流式对话")
            async for chunk in self._mock_stream_chat(message, context):
                yield chunk
            return

        messages = self._build_chat_messages(message, context, history)
        logger.debug("对话消息数=%d", len(messages))
        start = time.perf_counter()
        chunk_count = 0
        try:
            # zhipuai v2.1.x 无异步客户端，用同步流式 + 线程池包装
            response = await asyncio.to_thread(
                self._sync_client.chat.completions.create,
                model=self.model,
                messages=messages,
                stream=True,
                temperature=0.8,
            )
            for chunk in response:
                # 流式响应最后一个 chunk 携带 usage
                if chunk.usage:
                    self._add_tokens(chunk.usage)
                if chunk.choices:
                    delta = chunk.choices[0].delta.content
                    if delta:
                        chunk_count += 1
                        yield delta
            logger.info(
                "流式对话完成：耗时=%.2fs, 增量片段=%d",
                time.perf_counter() - start,
                chunk_count,
            )
        except Exception as e:
            logger.error("流式对话调用失败 (%.2fs)，回退到 mock: %s", time.perf_counter() - start, e)
            async for chunk in self._mock_stream_chat(message, context):
                yield chunk

    def _build_chat_messages(
        self, message: str, context: dict, history: List[dict]
    ) -> List[dict]:
        """构建对话消息列表：系统提示 + 历史 + 当前消息。"""
        system_prompt = build_chat_system_prompt(context)
        messages: List[dict] = [{"role": "system", "content": system_prompt}]
        # 追加历史记录（仅取最近 10 轮，避免超出上下文）
        for item in history[-10:]:
            role = item.get("role", "user")
            content = item.get("content", "")
            if content:
                messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": message})
        return messages

    # ===== Mock 实现 =====

    def _mock_solution(self, user_input: dict, sub_district_hint: Optional[str] = None) -> dict:
        """生成 mock 方案数据，基于用户输入动态生成。

        当 sub_district_hint 可用时，优先使用真实的下级板块数据作为推荐区域；
        否则回退到硬编码的 _CITY_AREAS。
        """
        city = user_input.get("city", "目标城市")
        identity = user_input.get("identity", "打工人")
        income = float(user_input.get("income", 8000))
        work_location = user_input.get("work_location", "市中心")
        commute_max_time = int(user_input.get("commute_max_time", 60))
        accept_share = bool(user_input.get("accept_share", False))
        life_preferences = user_input.get("life_preferences", [])

        # 优先使用高德 API 返回的真实下级板块
        if sub_district_hint:
            areas = sub_district_hint.split("、")
            logger.info("mock 使用真实下级板块: %d 个", len(areas))
        else:
            areas = _get_areas(city)
            logger.info("mock 使用硬编码区域: %s", areas)
        budget = _calc_budget(income, city, accept_share)
        rent = budget["breakdown"]["rent"]

        # 根据生活偏好调整推荐理由
        pref_desc = "、".join(life_preferences) if life_preferences else "综合性价比"

        # 推荐区域（含理由，城市名体现在其中）
        # 确保至少有 3 个区域，不足时从硬编码补充
        safe_areas = list(areas)
        if len(safe_areas) < 3:
            fallback = _get_areas(city)
            for a in fallback:
                if a not in safe_areas:
                    safe_areas.append(a)
                if len(safe_areas) >= 3:
                    break
        recommended_areas = [
            f"{city}{safe_areas[0]}（租金适中、地铁直达{work_location}，{pref_desc}）",
            f"{city}{safe_areas[1]}（生活配套成熟，适合{identity}居住）",
            f"{city}{safe_areas[2]}（通勤{commute_max_time}分钟内可达，性价比高）",
        ]

        # 风险等级根据收入与租金比判断
        risk_ratio = rent / income if income > 0 else 1
        if risk_ratio > 0.4:
            risk_level = "高"
        elif risk_ratio > 0.3:
            risk_level = "中等"
        else:
            risk_level = "低"

        # 租房贴士
        share_tip = "可考虑合租分摊租金，降低居住成本" if accept_share else "优先选择独立一居室或开间，保障隐私"
        tips = [
            f"优先选择地铁沿线，确保到{work_location}通勤在{commute_max_time}分钟内",
            share_tip,
            f"通过正规平台（链家、贝壳、自如）租房，核验房东房产证与身份证",
            f"{city}租房多为押一付三，提前准备好首期款项",
        ]

        return {
            "user_profile": {
                "priority_issues": [
                    f"尽快在{city}落实住处，优先{safe_areas[0]}等通勤友好区域",
                    f"月收入{int(income)}元，需控制租金在{int(income * 0.33)}元以内",
                    f"办理{city}居住证与社保转移，保障基本权益",
                ],
                "risk_level": risk_level,
            },
            "housing": {
                "recommended_areas": recommended_areas,
                "price_range": [rent - 300, rent + 500],
                "tips": tips,
            },
            "commute": {
                "best_option": f"从{safe_areas[0]}乘地铁至{work_location}，换乘1次",
                "time": f"约 {min(commute_max_time, 50)} 分钟",
                "cost": "约 200 元/月",
                "alternatives": [
                    {"option": f"{safe_areas[0]}公交直达{work_location}", "time": f"约 {commute_max_time} 分钟", "cost": "约 100 元/月"},
                    {"option": "共享单车+地铁组合", "time": f"约 {min(commute_max_time - 5, 45)} 分钟", "cost": "约 180 元/月"},
                ],
            },
            "budget": budget,
            "tasks": _identity_tasks(identity, city),
            "warnings": _identity_warnings(identity, city),
        }

    async def _mock_stream_chat(
        self, message: str, context: dict
    ) -> AsyncGenerator[str, None]:
        """mock 流式对话，逐字返回模拟回复，模拟流式效果。"""
        reply = self._mock_chat_reply(message, context)
        # 逐字（中文按字、英文按词片段）返回，模拟流式
        for char in reply:
            yield char
            await asyncio.sleep(0.03)

    def _mock_chat_reply(self, message: str, context: dict) -> str:
        """根据消息与上下文生成 mock 对话回复。"""
        city = context.get("city", "你所在城市")
        identity = context.get("identity", "朋友")
        income = context.get("income", "未知")
        work_location = context.get("work_location", "工作地")

        msg = message.strip()

        # 根据关键词给出针对性回复
        if any(k in msg for k in ["租房", "房子", "住哪", "房租", "租金"]):
            areas = _get_areas(city)
            return (
                f"在{city}租房，我推荐你看看{areas[0]}和{areas[1]}一带。\n\n"
                f"这两个区域到{work_location}通勤方便，地铁直达。"
                f"以你{int(income)}元的月收入，建议把租金控制在{int(float(income) * 0.3)}元以内。\n\n"
                f"几个小建议：\n"
                f"1. 优先选地铁沿线，通勤时间有保障\n"
                f"2. 通过贝壳、链家等正规平台找房，警惕二房东\n"
                f"3. {city}多为押一付三，提前准备好首期款\n\n"
                f"需要我帮你估算具体预算吗？😊"
            )

        if any(k in msg for k in ["通勤", "地铁", "公交", "交通", "上班"]):
            return (
                f"从{city}常见租房区到{work_location}，地铁是最稳的选择。\n\n"
                f"建议办一张交通卡或开通手机交通卡，月交通费大概200元左右。"
                f"尽量住在地铁1公里内，雨天和高峰期会从容很多。\n\n"
                f"如果通勤超过45分钟，建议考虑换更近的区域，长期会很累哦 🚇"
            )

        if any(k in msg for k in ["预算", "多少钱", "花费", "开销", "钱"]):
            budget = _calc_budget(float(income), city, False)
            bd = budget["breakdown"]
            return (
                f"按你{int(income)}元的月收入，我帮你估一下在{city}的开销：\n\n"
                f"🏠 租金：约 {bd['rent']} 元\n"
                f"🚌 交通：约 {bd['transport']} 元\n"
                f"🍚 餐饮：约 {bd['food']} 元\n"
                f"💡 水电燃气：约 {bd['utilities']} 元\n"
                f"📦 其他：约 {bd['other']} 元\n\n"
                f"每月常规支出约 {budget['monthly']} 元，"
                f"首月含押金中介费约需 {budget['first_month']} 元。\n\n"
                f"建议留出3个月生活费作为应急储备 💰"
            )

        if any(k in msg for k in ["居住证", "社保", "公积金", "证件", "办理"]):
            return (
                f"在{city}安顿下来，这几件事建议尽快办：\n\n"
                f"1. 居住证：先到社区做居住登记，满半年后申领，租房合同是关键材料\n"
                f"2. 社保：确认单位是否按时缴纳，{identity}群体注意转移接续\n"
                f"3. 公积金：可异地转移或新开户\n\n"
                f"下载{city}当地政务App，办事会方便很多 📱"
            )

        if any(k in msg for k in ["吃饭", "美食", "外卖", "菜"]):
            return (
                f"{city}的餐饮选择很丰富！\n\n"
                f"省钱的话可以自己做饭，菜市场比超市便宜不少。"
                f"外卖多用优惠券，工作餐控制在20-30元/顿比较合理。\n\n"
                f"周末可以探索一下{city}的本地小吃，既解馋又能快速融入这座城市 🍜"
            )

        # 默认回复
        return (
            f"你好呀！作为你的{city}生活顾问，我可以帮你解决租房、通勤、"
            f"预算、办事等各种问题。\n\n"
            f"你提到「{msg}」，能再具体说说吗？比如你的预算范围、"
            f"对通勤时间的要求，我好给你更精准的建议 😊"
        )


# 全局单例，供路由模块使用
ai_service = AIService()
