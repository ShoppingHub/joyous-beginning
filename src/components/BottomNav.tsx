import { useLocation } from "react-router-dom";
import { useRef, useEffect } from "react";
import { NavLink } from "@/components/NavLink";
import { useI18n } from "@/hooks/useI18n";
import { useNavConfig } from "@/hooks/useNavConfig";
import { motion, AnimatePresence } from "framer-motion";
import { track } from "@/lib/analytics";

export function BottomNav() {
  const location = useLocation();
  const { t } = useI18n();
  const { visibleItems } = useNavConfig();

  // Track which keys were visible on previous render to detect real additions
  const prevKeysRef = useRef<Set<string> | null>(null);
  const currentKeys = new Set(visibleItems.map(i => i.key));

  // On first render, all keys are "already present" — no entry animation
  const isFirstRender = prevKeysRef.current === null;
  const addedKeys = isFirstRender
    ? new Set<string>()
    : new Set([...currentKeys].filter(k => !prevKeysRef.current!.has(k)));

  useEffect(() => {
    prevKeysRef.current = currentKeys;
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center bg-[hsl(var(--nav-bg))] lg:hidden">
      <AnimatePresence mode="popLayout">
        {visibleItems.map(({ to, icon: Icon, labelKey, key }) => {
          const isActive = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
          const justAdded = addedKeys.has(key);
          return (
            <motion.div
              key={key}
              layout
              initial={justAdded ? { opacity: 0, scale: 0.5 } : false}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="flex-1"
            >
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
            </motion.div>
          );
        })}
      </AnimatePresence>
    </nav>
  );
}
