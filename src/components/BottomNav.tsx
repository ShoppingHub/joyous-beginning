import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useI18n } from "@/hooks/useI18n";
import { useNavConfig } from "@/hooks/useNavConfig";
import { track } from "@/lib/analytics";

export function BottomNav() {
  const location = useLocation();
  const { t } = useI18n();
  const { visibleItems } = useNavConfig();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center bg-[hsl(var(--nav-bg))] lg:hidden">
      {visibleItems.map(({ to, icon: Icon, labelKey, key }) => {
        const isActive = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
        return (
          <div key={key} className="flex-1">
            <NavLink
              to={to}
              onClick={() => track("tab_switched", { tab: key })}
              className="flex flex-col items-center justify-center min-h-[44px] gap-0.5"
            >
              <Icon
                size={24}
                className={isActive ? "text-primary" : "text-muted-foreground"}
                strokeWidth={1.5}
              />
              <span
                className={`text-[10px] ${isActive ? "text-primary font-medium" : "text-muted-foreground"}`}
              >
                {t(labelKey)}
              </span>
            </NavLink>
          </div>
        );
      })}
    </nav>
  );
}
