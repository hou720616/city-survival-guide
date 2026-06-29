import { create } from "zustand";
import { CITY_COORDS } from "@/types";

type AMapInstance = {
  setStatus: (status: Record<string, boolean>) => void;
  setZoomAndCenter: (
    zoom: number,
    center: [number, number],
    immediately?: boolean,
    duration?: number
  ) => void;
  add: (overlay: unknown) => void;
  remove: (overlay: unknown) => void;
  destroy: () => void;
  setFitView: (overlays?: unknown[], immediately?: boolean, avoid?: number[]) => void;
};

type OverlayInstance = unknown;

type AMapNamespace = {
  Marker: new (opts: unknown) => { on: (event: string, handler: () => void) => void };
  Circle: new (opts: unknown) => OverlayInstance;
  Polygon: new (opts: unknown) => OverlayInstance;
  InfoWindow: new (opts: unknown) => { open: (map: unknown, pos: [number, number]) => void; close: () => void };
  DistrictSearch: new (opts: { level: string; subdistrict: number; extensions?: string }) => {
    search: (keyword: string, callback: (status: string, result: unknown) => void) => void;
  };
  Geocoder: new (opts?: { city?: string }) => {
    getLocation: (keyword: string, callback: (status: string, result: unknown) => void) => void;
  };
};

interface MapState {
  mapInstance: AMapInstance | null;
  setMapInstance: (map: AMapInstance | null) => void;
  currentMarker: OverlayInstance | null;
  overlays: OverlayInstance[];
  pitfallOverlays: OverlayInstance[];
  isActive: boolean;
  activateMap: (cityName: string) => void;
  sleepMap: () => void;
  highlightDistrict: (cityName: string, districtName: string) => void;
  clearPolygons: () => void;
  activateResultMap: (cityName: string, recommendedAreas: string[]) => void;
  /** 在地图上显示避坑标记 */
  showPitfallMarkers: (cityName: string, pitfalls: Array<{ lng: number; lat: number; tag: string; location: string; description: string }>) => void;
  /** 清除避坑标记 */
  clearPitfallMarkers: () => void;
}

const ADMIN_PREFIXES: Record<string, string> = {
  朝阳: "朝阳区",
  海淀: "海淀区",
  西城: "西城区",
  丰台: "丰台区",
  通州: "通州区",
  浦东: "浦东新区",
  徐汇: "徐汇区",
  静安: "静安区",
  闵行: "闵行区",
  宝山: "宝山区",
  天河: "天河区",
  越秀: "越秀区",
  番禺: "番禺区",
  白云: "白云区",
  黄埔: "黄埔区",
  龙华: "龙华区",
  宝安: "宝安区",
  龙岗: "龙岗区",
  坪山: "坪山区",
  光明: "光明区",
  滨江: "滨江区",
  余杭: "余杭区",
  萧山: "萧山区",
  临平: "临平区",
  武侯: "武侯区",
  成华: "成华区",
  龙泉驿: "龙泉驿区",
  双流: "双流区",
  江夏: "江夏区",
  江宁: "江宁区",
  浦口: "浦口区",
  六合: "六合区",
  长安: "长安区",
  未央: "未央区",
  灞桥: "灞桥区",
  渝北: "渝北区",
  沙坪坝: "沙坪坝区",
  南岸: "南岸区",
  九龙坡: "九龙坡区",
  大渡口: "大渡口区",
  吴中: "吴中区",
  相城: "相城区",
  吴江: "吴江区",
  西青: "西青区",
  北辰: "北辰区",
  东丽: "东丽区",
  津南: "津南区",
  武清: "武清区",
};

const stripAreaText = (area: string) =>
  area
    .replace(/[（(].*?[）)]/g, "")
    .replace(/[，,。；;：:].*$/g, "")
    .trim();

const extractDistrictKeyword = (area: string) => {
  const clean = stripAreaText(area);
  const explicit = clean.match(/[\u4e00-\u9fa5]{1,8}(?:新区|区|县|市)/);
  if (explicit) return explicit[0];

  const matchedPrefix = Object.keys(ADMIN_PREFIXES).find((prefix) => clean.startsWith(prefix));
  if (matchedPrefix) return ADMIN_PREFIXES[matchedPrefix];

  return "";
};

