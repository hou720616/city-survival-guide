import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Sparkles, ChevronRight } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useMapStore } from "@/store/useMapStore";
import { generateSolution, fetchDistricts, fetchSubDistricts, fetchPitfalls } from "@/api";
import {
  HOT_CITIES,
  IDENTITIES,
  COMMUTE_OPTIONS,
  LIFE_PREFERENCES,
  type IdentityType,
  type LifePreference,
  type UserInput,
} from "@/types";

export default function Survey() {
  const navigate = useNavigate();
  const { userInput, setUserInput, setSolution, setChatContext, setLoading, isLoading } =
    useAppStore();
  const { activateMap, sleepMap, mapInstance, highlightDistrict, clearPolygons, showPitfallMarkers, clearPitfallMarkers } = useMapStore();

  // 从全局 store 初始化表单，返回页面时保留上次输入，避免重新填写
  const [form, setForm] = useState<UserInput>(
    userInput ?? {
      city: "",
      identity: "应届生" as IdentityType,
      income: 8000,
      work_location: "",
      commute_max_time: 45,
      accept_share: true,
      life_preferences: ["便利"],
      special_needs: "",
    }
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const formCardRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLElement | null>(null);
  const prevCityRef = useRef<string>("");

  // 行政区划数据：从高德 API 动态获取
  const [districts, setDistricts] = useState<string[]>([]);
  const [subDistricts, setSubDistricts] = useState<string[]>([]);
  const [districtsLoading, setDistrictsLoading] = useState(false);
  const [subDistrictsLoading, setSubDistrictsLoading] = useState(false);
  // 选中的行政区（用于联动街道下拉）
  const [selectedDistrict, setSelectedDistrict] = useState("");

  // 城市变更时，从高德 API 获取行政区列表
  useEffect(() => {
    if (!form.city) {
      setDistricts([]);
      setSubDistricts([]);
      setSelectedDistrict("");
      return;
    }

    let cancelled = false;
    setDistrictsLoading(true);
    setDistricts([]);
    setSubDistricts([]);
    setSelectedDistrict("");

    fetchDistricts(form.city)
      .then((data) => {
        if (!cancelled) {
          setDistricts(data.districts);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("获取行政区列表失败:", err);
          setDistricts([]);
        }
      })
      .finally(() => {
        if (!cancelled) setDistrictsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.city]);

  // 行政区变更时，从高德 API 获取街道列表
  useEffect(() => {
    if (!form.city || !selectedDistrict) {
      setSubDistricts([]);
      return;
    }

    let cancelled = false;
    setSubDistrictsLoading(true);
    setSubDistricts([]);

    fetchSubDistricts(form.city, selectedDistrict)
      .then((data) => {
        if (!cancelled) {
          setSubDistricts(data.sub_districts);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("获取街道列表失败:", err);
          setSubDistricts([]);
        }
      })
      .finally(() => {
        if (!cancelled) setSubDistrictsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.city, selectedDistrict]);

  // 城市选择联动地图：选择城市时激活地图，清空时休眠
  useEffect(() => {
    if (!mapInstance) return;

    const mapEl = document.querySelector(".map-container");

    if (form.city && form.city !== prevCityRef.current) {
      // 城市变更：激活地图 + 表单右移至左侧40%
      if (mapEl) {
        mapEl.classList.remove("map-sleep");
        mapEl.classList.add("map-active");
      }
      if (formCardRef.current) {
        formCardRef.current.classList.add("form-active");
      }
      activateMap(form.city);
      clearPolygons(); // 清除旧行政区多边形
      prevCityRef.current = form.city;
    } else if (!form.city && prevCityRef.current) {
      // 清空城市：休眠地图 + 表单回正居中
      if (mapEl) {
        mapEl.classList.remove("map-active");
        mapEl.classList.add("map-sleep");
      }
      if (formCardRef.current) {
        formCardRef.current.classList.remove("form-active");
      }
      sleepMap();
      prevCityRef.current = "";
    }
  }, [form.city, mapInstance, activateMap, sleepMap, clearPolygons]);

  // 城市变更时加载避坑标记
  useEffect(() => {
    if (!mapInstance || !form.city) return;
    fetchPitfalls(form.city).then((res) => {
      showPitfallMarkers(form.city, res.data);
    }).catch(() => {
      // 静默失败，不影响主流程
    });
  }, [form.city, mapInstance, showPitfallMarkers]);

  // 行政区选择联动地图：高亮行政区边界
  useEffect(() => {
    if (!mapInstance || !form.city || !form.work_location) return;
    highlightDistrict(form.city, form.work_location);
  }, [form.work_location, form.city, mapInstance, highlightDistrict]);

  // 离开页面时重置地图到休眠态
  useEffect(() => {
    return () => {
      const mapEl = document.querySelector(".map-container");
      if (mapEl) {
        mapEl.classList.remove("map-active");
        mapEl.classList.add("map-sleep");
      }
      clearPitfallMarkers();
      if (mapInstance) {
        sleepMap();
      }
    };
  }, [mapInstance, sleepMap, clearPitfallMarkers]);

  const updateForm = <K extends keyof UserInput>(
    key: K,
    value: UserInput[K]
  ) => {
    setForm((prev) => {
      // 切换城市时，清空已选的工作地点，避免残留上一个城市的区域
      if (key === "city" && value !== prev.city) {
        return { ...prev, city: value as string, work_location: "" };
      }
      return { ...prev, [key]: value };
    });
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  // 选择行政区：更新 selectedDistrict（触发街道加载），同时更新 work_location
  const handleDistrictChange = (district: string) => {
    setSelectedDistrict(district);
    if (district) {
      updateForm("work_location", district);
    } else {
      setSubDistricts([]);
      updateForm("work_location", "");
    }
  };

  // 选择街道：追加到 work_location
  const handleSubDistrictChange = (sub: string) => {
    if (sub) {
      updateForm("work_location", `${selectedDistrict}-${sub}`);
    } else {
      updateForm("work_location", selectedDistrict);
    }
  };

  const togglePreference = (pref: LifePreference) => {
    setForm((prev) => {
      const current = prev.life_preferences || [];
      const next = current.includes(pref)
        ? current.filter((p) => p !== pref)
        : [...current, pref];
      return { ...prev, life_preferences: next };
    });
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.city.trim()) errs.city = "请选择目标城市";
    if (!form.work_location.trim()) errs.work_location = "请输入工作地点";
    if (form.income <= 0) errs.income = "请输入有效的月收入";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    setUserInput(form);

    try {
      const res = await generateSolution(form);
      if (res.success && res.data) {
        setSolution(res.data);
        setChatContext({
          city: form.city,
          identity: form.identity,
          income: form.income,
          work_location: form.work_location,
        });
        navigate("/result");
      }
    } catch (err) {
      setErrors({
        submit:
          err instanceof Error
            ? err.message
            : "方案生成失败，请稍后重试",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen contour-decoration">
      <div ref={formCardRef} className="form-panel px-6 py-12">
        {/* 标题区 */}
        <div className="text-center mb-10">
          <p className="font-hand text-terracotta text-lg mb-2">
            Tell us about you
          </p>
          <h1 className="font-serif text-4xl font-bold text-espresso mb-3">
            告诉我们你的情况
          </h1>
          <p className="text-espresso-300">
            填写以下信息，AI 将为你定制专属城市适应方案
          </p>
        </div>

        {/* 表单卡片 */}
        <div className="card-parchment p-8 md:p-10 space-y-8">
          {/* 城市选择 */}
          <div>
            <label className="label-field">
              📍 选择目标城市 <span className="text-terracotta">*</span>
            </label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => updateForm("city", e.target.value)}
              placeholder="输入或选择城市"
              className="input-field"
            />
            <div className="flex flex-wrap gap-2 mt-3">
              {HOT_CITIES.map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => updateForm("city", city)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    form.city === city
                      ? "bg-terracotta text-white"
                      : "bg-parchment-200 text-espresso-300 hover:bg-terracotta/10 hover:text-terracotta"
                  }`}
                >
                  {city}
                </button>
              ))}
            </div>
            {errors.city && (
              <p className="text-terracotta text-xs mt-2">{errors.city}</p>
            )}
          </div>

          {/* 身份类型 */}
          <div>
            <label className="label-field">
              👤 你的身份 <span className="text-terracotta">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {IDENTITIES.map((identity) => (
                <button
                  key={identity.value}
                  type="button"
                  onClick={() => updateForm("identity", identity.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    form.identity === identity.value
                      ? "border-terracotta bg-terracotta/5"
                      : "border-parchment-400/40 hover:border-terracotta/40"
                  }`}
                >
                  <div className="text-2xl mb-1">{identity.emoji}</div>
                  <div className="font-semibold text-espresso text-sm">
                    {identity.label}
                  </div>
                  <div className="text-xs text-espresso-300">
                    {identity.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 收入与工作地点 */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="label-field">
                💰 月收入/预算 (元){" "}
                <span className="text-terracotta">*</span>
              </label>
              <input
                type="number"
                value={form.income || ""}
                onChange={(e) =>
                  updateForm("income", Number(e.target.value))
                }
                placeholder="如 8000"
                className="input-field"
                min="0"
                step="500"
              />
              {errors.income && (
                <p className="text-terracotta text-xs mt-2">{errors.income}</p>
              )}
            </div>
            <div>
              <label className="label-field">
                🏢 工作/学校地点 <span className="text-terracotta">*</span>
              </label>
              {form.city ? (
                <div className="space-y-2">
                  {/* 一级：行政区 */}
                  <select
                    value={selectedDistrict}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    className="input-field appearance-none bg-parchment-light"
                    disabled={districtsLoading}
                  >
                    <option value="">
                      {districtsLoading ? "加载中..." : "请选择行政区"}
                    </option>
                    {districts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  {/* 二级：街道/板块 */}
                  {selectedDistrict && (
                    <select
                      value={
                        form.work_location.includes("-")
                          ? form.work_location.split("-")[1]
                          : ""
                      }
                      onChange={(e) => handleSubDistrictChange(e.target.value)}
                      className="input-field appearance-none bg-parchment-light"
                      disabled={subDistrictsLoading}
                    >
                      <option value="">
                        {subDistrictsLoading
                          ? "加载中..."
                          : subDistricts.length > 0
                            ? "选择具体街道/板块（可选）"
                            : "无下级区域数据"}
                      </option>
                      {subDistricts.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  value={form.work_location}
                  onChange={(e) =>
                    updateForm("work_location", e.target.value)
                  }
                  placeholder="请先选择城市"
                  className="input-field"
                  disabled
                />
              )}
              {errors.work_location && (
                <p className="text-terracotta text-xs mt-2">
                  {errors.work_location}
                </p>
              )}
            </div>
          </div>

          {/* 通勤时间 */}
          <div>
            <label className="label-field">🚇 通勤接受时间上限</label>
            <div className="flex gap-3">
              {COMMUTE_OPTIONS.map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => updateForm("commute_max_time", time)}
                  className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                    form.commute_max_time === time
                      ? "bg-sage text-white"
                      : "bg-parchment-200 text-espresso-300 hover:bg-sage/10"
                  }`}
                >
                  {time}分钟
                </button>
              ))}
            </div>
          </div>

          {/* 合租意愿 */}
          <div>
            <label className="label-field">🏠 是否接受合租</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => updateForm("accept_share", true)}
                className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                  form.accept_share
                    ? "bg-terracotta text-white"
                    : "bg-parchment-200 text-espresso-300 hover:bg-terracotta/10"
                }`}
              >
                接受合租
              </button>
              <button
                type="button"
                onClick={() => updateForm("accept_share", false)}
                className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                  !form.accept_share
                    ? "bg-terracotta text-white"
                    : "bg-parchment-200 text-espresso-300 hover:bg-terracotta/10"
                }`}
              >
                整租独住
              </button>
            </div>
          </div>

          {/* 生活偏好 */}
          <div>
            <label className="label-field">🌿 生活偏好（可多选）</label>
            <div className="flex flex-wrap gap-2">
              {LIFE_PREFERENCES.map((pref) => {
                const selected = form.life_preferences?.includes(pref);
                return (
                  <button
                    key={pref}
                    type="button"
                    onClick={() => togglePreference(pref)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selected
                        ? "bg-sage text-white"
                        : "bg-parchment-200 text-espresso-300 hover:bg-sage/10"
                    }`}
                  >
                    {pref}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 特殊需求 */}
          <div>
            <label className="label-field">
              ✏️ 特殊需求{" "}
              <span className="text-espresso-300 font-normal text-xs">
                （选填）
              </span>
            </label>
            <textarea
              value={form.special_needs || ""}
              onChange={(e) => updateForm("special_needs", e.target.value)}
              placeholder="如：女生独居、宠物友好、靠近地铁站……"
              className="input-field min-h-[80px] resize-none"
              rows={3}
            />
          </div>

          {/* 提交错误 */}
          {errors.submit && (
            <div className="bg-terracotta/10 border border-terracotta/30 text-terracotta text-sm rounded-xl p-4">
              {errors.submit}
            </div>
          )}

          {/* 提交按钮 */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className="btn-primary w-full text-lg !py-4 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                AI 正在生成方案...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                生成我的城市指南
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
