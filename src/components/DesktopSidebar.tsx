import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useI18n } from "@/hooks/useI18n";
import { useNavConfig } from "@/hooks/useNavConfig";

export function DesktopSidebar() {
  const location = useLocation();
  const { t } = useI18n();
  const { visibleItems } = useNavConfig();

  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  const mainItems = visibleItems.filter(i => !i.isLast);
  const lastItem = visibleItems.find(i => i.isLast);

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[240px] bg-[#0F2F33] flex-col z-50">
      <div className="px-6 pt-8 pb-6">
        <span className="text-[20px] font-semibold"><span className="text-white">opad</span><span style={{ color: '#B5453A' }}>.me</span></span>
      </div>

      <nav className="flex flex-col gap-1 px-3 flex-1">
        {mainItems.map(({ to, icon: Icon, labelKey }) => (
          <NavLink
            key={to}
            to={to}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
              isActive(to)
                ? "bg-[rgba(125,163,160,0.1)] text-[#7DA3A0]"
                : "text-[#B9C0C1] hover:text-white hover:bg-white/5"
            }`}
          >
            <Icon size={20} strokeWidth={1.5} />
            <span>{t(labelKey)}</span>
          </NavLink>
        ))}
      </nav>

      {lastItem && (
        <div className="px-3 pb-6">
          <div className="h-px bg-white/10 mb-3 mx-3" />
          <NavLink
            to={lastItem.to}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
              isActive(lastItem.to)
                ? "bg-[rgba(125,163,160,0.1)] text-[#7DA3A0]"
                : "text-[#B9C0C1] hover:text-white hover:bg-white/5"
            }`}
          >
            <lastItem.icon size={20} strokeWidth={1.5} />
            <span>{t(lastItem.labelKey)}</span>
          </NavLink>
        </div>
      )}
    </aside>
  );
}
