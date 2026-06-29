import { useState, useEffect, useRef } from "react";
import { fetchPitfalls, type PitfallRecord } from "@/api";

interface BubbleItem {
  id: number;
  tag: string;
  subtitle: string;
  x: number;
  size: number;
  duration: number;
}

/** 用于生成气泡的纯文本条目（真实记录或预设标签兜底） */
interface PitfallEntry {
  tag: string;
  subtitle: string;
}

const CITIES = ["北京", "上海", "广州", "深圳", "杭州", "南京", "成都", "武汉"];

/** 当真实记录不足时，用预设标签 + 随机城市合成兜底条目 */
const MIN_ENTRIES = 20;

/** 洗牌算法 */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function BubbleRise() {
  const [entries, setEntries] = useState<PitfallEntry[]>([]);
  const [bubbles, setBubbles] = useState<BubbleItem[]>([]);
  const indexRef = useRef(0);
  const bubbleIdRef = useRef(0);

  // 加载所有城市的避坑数据 + 预设标签兜底
  useEffect(() => {
    Promise.allSettled(CITIES.map((city) => fetchPitfalls(city))).then((results) => {
      const all: PitfallRecord[] = [];
      const allTags = new Set<string>();

      results.forEach((r) => {
        if (r.status === "fulfilled") {
          all.push(...r.value.data);
          r.value.tags.forEach((t) => allTags.add(t));
        }
      });

      // 真实条目：tag + 描述/地点
      const entries: PitfallEntry[] = all.map((p) => ({
        tag: p.tag,
        subtitle: p.description
          ? p.description.length > 8 ? p.description.slice(0, 8) + "…" : p.description
          : p.location,
      }));

      // 不足时用预设标签兜底，随机分配城市名作为副标题
      if (entries.length < MIN_ENTRIES) {
        const presetTags = [...allTags].filter((t) => t !== "其他");
        const pool: PitfallEntry[] = [];
        for (const tag of presetTags) {
          pool.push({ tag, subtitle: CITIES[Math.floor(Math.random() * CITIES.length)] });
        }
        // 洗牌后取需要的数量补齐
        const needed = MIN_ENTRIES - entries.length;
        const synthetic = shuffle(pool).slice(0, needed);
        entries.push(...synthetic);
      }

      setEntries(shuffle(entries));
    });
  }, []);

  // 定时生成气泡
  useEffect(() => {
    if (entries.length === 0) return;

    const spawn = () => {
      const e = entries[indexRef.current % entries.length];
      indexRef.current++;

      const id = bubbleIdRef.current++;
      const duration = 4 + Math.random() * 3; // 4-7s

      const bubble: BubbleItem = {
        id,
        tag: e.tag,
        subtitle: e.subtitle,
        x: Math.random() * 50 - 25, // -25% ~ +25% 水平偏移
        size: 70 + Math.random() * 40, // 70-110px
        duration,
      };

      setBubbles((prev) => [...prev, bubble]);

      // 动画结束后移除
      setTimeout(() => {
        setBubbles((prev) => prev.filter((b) => b.id !== id));
      }, duration * 1000);
    };

    spawn();
    const timer = setInterval(spawn, 1000 + Math.random() * 800); // 1.0-1.8s
    return () => clearInterval(timer);
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <div className="bubble-rise-container" aria-hidden>
      {bubbles.map((b) => (
        <div
          key={b.id}
          className="bubble-rise-item"
          style={{
            left: `${50 + b.x}%`,
            width: b.size,
            height: b.size,
            animationDuration: `${b.duration}s`,
          }}
        >
          <span className="bubble-tag">{b.tag}</span>
          <span className="bubble-desc">{b.subtitle}</span>
        </div>
      ))}
    </div>
  );
}