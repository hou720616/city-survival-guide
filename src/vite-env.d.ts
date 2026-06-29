/// <reference types="vite/client" />

// 高德地图安全密钥配置类型声明
interface Window {
  _AMapSecurityConfig?: {
    securityJsCode?: string;
    serviceHost?: string;
  };
  AMap?: unknown;
}
