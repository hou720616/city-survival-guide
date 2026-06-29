// ===== 用户输入类型 =====
export type IdentityType =
  | "应届生"
  | "打工人"
  | "自由职业者"
  | "带娃家庭"
  | "随迁老人";

export type LifePreference = "安静" | "热闹" | "便利" | "性价比";

export interface UserInput {
  city: string;
  identity: IdentityType;
  income: number;
  work_location: string;
  commute_max_time: number;
  accept_share?: boolean;
  life_preferences?: LifePreference[];
  special_needs?: string;
}

// ===== AI 方案响应类型 =====
export interface UserProfile {
  priority_issues: string[];
  risk_level: "低" | "中等" | "高";
}

export interface HousingAdvice {
  recommended_areas: string[];
  price_range: [number, number];
  tips: string[];
}

export interface CommutePlan {
  best_option: string;
  time: string;
  cost: string;
  alternatives?: Array<{ option: string; time: string; cost: string }>;
}

export interface BudgetBreakdown {
  rent: number;
  transport: number;
  food: number;
  utilities: number;
  other: number;
}

export interface BudgetPlan {
  first_month: number;
  monthly: number;
  breakdown: BudgetBreakdown;
}

export interface Solution {
  user_profile: UserProfile;
  housing: HousingAdvice;
  commute: CommutePlan;
  budget: BudgetPlan;
  tasks: string[];
  warnings: string[];
}

export interface SolutionResponse {
  success: boolean;
  data: Solution;
}

// ===== AI 对话类型 =====
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatContext {
  city: string;
  identity: string;
  income: number;
  work_location: string;
}

export interface ChatRequest {
  message: string;
  context: ChatContext;
  history?: ChatMessage[];
}

// ===== 常量数据 =====
export const HOT_CITIES = [
  "北京",
  "上海",
  "广州",
  "深圳",
  "杭州",
  "成都",
  "武汉",
  "南京",
  "西安",
  "重庆",
  "苏州",
  "天津",
];

export const IDENTITIES: Array<{
  value: IdentityType;
  label: string;
  emoji: string;
  desc: string;
}> = [
  { value: "应届生", label: "应届生", emoji: "🎓", desc: "首次到大城市工作" },
  { value: "打工人", label: "打工人", emoji: "💼", desc: "已有工作经验" },
  { value: "自由职业者", label: "自由职业者", emoji: "🎨", desc: "灵活办公" },
  { value: "带娃家庭", label: "带娃家庭", emoji: "👨‍👩‍👧", desc: "关注教育医疗" },
  { value: "随迁老人", label: "随迁老人", emoji: "👴", desc: "随子女进城" },
];

export const COMMUTE_OPTIONS = [30, 45, 60];

export const LIFE_PREFERENCES: LifePreference[] = [
  "安静",
  "热闹",
  "便利",
  "性价比",
];

// 城市中心经纬度与推荐缩放级别（不调用地理编码API，节省配额）
export interface CityCoord {
  lng: number;
  lat: number;
  zoom: number;
}

export const CITY_COORDS: Record<string, CityCoord> = {
  "北京": { lng: 116.4074, lat: 39.9042, zoom: 11 },
  "上海": { lng: 121.4737, lat: 31.2304, zoom: 11 },
  "广州": { lng: 113.2644, lat: 23.1291, zoom: 11 },
  "深圳": { lng: 114.0579, lat: 22.5431, zoom: 11 },
  "杭州": { lng: 120.1551, lat: 30.2741, zoom: 11 },
  "成都": { lng: 104.0668, lat: 30.5728, zoom: 11 },
  "武汉": { lng: 114.3055, lat: 30.5931, zoom: 11 },
  "南京": { lng: 118.7969, lat: 32.0603, zoom: 11 },
  "西安": { lng: 108.9398, lat: 34.3416, zoom: 11 },
  "重庆": { lng: 106.5516, lat: 29.5630, zoom: 11 },
  "苏州": { lng: 120.5853, lat: 31.2990, zoom: 11 },
  "天津": { lng: 117.2009, lat: 39.0842, zoom: 11 },
};
