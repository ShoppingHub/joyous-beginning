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
        {/* Fixed profile avatar top-right */}
        <div className="fixed top-3 right-3 z-50 lg:hidden">
          <ProfileAvatar />
        </div>
        <main className="flex-1 pb-14">
          <Outlet />
        </main>
        <BottomNav />
      </div>

      {/* Desktop layout */}
      <div className="hidden lg:flex flex-col flex-1 ml-[240px] overflow-x-hidden">
        <div className="flex justify-end p-4">
          <ProfileAvatar />
        </div>
        <main className="flex-1 px-8 pb-8 w-full max-w-[900px] mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
