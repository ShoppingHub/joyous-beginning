import { Outlet } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { ProfileAvatar } from "@/components/ProfileAvatar";

export function AppLayout() {
  return (
    <div className="flex min-h-screen overflow-x-hidden">
      <DesktopSidebar />

      {/* Mobile layout */}
      <div className="flex flex-col flex-1 max-w-[428px] mx-auto lg:hidden overflow-x-hidden">
        {/* Fixed mobile header: opad.me + profile */}
        <div className="fixed top-0 left-0 right-0 z-50 lg:hidden">
          <div className="max-w-[428px] mx-auto flex items-center justify-between px-4 h-12 bg-background/80 backdrop-blur-md">
            <span className="text-[18px] font-semibold">
              <span className="text-foreground">opad</span>
              <span style={{ color: "#B5453A" }}>.me</span>
            </span>
            <ProfileAvatar />
          </div>
        </div>
        <main className="flex-1 pt-12 pb-14 overflow-x-hidden">
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
