import { Outlet } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { DesktopSidebar } from "@/components/DesktopSidebar";

export function AppLayout() {
  return (
    <div className="flex min-h-screen">
      <DesktopSidebar />

      {/* Mobile layout */}
      <div className="flex flex-col flex-1 max-w-[428px] mx-auto lg:hidden">
        <main className="flex-1 pb-14">
          <Outlet />
        </main>
        <BottomNav />
      </div>

      {/* Desktop layout */}
      <div className="hidden lg:flex flex-col flex-1 ml-[240px]">
        <main className="flex-1 p-8 w-full max-w-[900px] mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
