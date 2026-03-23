import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";
import type { TranslationKey } from "@/i18n/translations";

type AreaType = "health" | "study" | "reduce" | "finance" | "career";

const typeStyles: Record<AreaType, string> = {
  health: "bg-[#7DA3A0]/20 text-[#7DA3A0] border-[#7DA3A0]/40",
  study: "bg-[#9B8EC4]/20 text-[#9B8EC4] border-[#9B8EC4]/40",
  reduce: "bg-[#BFA37A]/20 text-[#BFA37A] border-[#BFA37A]/40",
  finance: "bg-[#5B9E6F]/20 text-[#5B9E6F] border-[#5B9E6F]/40",
  career: "bg-[#6B7DB3]/20 text-[#6B7DB3] border-[#6B7DB3]/40",
};

const typeLabelKeys: Record<AreaType, TranslationKey> = {
  health: "areaType.health",
  study: "areaType.study",
  reduce: "areaType.reduce",
  finance: "areaType.finance",
  career: "areaType.career",
};

interface AreaTypePillProps {
  type: AreaType;
  className?: string;
}

export function AreaTypePill({ type, className }: AreaTypePillProps) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "rounded-full px-3 py-0.5 text-[12px] font-medium border inline-block",
        typeStyles[type],
        className
      )}
    >
      {t(typeLabelKeys[type])}
    </span>
  );
}
