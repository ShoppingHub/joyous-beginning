import { useMemo } from "react";
import { format, parseISO, startOfISOWeek, startOfMonth, differenceInDays } from "date-fns";
import { it, enUS } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Area = Database["public"]["Tables"]["areas"]["Row"];
type AreaType = Database["public"]["Enums"]["area_type"];
type Filter = "all" | AreaType;

export type Granularity = "daily" | "weekly" | "monthly";

export interface ChartPoint {
  date: string;       // original date key for grouping
  label: string;      // display label
  score: number;
  intraSlope?: number; // for weekly/monthly trend arrow
}

function getGranularity(data: { date: string }[]): Granularity {
  if (data.length < 2) return "daily";
  const first = parseISO(data[0].date);
  const last = parseISO(data[data.length - 1].date);
  const span = differenceInDays(last, first);
  if (span <= 90) return "daily";
  if (span <= 730) return "weekly";
  return "monthly";
}

function groupWeekly(data: { date: string; score: number }[]): ChartPoint[] {
  const buckets = new Map<string, { date: string; score: number }[]>();
  for (const d of data) {
    const weekStart = format(startOfISOWeek(parseISO(d.date)), "yyyy-MM-dd");
    if (!buckets.has(weekStart)) buckets.set(weekStart, []);
    buckets.get(weekStart)!.push(d);
  }
  const result: ChartPoint[] = [];
  for (const [weekStart, points] of buckets) {
    const sorted = points.sort((a, b) => a.date.localeCompare(b.date));
    const last = sorted[sorted.length - 1];
    const slope = computeIntraSlope(sorted.map(p => p.score));
    result.push({ date: weekStart, label: weekStart, score: last.score, intraSlope: slope });
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

function groupMonthly(data: { date: string; score: number }[]): ChartPoint[] {
  const buckets = new Map<string, { date: string; score: number }[]>();
  for (const d of data) {
    const monthStart = format(startOfMonth(parseISO(d.date)), "yyyy-MM");
    if (!buckets.has(monthStart)) buckets.set(monthStart, []);
    buckets.get(monthStart)!.push(d);
  }
  const result: ChartPoint[] = [];
  for (const [monthKey, points] of buckets) {
    const sorted = points.sort((a, b) => a.date.localeCompare(b.date));
    const last = sorted[sorted.length - 1];
    const slope = computeIntraSlope(sorted.map(p => p.score));
    result.push({ date: monthKey + "-01", label: monthKey, score: last.score, intraSlope: slope });
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

function computeIntraSlope(values: number[]): number {
  if (values.length < 2) return 0;
  const n = values.length;
  const sumX = values.reduce((s, _, i) => s + i, 0);
  const sumY = values.reduce((s, v) => s + v, 0);
  const sumXY = values.reduce((s, v, i) => s + i * v, 0);
  const sumX2 = values.reduce((s, _, i) => s + i * i, 0);
  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
}

export function computeSlope(data: { score: number }[], windowSize: number): number {
  if (data.length < 2) return 0;
  const window = data.slice(-windowSize);
  if (window.length < 2) return 0;
  return computeIntraSlope(window.map(d => d.score));
}

export function getLineColor(slope: number): string {
  if (slope > 0.1) return "#7DA3A0";
  if (slope < -0.1) return "#BFA37A";
  return "#8C9496";
}

export function getSlopeWindow(granularity: Granularity): number {
  if (granularity === "weekly") return 4;
  if (granularity === "monthly") return 3;
  return 7;
}

export function getTickInterval(granularity: Granularity, dataLength: number): number {
  if (granularity === "daily") {
    if (dataLength <= 30) return 6;
    return 13;
  }
  if (granularity === "weekly") return 3; // ~every 4 weeks
  return 2; // monthly: every 2-3 months
}

export function formatTickLabel(date: string, granularity: Granularity, locale: string): string {
  const loc = locale === "it" ? it : enUS;
  try {
    const parsed = parseISO(date);
    if (granularity === "monthly") return format(parsed, "MMM yy", { locale: loc });
    return format(parsed, "d MMM", { locale: loc });
  } catch {
    return date;
  }
}

export function formatTooltipLabel(date: string, granularity: Granularity, locale: string): string {
  const loc = locale === "it" ? it : enUS;
  try {
    const parsed = parseISO(date);
    if (granularity === "daily") return format(parsed, "d MMM yyyy", { locale: loc });
    if (granularity === "weekly") {
      const weekLabel = format(parsed, "d MMM yyyy", { locale: loc });
      return locale === "it" ? `Settimana del ${weekLabel}` : `Week of ${weekLabel}`;
    }
    return format(parsed, "MMMM yyyy", { locale: loc });
  } catch {
    return date;
  }
}

export function getTrendArrow(slope: number | undefined): string {
  if (slope === undefined) return "";
  if (slope > 0.1) return "↑";
  if (slope < -0.1) return "↓";
  return "→";
}

export function useAdaptiveChart(
  rawData: { date: string; score: number }[]
): { chartData: ChartPoint[]; granularity: Granularity } {
  return useMemo(() => {
    if (rawData.length === 0) return { chartData: [], granularity: "daily" as Granularity };
    const granularity = getGranularity(rawData);
    let chartData: ChartPoint[];
    if (granularity === "weekly") {
      chartData = groupWeekly(rawData);
    } else if (granularity === "monthly") {
      chartData = groupMonthly(rawData);
    } else {
      chartData = rawData.map(d => ({ date: d.date, label: d.date, score: d.score }));
    }
    return { chartData, granularity };
  }, [rawData]);
}
