import { useState, useEffect, useCallback, useRef } from "react";
import { AlertTriangle, MapPin, Send, Loader2, Search, Trash2 } from "lucide-react";
import { useMapStore } from "@/store/useMapStore";
import { fetchPitfalls, submitPitfall, deletePitfall, type PitfallRecord } from "@/api";

const DEFAULT_CITIES = ["北京", "上海", "广州", "深圳", "杭州", "南京", "成都", "武汉"];

/** 高德 POI 建议项 */
interface PoiTip {
  id: string;
  name: string;
  district: string;
  address: string;
  location: { lng: number; lat: number };
}

export default function Pitfalls() {
  const { mapInstance, showPitfallMarkers, clearPitfallMarkers, sleepMap } = useMapStore();

  const [city, setCity] = useState("南京");
  const [location, setLocation] = useState("");
  const [tag, setTag] = useState("");
  const [customTag, setCustomTag] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pitfalls, setPitfalls] = useState<PitfallRecord[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // 模糊搜索
  const [suggestions, setSuggestions] = useState<PoiTip[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoCompleteRef = useRef<{ search: (kw: string) => void; destroy: () => void } | null>(null);
  const suggestionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadIdRef = useRef(0);

  // 初始化 AutoComplete
  const initAutoComplete = useCallback(() => {
    // 销毁旧实例
    if (autoCompleteRef.current) {
      autoCompleteRef.current.destroy();
      autoCompleteRef.current = null;
    }

    const win = window as typeof window & { AMap: unknown };
    if (!win.AMap) return;

    const AMap = win.AMap as {
      AutoComplete: new (opts: {
        input?: string;
        city?: string;
        citylimit?: boolean;
      }) => {
        search: (keyword: string, callback: (status: string, result?: { tips?: PoiTip[] }) => void) => void;
        on: (event: string, handler: (e: { poi: PoiTip }) => void) => void;
        destroy?: () => void;
      };
    };

    const auto = new AMap.AutoComplete({
      city,
      citylimit: true,
    });

    auto.on("select", (e) => {
      const poi = e.poi;
      setLocation(poi.name);
      setShowSuggestions(false);
    });

    autoCompleteRef.current = {
      search: (keyword: string) => {
        auto.search(keyword, (_status, result) => {
          const tips = result?.tips || [];
          setSuggestions(tips);
          setShowSuggestions(tips.length > 0);
        });
      },
      destroy: () => {
        // 高德 AutoComplete 实例不一定提供 destroy 方法，存在时才调用，避免抛 TypeError 导致整页卸载
        if (typeof (auto as { destroy?: unknown }).destroy === "function") {
          (auto as { destroy: () => void }).destroy();
        }
      },
    };
  }, [city]);

  useEffect(() => {
    if (!mapInstance) return;

    initAutoComplete();
    return () => {
      if (autoCompleteRef.current) {
        autoCompleteRef.current.destroy();
        autoCompleteRef.current = null;
      }
    };
  }, [mapInstance, initAutoComplete]);

  // 输入变化时触发模糊搜索
  const handleLocationChange = (value: string) => {
    setLocation(value);
    if (suggestionTimer.current) clearTimeout(suggestionTimer.current);
    if (!value.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    suggestionTimer.current = setTimeout(() => {
      if (autoCompleteRef.current) {
        autoCompleteRef.current.search(value);
      }
    }, 300);
  };

  // 加载避坑记录
  const loadPitfalls = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    setLoading(true);
    try {
      const res = await fetchPitfalls(city);
      if (loadId !== loadIdRef.current) return;
      setPitfalls(res.data);
      setTags(res.tags);
      showPitfallMarkers(city, res.data);
    } catch (err) {
      // #region debug-point B:fetch-fail
      (window as unknown as { __dbg?: (h: string, m: string, d: unknown) => void }).__dbg?.("B", "fetchPitfalls FAILED", { city, error: String(err) });
      // #endregion
      if (loadId === loadIdRef.current) {
        setMessage({ type: "error", text: "加载避坑记录失败" });
      }
    } finally {
      if (loadId === loadIdRef.current) {
        setLoading(false);
      }
    }
  }, [city, showPitfallMarkers]);

  // 进入页面时激活避坑页地图容器，离开时还原休眠态
  useEffect(() => {
    if (!mapInstance) return;

    // #region debug-point D:enter-effect
    (window as unknown as { __dbg?: (h: string, m: string, d: unknown) => void }).__dbg?.("D", "enter-pitfalls effect run", { hasMap: !!mapInstance });
    // #endregion

    const mapEl = document.querySelector(".map-container");
    if (mapEl) {
      mapEl.classList.remove("map-sleep", "map-active", "map-result");
      mapEl.classList.add("map-pitfalls");
    }
    return () => {
      // #region debug-point D:cleanup-start
      (window as unknown as { __dbg?: (h: string, m: string, d: unknown) => void }).__dbg?.("D", "cleanup START", {});
      // #endregion
      try {
        const el = document.querySelector(".map-container");
        if (el) {
          el.classList.remove("map-pitfalls", "map-active", "map-result");
          el.classList.add("map-sleep");
        }
        clearPitfallMarkers();
        sleepMap();
        // #region debug-point D:cleanup-ok
        (window as unknown as { __dbg?: (h: string, m: string, d: unknown) => void }).__dbg?.("D", "cleanup OK", {});
        // #endregion
      } catch (err) {
        // #region debug-point D:cleanup-throw
        (window as unknown as { __dbg?: (h: string, m: string, d: unknown) => void }).__dbg?.("D", "cleanup THREW", { error: String(err), stack: (err as Error)?.stack });
        // #endregion
        throw err;
      }
    };
  }, [mapInstance, clearPitfallMarkers, sleepMap]);

  // 城市变化时仅重新加载数据（等待地图实例就绪后再加载，避免首次南京定位丢失）
  useEffect(() => {
    if (!mapInstance) return;
    // #region debug-point B:city-effect
    (window as unknown as { __dbg?: (h: string, m: string, d: unknown) => void }).__dbg?.("B", "city-load effect", { city });
    // #endregion
    loadPitfalls();
  }, [mapInstance, loadPitfalls]);

  // 提交避坑记录
  const handleSubmit = async () => {
    if (!location.trim()) {
      setMessage({ type: "error", text: "请输入小区/楼栋名" });
      return;
    }
    if (!tag) {
      setMessage({ type: "error", text: "请选择标签" });
      return;
    }

    const finalTag = tag === "其他" ? customTag.trim() || "其他" : tag;

    setSubmitting(true);
    setMessage(null);
    try {
      const res = await submitPitfall({ city, location: location.trim(), tag: finalTag, description: description.trim() });
      if (res.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setMessage({ type: "success", text: "避坑记录已提交！" });
        setLocation("");
        setDescription("");
        setTag("");
        setCustomTag("");
        setSuggestions([]);
        setShowSuggestions(false);
        await loadPitfalls();
      }
    } catch {
      setMessage({ type: "error", text: "网络错误，请重试" });
    } finally {
      setSubmitting(false);
    }
  };

  // 删除避坑记录
  const handleDelete = async (id: number) => {
    setMessage(null);
    try {
      const res = await deletePitfall(id);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setMessage({ type: "success", text: "删除成功" });
        await loadPitfalls();
      }
    } catch {
      setMessage({ type: "error", text: "删除失败，请重试" });
    }
  };

  return (
    <div className="h-full flex flex-col md:flex-row">
      {/* 左侧：表单面板 */}
      <div className="w-full md:w-[420px] flex-shrink-0 flex flex-col h-full bg-parchment-light/95 backdrop-blur-sm overflow-hidden border-r border-parchment-400/20">
        {/* 标题栏 */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-parchment-400/30">
          <AlertTriangle className="w-5 h-5 text-terracotta" />
          <h2 className="font-serif text-lg font-bold text-espresso">避坑指南</h2>
          <span className="text-xs text-espresso-300 ml-auto">
            {pitfalls.length} 条记录
          </span>
        </div>

        {/* 提交表单 */}
        <div className="px-5 py-4 border-b border-parchment-400/20">
          {/* 城市选择 */}
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {DEFAULT_CITIES.map((c) => (
              <button
                key={c}
                onClick={() => { setCity(c); setMessage(null); }}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  city === c
                    ? "bg-terracotta text-white"
                    : "bg-espresso/5 text-espresso-300 hover:bg-espresso/10"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* 小区输入（AutoComplete 模糊搜索） */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso-300" />
            <input
              ref={inputRef}
              type="text"
              value={location}
              onChange={(e) => handleLocationChange(e.target.value)}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="输入小区名，支持模糊搜索"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-parchment-400/50 bg-white text-sm text-espresso placeholder:text-espresso-300/60 focus:outline-none focus:border-terracotta/50 focus:ring-1 focus:ring-terracotta/20"
              autoComplete="off"
            />
            {/* 下拉建议 */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white rounded-lg border border-parchment-400/30 shadow-lg max-h-48 overflow-y-auto">
                {suggestions.map((tip) => (
                  <button
                    key={tip.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setLocation(tip.name);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-espresso hover:bg-terracotta/5 transition-colors flex items-center gap-2"
                  >
                    <MapPin className="w-3.5 h-3.5 text-espresso-300 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{tip.name}</div>
                      <div className="text-[11px] text-espresso-300/70 truncate">{tip.district}{tip.address}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 标签选择 */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {tags.map((t) => (
              <button
                key={t}
                onClick={() => {
                  if (t === tag) {
                    setTag("");
                    setCustomTag("");
                  } else {
                    setTag(t);
                    if (t !== "其他") setCustomTag("");
                  }
                }}
                className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                  tag === t
                    ? "bg-terracotta text-white"
                    : "bg-espresso/5 text-espresso-300 hover:bg-terracotta/10 hover:text-terracotta"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* 自定义标签输入（选中"其他"时显示） */}
          {tag === "其他" && (
            <div className="mb-3">
              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                placeholder="输入自定义标签（最多10字）"
                maxLength={10}
                className="w-full px-3 py-2 rounded-lg border border-parchment-400/50 bg-white text-sm text-espresso placeholder:text-espresso-300/60 focus:outline-none focus:border-terracotta/50 focus:ring-1 focus:ring-terracotta/20"
              />
            </div>
          )}

          {/* 描述输入 */}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="补充描述（选填，最多500字）"
            maxLength={500}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-parchment-400/50 bg-white text-sm text-espresso placeholder:text-espresso-300/60 focus:outline-none focus:border-terracotta/50 focus:ring-1 focus:ring-terracotta/20 resize-none mb-3"
          />

          {/* 提交按钮 + 消息 */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-primary !px-5 !py-2 text-sm disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              提交避坑
            </button>
            {message && (
              <span className={`text-xs ${message.type === "success" ? "text-sage" : "text-terracotta"}`}>
                {message.text}
              </span>
            )}
          </div>
        </div>

        {/* 避坑列表 */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-espresso-300" />
            </div>
          ) : pitfalls.length === 0 ? (
            <div className="text-center py-12 text-espresso-300 text-sm">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>暂无避坑记录</p>
              <p className="text-xs mt-1">成为第一个提交的人吧</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pitfalls.map((p) => (
                <div
                  key={p.id}
                  className="card-parchment p-3 flex items-start gap-3 hover:border-terracotta/20 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-terracotta/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertTriangle className="w-4 h-4 text-terracotta" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm text-espresso truncate">{p.location}</span>
                      <span className="text-[10px] text-espresso-300/60 flex-shrink-0">{p.created_at}</span>
                    </div>
                    <span className="inline-block px-2 py-0.5 rounded-full bg-terracotta/10 text-terracotta text-[11px] font-medium mb-1">
                      {p.tag}
                    </span>
                    {p.description && (
                      <p className="text-xs text-espresso-300 leading-relaxed line-clamp-2">{p.description}</p>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                    className="p-1 rounded-md text-espresso-300/40 hover:text-terracotta hover:bg-terracotta/10 flex-shrink-0 mt-2 transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 右侧：透明区域，地图透出 */}
      <div className="hidden md:block flex-1 h-full" />
    </div>
  );
}