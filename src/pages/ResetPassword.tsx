import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/hooks/useI18n";
import { Loader2, Eye, EyeOff, CheckCircle } from "lucide-react";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [validSession, setValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setValidSession(true);
      }
    });

    // Also check if session already exists (e.g. page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setValidSession(true);
      else {
        // If no session and no recovery hash, mark invalid after a delay
        const hash = window.location.hash;
        if (!hash.includes("type=recovery") && !hash.includes("access_token")) {
          setValidSession(false);
        }
        // If hash present, wait for onAuthStateChange to fire
        setTimeout(() => {
          setValidSession((prev) => prev === null ? false : prev);
        }, 5000);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async () => {
    setError("");
    if (password.length < 6) { setError(t("reset.error.short")); return; }
    if (password !== confirmPassword) { setError(t("reset.error.mismatch")); return; }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) { setError(t("reset.error.generic")); }
      else { setSuccess(true); setTimeout(() => navigate("/", { replace: true }), 2000); }
    } catch { setError(t("reset.error.generic")); }
    finally { setLoading(false); }
  };

  if (validSession === null) {
    return (<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>);
  }

  if (!validSession) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 max-w-[428px] mx-auto gap-4">
        <p className="text-sm text-muted-foreground text-center">{t("reset.expired.text")}</p>
        <button onClick={() => navigate("/login", { replace: true })} className="text-sm text-primary underline underline-offset-4 hover:opacity-80">{t("reset.expired.back")}</button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 max-w-[428px] mx-auto gap-4">
        <CheckCircle size={48} className="text-primary" strokeWidth={1.5} />
        <h1 className="text-[28px] font-semibold leading-[1.2]">{t("reset.success.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("reset.success.redirect")}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 max-w-[428px] mx-auto">
      <div className="flex flex-col items-center gap-6 w-full">
        <div className="text-center space-y-2">
          <h1 className="text-[28px] font-semibold leading-[1.2]">{t("reset.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("reset.description")}</p>
        </div>
        <div className="w-full space-y-3">
          <div className="relative">
            <input type={showPassword ? "text" : "password"} value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder={t("reset.placeholder")}
              className="w-full h-12 rounded-xl bg-card px-4 pr-12 text-base text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary transition-colors" />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <input type={showPassword ? "text" : "password"} value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
            placeholder={t("reset.confirm")}
            className="w-full h-12 rounded-xl bg-card px-4 text-base text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary transition-colors" />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button onClick={handleReset} disabled={!password || !confirmPassword || loading}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium text-base flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity min-h-[44px]">
            {loading && <Loader2 size={18} className="animate-spin" />}
            {t("reset.button")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
