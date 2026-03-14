import { motion } from "framer-motion";

export type TimeRange = "15d" | "1m" | "3m" | "6m" | "1y" | "all";

interface RangeOption {
  value: TimeRange;
  label: string;
}

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  disabled?: boolean;
  ranges?: RangeOption[];
}

const defaultRanges: RangeOption[] = [
  { value: "15d", label: "15g" },
  { value: "1m", label: "1m" },
  { value: "3m", label: "3m" },
  { value: "6m", label: "6m" },
  { value: "1y", label: "1a" },
  { value: "all", label: "Tutto" },
];

export const rangeToDays: Record<TimeRange, number> = {
  "15d": 15,
  "1m": 30,
  "3m": 90,
  "6m": 180,
  "1y": 365,
  "all": 3650,
};

export function TimeRangeSelector({ value, onChange, disabled, ranges = defaultRanges }: TimeRangeSelectorProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-full bg-card p-1">
      {ranges.map((range) => (
        <button
          key={range.value}
          onClick={() => onChange(range.value)}
          disabled={disabled}
          className="relative rounded-full px-3 py-1 text-sm font-medium transition-colors min-h-[32px] disabled:pointer-events-none"
        >
          {value === range.value && (
            <motion.div
              layoutId="activeRange"
              className="absolute inset-0 rounded-full bg-card-foreground/10 border border-muted-foreground/20"
              transition={{ duration: 0.2, ease: "easeInOut" }}
            />
          )}
          <span
            className={`relative z-10 text-xs ${
              value === range.value ? "text-foreground font-semibold" : "text-muted-foreground"
            }`}
          >
            {range.label}
          </span>
        </button>
      ))}
    </div>
  );
}
