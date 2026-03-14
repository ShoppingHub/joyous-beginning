import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const { t } = useI18n();
  const [error, setError] = useState(false);

  useEffect(() => {
    const handleCallback = async () => {
      const hash = window.location.hash;
      if (hash.includes("error")) {
        const params = new URLSearchParams(hash.replace("#", ""));
        const errorDescription = params.get("error_description") || "";
        if (errorDescription.includes("expired") || errorDescription.includes("invalid")) {
          navigate("/login?expired=true", { replace: true });
          return;
        }
        setError(true);
        return;
      }
      if (!session) return;
      const { data: areas } = await supabase.from("areas").select("id").eq("user_id", session.user.id).limit(1);
      if (!areas || areas.length === 0) {
        navigate("/onboarding", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    };
    handleCallback();
  }, [session, navigate, location]);

  if (error) {
    return (<div className="flex min-h-screen items-center justify-center px-4"><p className="text-sm text-destructive">{t("authCallback.error")}</p></div>);
  }

  return (<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>);
};

export default AuthCallback;
