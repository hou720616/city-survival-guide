import { useEffect, useRef } from "react";
import AMapLoader from "@amap/amap-jsapi-loader";
import { useMapStore } from "@/store/useMapStore";

// 高德地图 Key 与安全密钥
const AMAP_KEY = "3b3e3662ca0214dce0718139f52685b3";
const AMAP_SECURITY_CODE = "babfbf0d03bcf13fc5f20ff2b1b37861";

export default function GlobalMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const setMapInstance = useMapStore((s) => s.setMapInstance);

  useEffect(() => {
    // 配置安全密钥（必须在 load 之前设置）
    window._AMapSecurityConfig = {
      securityJsCode: AMAP_SECURITY_CODE,
    };

    let map: unknown = null;

    AMapLoader.load({
      key: AMAP_KEY,
      version: "2.0",
      plugins: ["AMap.DistrictSearch", "AMap.Geocoder", "AMap.AutoComplete"],
    })
      .then((AMap) => {
        if (!mapRef.current) return;

        map = new AMap.Map(mapRef.current, {
          zoom: 4, // 初始全国视角
          center: [104.195, 35.861], // 中国地理中心
          zoomEnable: false, // 休眠态默认禁用缩放
          dragEnable: false, // 休眠态默认禁用拖拽
          doubleClickZoom: false,
          scrollWheel: false,
          showLabel: true,
          viewMode: "2D",
        });

        setMapInstance(map as never);
      })
      .catch((e) => {
        console.error("高德地图加载失败:", e);
      });

    return () => {
      if (map && typeof map === "object" && "destroy" in map) {
        (map as { destroy: () => void }).destroy();
      }
      setMapInstance(null);
    };
  }, [setMapInstance]);

  return (
    <div
      ref={mapRef}
      className="map-container map-sleep"
      aria-hidden="true"
    >
      {/* 渐变遮罩层：实现地图与背景的软过渡 */}
      <div className="map-mask" />
    </div>
  );
}
