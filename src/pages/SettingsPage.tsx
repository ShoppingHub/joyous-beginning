import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useDemo } from "@/hooks/useDemo";
import { useI18n } from "@/hooks/useI18n";
import { useNavConfig } from "@/hooks/useNavConfig";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { motion } from "framer-motion";
import type { Locale } from "@/i18n/translations";

type GoogleStatus = "loading" | "disconnected" | "active" | "auth_error";

const SettingsPage = () => {
  const { user, signOut } = useAuth();
  const { isDemo, disableDemo } = useDemo();
  const { t, locale, setLocale } = useI18n();
  const { extraTabEnabled, setExtraTabEnabled } = useNavConfig();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [scoreVisible, setScoreVisible] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Google Tasks state
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>("loading");
  const [googleEmail, setGoogleEmail] = useState("");
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [googleDisconnecting, setGoogleDisconnecting] = useState(false);

  // Load user settings + Google connection status
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [settingsRes, googleRes] = await Promise.all([
        supabase
          .from("users")
          .select("settings_score_visible, settings_notifications")
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("google_oauth_tokens" as any)
          .select("google_email, status")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (settingsRes.data) {
        setScoreVisible(settingsRes.data.settings_score_visible);
        setNotifications(settingsRes.data.settings_notifications);
      }

      if (googleRes.data) {
        const data = googleRes.data as any;
        setGoogleEmail(data.google_email || "");
        setGoogleStatus(data.status === "auth_error" ? "auth_error" : "active");
      } else {
        setGoogleStatus("disconnected");
      }
    })();
  }, [user]);

  // Handle redirect after OAuth callback
  useEffect(() => {
    if (searchParams.get("google_connected") === "true") {
      setGoogleStatus("active");
      // Re-fetch to get email
      if (user) {
        supabase
          .from("google_oauth_tokens" as any)
          .select("google_email")
          .eq("user_id", user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) setGoogleEmail((data as any).google_email || "");
          });
      }
      // Clean URL
      searchParams.delete("google_connected");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, user, setSearchParams]);

  const updateSetting = useCallback(
    async (field: "settings_score_visible" | "settings_notifications", value: boolean, rollback: () => void) => {
      if (!user) return;
      const { error } = await supabase.from("users").update({ [field]: value }).eq("user_id", user.id);
      if (error) rollback();
    },
    [user]
  );

  const handleScoreToggle = (checked: boolean) => {
    const prev = scoreVisible;
    setScoreVisible(checked);
    updateSetting("settings_score_visible", checked, () => setScoreVisible(prev));
  };

  const handleNotificationsToggle = (checked: boolean) => {
    const prev = notifications;
    setNotifications(checked);
    updateSetting("settings_notifications", checked, () => setNotifications(prev));
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    navigate("/login", { replace: true });
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await supabase.functions.invoke("delete-account", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.error) { setDeleteError(t("settings.deleteError")); setDeleting(false); return; }
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    } catch { setDeleteError(t("settings.deleteError")); setDeleting(false); }
  };

  // Google Tasks: start OAuth flow
  const handleGoogleConnect = async () => {
    if (!user) return;
    setGoogleConnecting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await supabase.functions.invoke("google-oauth-start", {
        headers: { Authorization: `Bearer ${token}` },
        body: { origin: window.location.origin },
      });
      if (res.error || !res.data?.url) {
        setGoogleConnecting(false);
        return;
      }
      // Redirect to Google OAuth
      window.location.href = res.data.url;
    } catch {
      setGoogleConnecting(false);
    }
  };

  // Google Tasks: disconnect
  const handleGoogleDisconnect = async () => {
    if (!user) return;
    setGoogleDisconnecting(true);
    try {
      await supabase
        .from("google_oauth_tokens" as any)
        .delete()
        .eq("user_id", user.id);
      setGoogleStatus("disconnected");
      setGoogleEmail("");
    } catch {
      // ignore
    } finally {
      setGoogleDisconnecting(false);
    }
  };

  const languageOptions: { value: Locale; label: string }[] = [
    { value: "it", label: "Italiano" },
    { value: "en", label: "English" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="flex flex-col px-4 pt-6 pb-8 gap-8"
    >
      <h1 className="text-[28px] font-semibold leading-[1.2]">{t("settings.title")}</h1>

      {/* Preferences */}
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground font-medium">{t("settings.preferences")}</p>

        {/* Language selector */}
        <div className="flex items-center justify-between min-h-[44px]">
          <span className="text-base">{t("settings.language")}</span>
          <div className="flex rounded-full bg-card ring-1 ring-border overflow-hidden">
            {languageOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setLocale(opt.value)}
                className={`px-4 py-1.5 text-sm font-medium transition-colors min-h-[36px] ${
                  locale === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between min-h-[44px]">
          <span className="text-base">{t("settings.showScore")}</span>
          <Switch checked={scoreVisible} onCheckedChange={handleScoreToggle} className="data-[state=checked]:bg-[#7DA3A0]" />
        </div>
        <div className="flex items-center justify-between min-h-[44px]">
          <span className="text-base">{t("settings.notifications")}</span>
          <Switch checked={notifications} onCheckedChange={handleNotificationsToggle} className="data-[state=checked]:bg-[#7DA3A0]" />
        </div>

        {/* Finance tab toggle */}
        <div className="flex items-center justify-between min-h-[44px]">
          <div className="flex flex-col">
            <span className="text-base">{t("settings.financeTab")}</span>
            <span className="text-xs text-muted-foreground">{t("settings.financeTabSub")}</span>
          </div>
          <Switch checked={extraTabEnabled} onCheckedChange={setExtraTabEnabled} className="data-[state=checked]:bg-[#7DA3A0]" />
        </div>
      </div>

      {/* Google Tasks */}
      {!isDemo && googleStatus !== "loading" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground font-medium">{t("settings.googleTasks")}</p>

          {/* Auth error banner */}
          {googleStatus === "auth_error" && (
            <div className="flex items-start gap-3 rounded-xl bg-destructive/10 ring-1 ring-destructive/30 px-4 py-3">
              <AlertTriangle size={18} className="text-destructive mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-destructive">{t("settings.googleTasks.expired")}</p>
              </div>
              <button
                onClick={handleGoogleConnect}
                disabled={googleConnecting}
                className="text-sm font-medium text-destructive hover:opacity-80 transition-opacity shrink-0"
              >
                {googleConnecting ? <Loader2 size={16} className="animate-spin" /> : t("settings.googleTasks.reconnect")}
              </button>
            </div>
          )}

          {/* Disconnected state */}
          {googleStatus === "disconnected" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{t("settings.googleTasks.description")}</p>
              <button
                onClick={handleGoogleConnect}
                disabled={googleConnecting}
                className="w-full h-12 rounded-xl bg-card ring-1 ring-border font-medium text-base flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity min-h-[44px]"
              >
                {googleConnecting && <Loader2 size={18} className="animate-spin" />}
                {googleConnecting ? t("settings.googleTasks.connecting") : t("settings.googleTasks.connect")}
              </button>
            </div>
          )}

          {/* Connected state */}
          {googleStatus === "active" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {t("settings.googleTasks.connectedAs")} <span className="text-foreground">{googleEmail}</span>
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    disabled={googleDisconnecting}
                    className="w-full h-12 rounded-xl bg-card ring-1 ring-border font-medium text-base flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity min-h-[44px]"
                  >
                    {googleDisconnecting && <Loader2 size={18} className="animate-spin" />}
                    {t("settings.googleTasks.disconnect")}
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-[340px] bg-card border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("settings.googleTasks.disconnectTitle")}</AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground">
                      {t("settings.googleTasks.disconnectDescription")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
                    <AlertDialogAction
                      onClick={handleGoogleDisconnect}
                      className="bg-transparent text-destructive hover:bg-destructive/10 border-0 shadow-none"
                    >
                      {t("settings.googleTasks.disconnectConfirm")}
                    </AlertDialogAction>
                    <AlertDialogCancel className="bg-transparent border-0 shadow-none text-muted-foreground hover:text-foreground">
                      {t("settings.googleTasks.disconnectCancel")}
                    </AlertDialogCancel>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      )}

      {/* Demo banner */}
      {isDemo && (
        <div className="flex items-center justify-between rounded-xl bg-accent/20 ring-1 ring-accent px-4 py-3">
          <div>
            <p className="text-sm font-medium">{t("settings.demo.title")}</p>
            <p className="text-xs text-muted-foreground">{t("settings.demo.description")}</p>
          </div>
          <button onClick={() => { sessionStorage.removeItem("demo_mode"); window.location.href = "/login"; }}
            className="text-sm font-medium text-primary hover:opacity-80 transition-opacity">
            {t("settings.demo.exit")}
          </button>
        </div>
      )}

      {/* Account */}
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground font-medium">{t("settings.account")}</p>
        <p className="text-base text-muted-foreground truncate">{isDemo ? "demo@example.com" : user?.email}</p>

        <button onClick={handleSignOut} disabled={signingOut}
          className="w-full h-12 rounded-xl bg-card ring-1 ring-border font-medium text-base flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity min-h-[44px]">
          {signingOut && <Loader2 size={18} className="animate-spin" />}
          {t("settings.signOut")}
        </button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="text-sm text-destructive hover:opacity-80 transition-opacity min-h-[44px]">
              {t("settings.deleteAccount")}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-[340px] bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>{t("settings.deleteDialog.title")}</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                {t("settings.deleteDialog.description")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
              <AlertDialogAction onClick={handleDeleteAccount} disabled={deleting}
                className="bg-transparent text-destructive hover:bg-destructive/10 border-0 shadow-none flex items-center justify-center gap-2">
                {deleting && <Loader2 size={18} className="animate-spin" />}
                {t("settings.deleteDialog.confirm")}
              </AlertDialogAction>
              <AlertDialogCancel className="bg-transparent border-0 shadow-none text-muted-foreground hover:text-foreground">
                {t("settings.deleteDialog.cancel")}
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
      </div>
    </motion.div>
  );
};

export default SettingsPage;
