import { subDays, format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type Area = Database["public"]["Tables"]["areas"]["Row"];
type AreaType = Database["public"]["Enums"]["area_type"];

interface DemoScore {
  date: string;
  score: number;
}

interface DemoCheckin {
  date: string;
  completed: boolean;
  area_id: string;
}

const DEMO_AREAS: Area[] = [
  { id: "demo-health-1", user_id: "demo", name: "Morning run", type: "health", frequency_per_week: 5, archived_at: null, created_at: "", updated_at: "", tracking_mode: "binary", unit_label: null, baseline_initial: null, show_quick_add_home: true },
  { id: "demo-study-1", user_id: "demo", name: "Read 30 min", type: "study", frequency_per_week: 7, archived_at: null, created_at: "", updated_at: "", tracking_mode: "binary", unit_label: null, baseline_initial: null, show_quick_add_home: true },
  { id: "demo-reduce-1", user_id: "demo", name: "No social after 9pm", type: "reduce", frequency_per_week: 7, archived_at: null, created_at: "", updated_at: "", tracking_mode: "binary", unit_label: null, baseline_initial: null, show_quick_add_home: true },
  { id: "demo-finance-1", user_id: "demo", name: "Track expenses", type: "finance", frequency_per_week: 3, archived_at: null, created_at: "", updated_at: "", tracking_mode: "binary", unit_label: null, baseline_initial: null, show_quick_add_home: true },
];

// Seeded pseudo-random for deterministic demo data
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

function generateScores(area: Area, days: number): { scores: DemoScore[]; checkins: DemoCheckin[] } {
  const rand = seededRandom(area.id.charCodeAt(5) * 1000 + days);
  const today = new Date();
  const scores: DemoScore[] = [];
  const checkins: DemoCheckin[] = [];
  let cumulative = 0;
  let consecutiveMissed = 0;
  const freq = area.frequency_per_week;

  for (let i = days - 1; i >= 0; i--) {
    const d = subDays(today, i);
    const dateStr = format(d, "yyyy-MM-dd");
    const dayOfWeek = d.getDay();

    let prob = freq / 7;
    // Improving over time
    const progress = 1 - (i / days) * 0.3;
    prob *= progress;
    // Weekend dip for health
    if (area.type === "health" && (dayOfWeek === 0 || dayOfWeek === 6)) prob *= 0.6;
    // Streaks
    if (checkins.length > 0 && checkins[checkins.length - 1].completed) prob = Math.min(prob * 1.2, 0.95);

    const completed = rand() < prob;
    checkins.push({ date: dateStr, completed, area_id: area.id });

    if (completed) {
      consecutiveMissed = 0;
      cumulative += 1;
    } else {
      consecutiveMissed++;
      cumulative += -1 * (1 + consecutiveMissed * 0.5);
    }
    scores.push({ date: dateStr, score: cumulative });
  }

  return { scores, checkins };
}

let _cache: {
  areas: Area[];
  scores: Record<string, DemoScore[]>;
  checkins: Record<string, DemoCheckin[]>;
} | null = null;

export function getDemoData(days: number = 365) {
  if (_cache && Object.values(_cache.scores)[0]?.length === days) return _cache;

  const scores: Record<string, DemoScore[]> = {};
  const checkins: Record<string, DemoCheckin[]> = {};

  for (const area of DEMO_AREAS) {
    const result = generateScores(area, days);
    scores[area.id] = result.scores;
    checkins[area.id] = result.checkins;
  }

  _cache = { areas: DEMO_AREAS, scores, checkins };
  return _cache;
}

export function getDemoAreas(): Area[] {
  return DEMO_AREAS;
}

export function getDemoScoresForRange(timeRangeDays: number): Record<string, DemoScore[]> {
  const full = getDemoData(365);
  const result: Record<string, DemoScore[]> = {};
  for (const [areaId, allScores] of Object.entries(full.scores)) {
    result[areaId] = allScores.slice(-timeRangeDays);
  }
  return result;
}

export function getDemoCheckinsLast30(areaId: string): Record<string, boolean> {
  const full = getDemoData(365);
  const areaCheckins = full.checkins[areaId] || [];
  const last30 = areaCheckins.slice(-30);
  const map: Record<string, boolean> = {};
  for (const c of last30) {
    map[c.date] = c.completed;
  }
  return map;
}

export function getDemoTodayCheckins(): Record<string, boolean> {
  const full = getDemoData(365);
  const today = format(new Date(), "yyyy-MM-dd");
  const result: Record<string, boolean> = {};
  for (const [areaId, areaCheckins] of Object.entries(full.checkins)) {
    const todayCheckin = areaCheckins.find((c) => c.date === today);
    if (todayCheckin) result[areaId] = todayCheckin.completed;
  }
  return result;
}
