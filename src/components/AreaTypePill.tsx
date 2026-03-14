import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";
import type { TranslationKey } from "@/i18n/translations";

type AreaType = "health" | "study" | "reduce" | "finance";

const typeStyles: Record<AreaType, string> = {
  health: "bg-[#7DA3A0]/20 text-[#7DA3A0] border-[#7DA3A0]/40",
  study: "bg-[#8C9496]/20 text-[#B9C0C1] border-[#8C9496]/40",
  reduce: "bg-[#BFA37A]/20 text-[#BFA37A] border-[#BFA37A]/40",
  finance: "bg-[#1F4A50] text-[#EAEAEA] border-[#7DA3A0]/30",
};

const typeLabelKeys: Record<AreaType, TranslationKey> = {
  health: "areaType.health",
  study: "areaType.study",
  reduce: "areaType.reduce",
  finance: "areaType.finance",
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
