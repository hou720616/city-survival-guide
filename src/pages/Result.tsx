import { Link } from "react-router-dom";
import {
  Target,
  Home as HomeIcon,
  Train,
  Wallet,
  CheckSquare,
  AlertTriangle,
  MessageCircle,
  Save,
  Share2,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  Loader2,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useMapStore } from "@/store/useMapStore";
import { fetchPitfalls } from "@/api";
import html2canvas from "html2canvas";
import type { Solution } from "@/types";

export default function Result() {
  const { solution, userInput } = useAppStore();
  const { activateResultMap, sleepMap, mapInstance, showPitfallMarkers, clearPitfallMarkers } = useMapStore();
  const planRef = useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 激活结果页地图，标记推荐区域
  useEffect(() => {
    if (!mapInstance || !solution || !userInput) return;

    const mapEl = document.querySelector(".map-container");
    if (mapEl) {
      mapEl.classList.remove("map-sleep", "map-active");
      mapEl.classList.add("map-result");
    }

    activateResultMap(userInput.city, solution.housing.recommended_areas);

    // 加载避坑标记
    fetchPitfalls(userInput.city).then((res) => {
      showPitfallMarkers(userInput.city, res.data);
    }).catch(() => {
      // 静默失败
    });

    return () => {
      const mapEl = document.querySelector(".map-container");
      if (mapEl) {
        mapEl.classList.remove("map-result");
        mapEl.classList.add("map-sleep");
      }
      clearPitfallMarkers();
      sleepMap();
    };
  }, [mapInstance, solution, userInput, activateResultMap, sleepMap, showPitfallMarkers, clearPitfallMarkers]);

  if (!solution || !userInput) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-espresso-300 mb-4">暂无方案数据</p>
          <Link to="/survey" className="btn-primary">
            去填写信息
          </Link>
        </div>
      </div>
    );
  }

  const handleSaveAsPoster = async () => {
    if (!planRef.current || isSaving) return;
    setIsSaving(true);
    try {
      const canvas = await html2canvas(planRef.current, {
        backgroundColor: "#fdf8f3",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `${userInput.city}生存指南_${new Date().toLocaleDateString("zh-CN")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("保存海报失败:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="result-layout">
      {/* 左侧方案卡片区域（可滚动） */}
      <div className="result-plan-panel">
        <div ref={planRef} className="px-6 py-8">
          {/* 标题区 */}
          <div className="text-center mb-8 animate-fade-in">
            <p className="font-hand text-terracotta text-lg mb-2">
              Your survival guide
            </p>
            <h1 className="font-serif text-4xl font-bold text-espresso mb-3">
              你的{userInput.city}生存指南
            </h1>
            <p className="text-espresso-300 text-sm">
              生成时间：{new Date().toLocaleString("zh-CN")}
            </p>
          </div>

          {/* 生存画像 */}
          <ProfileCard solution={solution} />

          {/* 方案卡片网格 */}
          <div className="grid md:grid-cols-2 gap-5 mt-5">
            <HousingCard solution={solution} />
            <CommuteCard solution={solution} />
            <BudgetCard solution={solution} />
            <TasksCard solution={solution} />
          </div>

          {/* 避坑提醒 */}
          <WarningsCard solution={solution} />
        </div>

        {/* 操作按钮 */}
        <div className="result-actions">
          <Link to="/chat" className="btn-primary">
            <MessageCircle className="w-5 h-5" />
            继续问 AI
          </Link>
          <button
            className="btn-outline"
            onClick={handleSaveAsPoster}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {isSaving ? "生成中..." : "保存方案"}
          </button>
          <button className="btn-outline">
            <Share2 className="w-5 h-5" />
            分享
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== 生存画像卡片 =====
function ProfileCard({ solution }: { solution: Solution }) {
  const riskColors = {
    低: "bg-sage/10 text-sage border-sage/30",
    中等: "bg-terracotta/10 text-terracotta border-terracotta/30",
    高: "bg-red-100 text-red-700 border-red-300",
  };

  return (
    <div className="card-parchment p-8 relative coordinate-marker animate-fade-in-up">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-terracotta/10 flex items-center justify-center flex-shrink-0">
          <Target className="w-6 h-6 text-terracotta" />
        </div>
        <div className="flex-1">
          <h2 className="font-serif text-2xl font-bold text-espresso mb-4">
            🎯 你的生存画像
          </h2>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="text-sm text-espresso-300">优先解决：</span>
            {solution.user_profile.priority_issues.map((issue, idx) => (
              <span
                key={issue}
                className="inline-flex items-center gap-1.5 bg-parchment-200 px-3 py-1 rounded-lg text-sm font-medium text-espresso"
              >
                <span className="text-terracotta font-bold">{idx + 1}</span>
                {issue}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-espresso-300">风险等级：</span>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-semibold border ${riskColors[solution.user_profile.risk_level] || riskColors["中等"]}`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {solution.user_profile.risk_level}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== 租房建议卡片 =====
function HousingCard({ solution }: { solution: Solution }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="card-parchment p-6 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-terracotta/10 flex items-center justify-center">
          <HomeIcon className="w-5 h-5 text-terracotta" />
        </div>
        <h3 className="font-serif text-xl font-bold text-espresso">🏠 租房建议</h3>
      </div>
      <div className="space-y-3">
        <div>
          <p className="text-xs text-espresso-300 mb-1.5">推荐区域</p>
          <div className="flex flex-wrap gap-2">
            {solution.housing.recommended_areas.map((area) => (
              <span
                key={area}
                className="bg-sage/10 text-sage px-3 py-1 rounded-lg text-sm font-medium"
              >
                {area}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-espresso-300 mb-1.5">租金预算</p>
          <p className="font-serif text-2xl font-bold text-terracotta">
            {solution.housing.price_range[0]}-{solution.housing.price_range[1]}
            <span className="text-sm font-normal text-espresso-300"> 元/月</span>
          </p>
        </div>
        {solution.housing.tips.length > 0 && (
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-sm text-terracotta font-medium hover:underline"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              租房贴士 ({solution.housing.tips.length})
            </button>
            {expanded && (
              <ul className="mt-3 space-y-2">
                {solution.housing.tips.map((tip, idx) => (
                  <li
                    key={idx}
                    className="text-sm text-espresso-300 flex items-start gap-2"
                  >
                    <span className="text-terracotta mt-0.5">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 通勤方案卡片 =====
function CommuteCard({ solution }: { solution: Solution }) {
  return (
    <div className="card-parchment p-6 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-sage/10 flex items-center justify-center">
          <Train className="w-5 h-5 text-sage" />
        </div>
        <h3 className="font-serif text-xl font-bold text-espresso">🚇 通勤方案</h3>
      </div>
      <div className="space-y-3">
        <div>
          <p className="text-xs text-espresso-300 mb-1.5">最佳路线</p>
          <p className="font-serif text-lg font-bold text-espresso">
            {solution.commute.best_option}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-parchment-200/50 rounded-lg p-3">
            <p className="text-xs text-espresso-300 mb-1">通勤时间</p>
            <p className="font-bold text-espresso">{solution.commute.time}</p>
          </div>
          <div className="bg-parchment-200/50 rounded-lg p-3">
            <p className="text-xs text-espresso-300 mb-1">费用</p>
            <p className="font-bold text-espresso">{solution.commute.cost}</p>
          </div>
        </div>
        {solution.commute.alternatives &&
          solution.commute.alternatives.length > 0 && (
            <div>
              <p className="text-xs text-espresso-300 mb-1.5">其他方案</p>
              <div className="space-y-1.5">
                {solution.commute.alternatives.map((alt, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-sm bg-parchment-200/30 rounded-lg px-3 py-2"
                  >
                    <span className="text-espresso">{alt.option}</span>
                    <span className="text-espresso-300">
                      {alt.time} · {alt.cost}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}

// ===== 生活预算卡片 =====
function BudgetCard({ solution }: { solution: Solution }) {
  const { breakdown } = solution.budget;
  const total = breakdown.rent + breakdown.transport + breakdown.food + breakdown.utilities + breakdown.other;
  const items = [
    { label: "房租", value: breakdown.rent, color: "bg-terracotta" },
    { label: "交通", value: breakdown.transport, color: "bg-sage" },
    { label: "餐饮", value: breakdown.food, color: "bg-terracotta-light" },
    { label: "水电", value: breakdown.utilities, color: "bg-sage-light" },
    { label: "其他", value: breakdown.other, color: "bg-espresso-300" },
  ];

  return (
    <div className="card-parchment p-6 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-terracotta/10 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-terracotta" />
        </div>
        <h3 className="font-serif text-xl font-bold text-espresso">💰 生活预算</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-terracotta/5 rounded-lg p-3">
          <p className="text-xs text-espresso-300 mb-1">首月预计</p>
          <p className="font-serif text-xl font-bold text-terracotta">
            {solution.budget.first_month}
            <span className="text-xs font-normal">元</span>
          </p>
        </div>
        <div className="bg-sage/5 rounded-lg p-3">
          <p className="text-xs text-espresso-300 mb-1">月度预计</p>
          <p className="font-serif text-xl font-bold text-sage">
            {solution.budget.monthly}
            <span className="text-xs font-normal">元</span>
          </p>
        </div>
      </div>
      {/* 预算条形图 */}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-espresso-300">{item.label}</span>
              <span className="text-espresso font-medium">{item.value}元</span>
            </div>
            <div className="h-2 bg-parchment-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${item.color} rounded-full transition-all duration-500`}
                style={{ width: `${(item.value / total) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== 办事清单卡片 =====
function TasksCard({ solution }: { solution: Solution }) {
  return (
    <div className="card-parchment p-6 animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-sage/10 flex items-center justify-center">
          <CheckSquare className="w-5 h-5 text-sage" />
        </div>
        <h3 className="font-serif text-xl font-bold text-espresso">📋 办事清单</h3>
      </div>
      <ul className="space-y-2.5">
        {solution.tasks.map((task, idx) => (
          <li
            key={idx}
            className="flex items-start gap-3 bg-parchment-200/30 rounded-lg p-3"
          >
            <div className="w-5 h-5 rounded border-2 border-sage flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs text-sage font-bold">{idx + 1}</span>
            </div>
            <span className="text-sm text-espresso">{task}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ===== 避坑提醒卡片 =====
function WarningsCard({ solution }: { solution: Solution }) {
  return (
    <div className="card-parchment p-6 mt-5 border-terracotta/20 animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-terracotta/10 flex items-center justify-center">
          <TrendingDown className="w-5 h-5 text-terracotta" />
        </div>
        <h3 className="font-serif text-xl font-bold text-espresso">
          ⚠️ 避坑提醒
        </h3>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {solution.warnings.map((warning, idx) => (
          <div
            key={idx}
            className="flex items-start gap-2.5 bg-terracotta/5 border border-terracotta/15 rounded-lg p-3"
          >
            <AlertTriangle className="w-4 h-4 text-terracotta flex-shrink-0 mt-0.5" />
            <span className="text-sm text-espresso">{warning}</span>
          </div>
        ))}
      </div>
    </div>
  );
}