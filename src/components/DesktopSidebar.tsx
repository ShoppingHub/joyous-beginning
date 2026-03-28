import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useI18n } from "@/hooks/useI18n";
import { useNavConfig } from "@/hooks/useNavConfig";
import logoOpadme from "@/assets/logo-opadme.svg";
import { track } from "@/lib/analytics";

export function DesktopSidebar() {
  const location = useLocation();
  const { t } = useI18n();
  const { visibleItems } = useNavConfig();
  const { isPlusActive } = usePlusStatus();

  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  const mainItems = visibleItems.filter(i => !i.isLast);
  const lastItem = visibleItems.find(i => i.isLast);

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[240px] bg-[hsl(var(--nav-bg))] flex-col z-50">
      <div className="px-6 pt-8 pb-6 flex items-center gap-3">
        <img src={logoOpadme} alt="opad.me logo" className="w-10 h-10 invert dark:invert-0" />
        <span className="text-[24px] font-semibold">
          <span className="text-foreground">opad</span>
          <span style={{ color: '#B5453A' }}>.me</span>
        </span>
      </div>

      <nav className="flex flex-col gap-1 px-3 flex-1">
        {mainItems.map(({ to, icon: Icon, labelKey }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => track("tab_switched", { tab: to === "/" ? "home" : to.replace("/", "") })}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
              isActive(to)
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            }`}
          >
            <Icon size={20} strokeWidth={1.5} />
            <span>{t(labelKey)}</span>
          </NavLink>
        ))}
      </nav>

      {lastItem && (
        <div className="px-3 pb-3">
          <div className="h-px bg-foreground/10 mb-3 mx-3" />
          <NavLink
            to={lastItem.to}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
              isActive(lastItem.to)
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            }`}
          >
            <lastItem.icon size={20} strokeWidth={1.5} />
            <span>{t(lastItem.labelKey)}</span>
          </NavLink>
        </div>
      )}

      {/* Profile at bottom */}
      <div className="px-4 pb-6 pt-2 border-t border-foreground/10">
        <div className="flex items-center gap-3 px-2 py-2">
          <ProfileAvatar size="md" />
        </div>
      </div>
    </aside>
  );
}
