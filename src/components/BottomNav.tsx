import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useI18n } from "@/hooks/useI18n";
import { useNavConfig } from "@/hooks/useNavConfig";

export function BottomNav() {
  const location = useLocation();
  const { t } = useI18n();
  const { visibleItems } = useNavConfig();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center bg-[#0F2F33] lg:hidden">
      {visibleItems.map(({ to, icon: Icon, labelKey }) => {
        const isActive = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
        return (
          <NavLink
            key={to}
            to={to}
            className="flex flex-1 flex-col items-center justify-center min-h-[44px] gap-0.5"
          >
            <Icon
              size={24}
              className={isActive ? "text-[#7DA3A0]" : "text-[#B9C0C1]"}
              strokeWidth={1.5}
            />
            <span
              className={`text-[10px] ${isActive ? "text-[#7DA3A0] font-medium" : "text-[#B9C0C1]"}`}
            >
              {t(labelKey)}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}
