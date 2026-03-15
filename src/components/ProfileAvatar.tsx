import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useDemo } from "@/hooks/useDemo";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User } from "lucide-react";

interface ProfileAvatarProps {
  size?: "sm" | "md";
}

export function ProfileAvatar({ size = "sm" }: ProfileAvatarProps) {
  const { user } = useAuth();
  const { isDemo } = useDemo();
  const navigate = useNavigate();

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || "";
  const name = user?.user_metadata?.full_name || user?.email || "";
  const initials = name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  const sizeClass = size === "md" ? "h-10 w-10" : "h-8 w-8";
  const textClass = size === "md" ? "text-sm" : "text-xs";

  return (
    <button
      onClick={() => navigate("/settings")}
      className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Profile"
    >
      <Avatar className={sizeClass}>
        {!isDemo && avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
        <AvatarFallback className={`bg-primary/20 text-primary ${textClass} font-medium`}>
          {isDemo ? <User size={size === "md" ? 20 : 16} /> : initials}
        </AvatarFallback>
      </Avatar>
    </button>
  );
}