const parsePath = (polygon: unknown): [number, number][] => {
  if (!Array.isArray(polygon)) return [];
  return polygon
    .map((coord) => {
      if (typeof coord === "string") {
        const [lng, lat] = coord.split(",").map(Number);
        return [lng, lat] as [number, number];
      }
      if (Array.isArray(coord) && coord.length >= 2) {
        return [Number(coord[0]), Number(coord[1])] as [number, number];
      }
      if (coord && typeof coord === "object" && "lng" in coord && "lat" in coord) {
        const point = coord as { lng: number; lat: number };
        return [point.lng, point.lat] as [number, number];
      }
      return null;
    })
    .filter((coord): coord is [number, number] => Boolean(coord && Number.isFinite(coord[0]) && Number.isFinite(coord[1])));
};

const getAMap = () => (window as unknown as { AMap?: AMapNamespace }).AMap;

export const useMapStore = create<MapState>((set, get) => {
  const addOverlay = (overlay: OverlayInstance) => {
    const { mapInstance } = get();
    if (!mapInstance) return;
    mapInstance.add(overlay);
    set((state) => ({ overlays: [...state.overlays, overlay] }));
  };

  let pitfallFitTimer: ReturnType<typeof setTimeout> | null = null;

  const clearOverlays = () => {
    const { mapInstance, overlays } = get();
    if (!mapInstance) return;
    overlays.forEach((overlay) => mapInstance.remove(overlay));
    set({ overlays: [] });
  };

  const addFallbackMarker = (
    cityName: string,
    areaName: string,
    color: string,
    fillColor: string,
    labelIndex?: number,
    fitView = true
  ) => {
    const { mapInstance } = get();
    const AMap = getAMap();
    if (!mapInstance || !AMap) return;

    const geocoder = new AMap.Geocoder({ city: cityName });
    const keyword = `${cityName}${stripAreaText(areaName)}`;
    geocoder.getLocation(keyword, (status, result) => {
      const res = result as {
        geocodes?: Array<{ location?: { lng: number; lat: number } }>;
      };
      const location = res.geocodes?.[0]?.location;
      if (status !== "complete" || !location) return;

      const center: [number, number] = [location.lng, location.lat];
      const circle = new AMap.Circle({
        center,
        radius: labelIndex ? 3200 : 2600,
        strokeColor: color,
        strokeOpacity: 0.95,
        strokeWeight: 3,
        fillColor,
        fillOpacity: 0.22,
        zIndex: 18,
      });
      const marker = new AMap.Marker({
        position: center,
        content: `<div style="padding:7px 12px;border-radius:999px;background:${color};color:#fff;font-size:12px;font-weight:700;box-shadow:0 4px 14px rgba(0,0,0,.22);white-space:nowrap;border:2px solid rgba(255,255,255,.9);">${labelIndex ? labelIndex + ". " : ""}${stripAreaText(areaName)}</div>`,
        offset: [-24, -20],
        zIndex: 30,
      });
      addOverlay(circle);
      addOverlay(marker);
      if (fitView) {
        mapInstance.setFitView([circle, marker], true, [90, 90, 90, 90]);
      }
    });
  };

  const drawDistrict = (
    cityName: string,
    areaName: string,
    color: string,
    fillColor: string,
    labelIndex?: number,
    fitView = true
  ) => {
    const { mapInstance } = get();
    const AMap = getAMap();
    if (!mapInstance || !AMap) return;

    // 先画一个可见的圆形区域和标签，保证用户立即看到地图反馈。
    addFallbackMarker(cityName, areaName, color, fillColor, labelIndex, fitView);

    const districtKeyword = extractDistrictKeyword(areaName);
    if (!districtKeyword) return;

    const districtSearch = new AMap.DistrictSearch({
      level: "district",
      subdistrict: 0,
      extensions: "all",
    });

    districtSearch.search(`${cityName}${districtKeyword}`, (status, result) => {
      const res = result as {
        info?: string;
        districtList?: Array<{ boundaries?: unknown[] }>;
      };
      const boundaries = res.districtList?.[0]?.boundaries;

      if (status !== "complete" || res.info !== "OK" || !boundaries?.length) return;

      const drawn: OverlayInstance[] = [];
      boundaries.forEach((polygon) => {
        const path = parsePath(polygon);
        if (!path.length) return;
        const overlay = new AMap.Polygon({
          path,
          strokeColor: color,
          strokeWeight: 3,
          strokeOpacity: 0.95,
          fillColor,
          fillOpacity: 0.28,
          zIndex: 12,
        });
        addOverlay(overlay);
        drawn.push(overlay);
      });

      if (drawn.length > 0 && fitView) {
        mapInstance.setFitView(drawn, true, [80, 80, 80, 80]);
      }
    });
  };

  return {
    mapInstance: null,
    setMapInstance: (map) => set({ mapInstance: map }),
    currentMarker: null,
    overlays: [],
    isActive: false,
    pitfallOverlays: [] as OverlayInstance[],

    activateMap: (cityName: string) => {
      const { mapInstance, currentMarker } = get();
      const AMap = getAMap();
      if (!mapInstance || !AMap) return;

      const coord = CITY_COORDS[cityName];
      if (!coord) return;

      mapInstance.setStatus({ zoomEnable: true, dragEnable: true, scrollWheel: true });
      mapInstance.setZoomAndCenter(coord.zoom, [coord.lng, coord.lat], true, 800);

      if (currentMarker) mapInstance.remove(currentMarker);

      const marker = new AMap.Marker({
        position: [coord.lng, coord.lat],
        animation: "AMAP_ANIMATION_DROP",
      });
      mapInstance.add(marker);

      set({ currentMarker: marker, isActive: true });
    },

    sleepMap: () => {
      const { mapInstance, currentMarker } = get();
      if (!mapInstance) return;

      // #region debug-point A:sleepMap
      try {
        mapInstance.setStatus({ zoomEnable: false, dragEnable: false, scrollWheel: false });
        if (currentMarker) mapInstance.remove(currentMarker);
        clearOverlays();
        mapInstance.setZoomAndCenter(4, [104.195, 35.861], true, 600);
        set({ currentMarker: null, isActive: false });
        (window as unknown as { __dbg?: (h: string, m: string, d: unknown) => void }).__dbg?.("A", "sleepMap OK", {});
      } catch (err) {
        (window as unknown as { __dbg?: (h: string, m: string, d: unknown) => void }).__dbg?.("A", "sleepMap THREW", { error: String(err), stack: (err as Error)?.stack });
        throw err;
      }
      // #endregion
    },

    highlightDistrict: (cityName: string, districtName: string) => {
      const { mapInstance } = get();
      if (!mapInstance || !districtName) return;
      clearOverlays();
      drawDistrict(cityName, districtName, "#c75b3a", "#c75b3a");
    },

    clearPolygons: clearOverlays,

    activateResultMap: (cityName: string, recommendedAreas: string[]) => {
      const { mapInstance, currentMarker } = get();
      const AMap = getAMap();
      if (!mapInstance || !AMap) return;

      if (currentMarker) mapInstance.remove(currentMarker);
      clearOverlays();

      const coord = CITY_COORDS[cityName];
      if (!coord) return;

      mapInstance.setStatus({ zoomEnable: true, dragEnable: true, scrollWheel: true });
      // 结果页使用更高缩放级别（区级视角），便于查看推荐区域细节
      const resultZoom = Math.min(coord.zoom + 2, 16);
      mapInstance.setZoomAndCenter(resultZoom, [coord.lng, coord.lat], true, 800);

      const marker = new AMap.Marker({
        position: [coord.lng, coord.lat],
        animation: "AMAP_ANIMATION_DROP",
      });
      mapInstance.add(marker);

      const colors = [
        { stroke: "#c75b3a", fill: "#c75b3a" },
        { stroke: "#5a8a6e", fill: "#5a8a6e" },
        { stroke: "#e8a838", fill: "#e8a838" },
      ];

      recommendedAreas.slice(0, 3).forEach((area, idx) => {
        const color = colors[idx % colors.length];
        drawDistrict(cityName, area, color.stroke, color.fill, idx + 1, false);
      });

      // 等待地理编码/行政区搜索完成后，自动适配视野以展示所有推荐区域
      setTimeout(() => {
        const { overlays } = get();
        if (overlays.length > 0) {
          mapInstance.setFitView(overlays, true, [80, 80, 80, 80]);
        }
      }, 1500);

      set({ currentMarker: marker, isActive: true });
    },

    showPitfallMarkers: (cityName, pitfalls) => {
      const { mapInstance } = get();
      const AMap = getAMap();
      if (!mapInstance || !AMap) return;

      // #region debug-point B:showPitfall
      const _dbg = (window as unknown as { __dbg?: (h: string, m: string, d: unknown) => void }).__dbg;
      _dbg?.("B", "showPitfallMarkers ENTER", { cityName, count: pitfalls.length, hasCoord: !!CITY_COORDS[cityName] });
      try {
      // #endregion
      if (pitfallFitTimer) {
        clearTimeout(pitfallFitTimer);
        pitfallFitTimer = null;
      }

      // 先清除旧的避坑标记
      const { pitfallOverlays } = get();
      pitfallOverlays.forEach((o) => mapInstance.remove(o));

      const coord = CITY_COORDS[cityName];
      if (coord) {
        mapInstance.setStatus({ zoomEnable: true, dragEnable: true, scrollWheel: true });
        mapInstance.setZoomAndCenter(coord.zoom, [coord.lng, coord.lat], true, 600);
      }
      set({ isActive: true });

      const newOverlays: OverlayInstance[] = [];
      pitfalls.forEach((p) => {
        const marker = new AMap.Marker({
          position: [p.lng, p.lat],
          content: `<div style="padding:5px 10px;border-radius:6px;background:#e53e3e;color:#fff;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 2px 8px rgba(229,62,62,.4);">${p.tag}</div>`,
          offset: [-16, -16],
          zIndex: 50,
        });
        let infoWindow: InstanceType<AMapNamespace["InfoWindow"]> | null = null;
        marker.on("mouseover", () => {
          const descHtml = p.description
            ? `<br/><span style="font-size:12px;color:#999;line-height:1.4;">${p.description}</span>`
            : "";
          infoWindow = new AMap.InfoWindow({
            content: `<div style="padding:6px 10px;max-width:220px;"><strong>${p.location}</strong><br/><span style="font-size:12px;color:#c75b3a;">${p.tag}</span>${descHtml}</div>`,
            offset: [0, -30],
          });
          infoWindow.open(mapInstance, [p.lng, p.lat]);
        });
        marker.on("mouseout", () => {
          if (infoWindow) {
            infoWindow.close();
            infoWindow = null;
          }
        });
        mapInstance.add(marker);
        newOverlays.push(marker);
      });

      set({ pitfallOverlays: newOverlays, isActive: true });

      // 适配视野
      if (newOverlays.length > 0) {
        pitfallFitTimer = setTimeout(() => {
          // #region debug-point B:fitView
          try {
            if (get().pitfallOverlays === newOverlays) {
              mapInstance.setFitView(newOverlays, true, [80, 80, 80, 80]);
            }
          } catch (err) {
            (window as unknown as { __dbg?: (h: string, m: string, d: unknown) => void }).__dbg?.("B", "setFitView THREW", { error: String(err), stack: (err as Error)?.stack });
          }
          // #endregion
          pitfallFitTimer = null;
        }, 300);
      }
      // #region debug-point B:showPitfall-end
      _dbg?.("B", "showPitfallMarkers OK", { added: newOverlays.length });
      } catch (err) {
        _dbg?.("B", "showPitfallMarkers THREW", { error: String(err), stack: (err as Error)?.stack });
        throw err;
      }
      // #endregion
    },

    clearPitfallMarkers: () => {
      const { mapInstance, pitfallOverlays } = get();
      if (!mapInstance) return;
      if (pitfallFitTimer) {
        clearTimeout(pitfallFitTimer);
        pitfallFitTimer = null;
      }
      pitfallOverlays.forEach((o) => mapInstance.remove(o));
      set({ pitfallOverlays: [] });
    },
  };
});
