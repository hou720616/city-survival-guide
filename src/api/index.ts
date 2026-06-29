import type {
  SolutionResponse,
  ChatRequest,
  UserInput,
} from "@/types";

// 生产构建时通过 .env.production 注入服务器地址，开发模式走 Vite 代理
const API_BASE = import.meta.env.VITE_API_BASE || '';

// ===== 高德行政区划接口 =====

export interface DistrictData {
  city: string;
  districts: string[];
}

export interface SubDistrictData {
  district: string;
  sub_districts: string[];
}

/** 获取城市下的行政区列表 */
export async function fetchDistricts(city: string): Promise<DistrictData> {
  const res = await fetch(
    `${API_BASE}/api/amap/districts?city=${encodeURIComponent(city)}`
  );
  if (!res.ok) {
    throw new Error(`获取行政区失败: ${res.status}`);
  }
  return res.json();
}

/** 获取行政区下的街道/板块列表 */
export async function fetchSubDistricts(
  city: string,
  district: string
): Promise<SubDistrictData> {
  const params = new URLSearchParams({ district });
  if (city) params.set("city", city);
  const res = await fetch(`${API_BASE}/api/amap/sub-districts?${params}`);
  if (!res.ok) {
    throw new Error(`获取街道数据失败: ${res.status}`);
  }
  return res.json();
}

// ===== 避坑指南接口 =====

export interface PitfallRecord {
  id: number;
  city: string;
  location: string;
  address: string;
  lng: number;
  lat: number;
  tag: string;
  description: string;
  created_at: string;
}

export interface PitfallListResponse {
  data: PitfallRecord[];
  total: number;
  tags: string[];
}

export interface PitfallCreateRequest {
  city: string;
  location: string;
  tag: string;
  description: string;
}

/** 获取避坑记录列表 */
export async function fetchPitfalls(city?: string): Promise<PitfallListResponse> {
  const params = city ? `?city=${encodeURIComponent(city)}` : "";
  const res = await fetch(`${API_BASE}/api/pitfalls${params}`);
  if (!res.ok) throw new Error(`获取避坑记录失败: ${res.status}`);
  return res.json();
}

/** 提交一条避坑记录 */
export async function submitPitfall(
  data: PitfallCreateRequest
): Promise<{ data?: PitfallRecord; error?: string }> {
  const res = await fetch(`${API_BASE}/api/pitfalls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`提交失败: ${res.status}`);
  return res.json();
}

/** 删除一条避坑记录（仅允许删除自己IP提交的） */
export async function deletePitfall(
  id: number
): Promise<{ message?: string; error?: string }> {
  const res = await fetch(`${API_BASE}/api/pitfalls/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`删除失败: ${res.status}`);
  return res.json();
}

// ===== 方案生成接口 =====
export async function generateSolution(
  input: UserInput
): Promise<SolutionResponse> {
  const res = await fetch(`${API_BASE}/api/solution/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(`方案生成失败: ${res.status}`);
  }

  return res.json();
}

// ===== AI 对话接口（流式） =====
export async function* streamChat(
  request: ChatRequest
): AsyncGenerator<string, void, unknown> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    throw new Error(`对话失败: ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("无法读取响应流");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;

      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return;

      try {
        const parsed = JSON.parse(data);
        if (parsed.content) {
          yield parsed.content as string;
        }
      } catch {
        // 忽略解析错误，继续处理下一行
      }
    }
  }
}
