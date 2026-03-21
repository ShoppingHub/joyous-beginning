import { Outlet } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { usePlusStatus } from "@/hooks/usePlusStatus";
import { Sparkles } from "lucide-react";
import logoOpadme from "@/assets/logo-opadme.svg";

export function AppLayout() {
  const { isPlusActive } = usePlusStatus();

  return (
    <div className="flex min-h-screen overflow-x-hidden">
      <DesktopSidebar />

      {/* Mobile layout */}
      <div className="flex flex-col flex-1 max-w-[428px] mx-auto lg:hidden overflow-x-hidden">
        {/* Fixed mobile header: opad.me + profile */}
        <div className="fixed top-0 left-0 right-0 z-50 lg:hidden">
          <div className="max-w-[428px] mx-auto grid grid-cols-3 items-center px-4 h-14 bg-background/80 backdrop-blur-md">
            {/* Left: logo */}
            <div className="flex items-center">
              <img src={logoOpadme} alt="opad.me logo" className="w-7 h-7 invert dark:invert-0" />
            </div>
            {/* Center: brand name + Plus badge */}
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-[18px] font-semibold">
                <span className="text-foreground">opad</span>
                <span style={{ color: "#B5453A" }}>.me</span>
              </span>
              {isPlusActive && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-accent/15 text-accent text-[11px] font-medium">
                  <Sparkles className="w-3 h-3" />
                  Plus
                </span>
              )}
            </div>
            {/* Right: profile avatar */}
            <div className="flex justify-end">
              <ProfileAvatar />
            </div>
          </div>
        </div>
        <main className="flex-1 pt-14 pb-14 overflow-x-hidden">
          <Outlet />
        </main>
        <BottomNav />
      </div>

      {/* Desktop layout */}
      <div className="hidden lg:flex flex-col flex-1 ml-[240px] overflow-x-hidden">
        <main className="flex-1 px-8 pb-8 pt-4 w-full max-w-[900px] mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
