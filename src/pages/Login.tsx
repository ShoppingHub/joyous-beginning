import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { useDemo } from "@/hooks/useDemo";
import { useI18n } from "@/hooks/useI18n";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().email();

type Tab = "login" | "signup";
type Screen = "auth" | "check-email" | "forgot";

const Login = () => {
  const { session, loading } = useAuth();
  const { isDemo, enableDemo } = useDemo();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>("auth");
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [genericError, setGenericError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (session || isDemo) {
    return <Navigate to="/" replace />;
  }

  const handleDemo = () => {
    enableDemo();
    navigate("/", { replace: true });
  };

  const clearErrors = () => { setEmailError(""); setPasswordError(""); setGenericError(""); };

  const validateEmail = (v: string) => {
    if (!emailSchema.safeParse(v).success) { setEmailError(t("login.error.email")); return false; }
    return true;
  };

  const validatePassword = (v: string) => {
    if (v.length < 6) { setPasswordError(t("login.error.password.short")); return false; }
    return true;
  };

  const handleSignUp = async () => {
    clearErrors();
    if (!validateEmail(email) || !validatePassword(password)) return;
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin + "/auth/callback" },
      });
      if (error) {
        if (error.message.includes("already registered") || error.message.includes("already been registered")) {
          setGenericError(t("login.error.exists"));
        } else {
          setGenericError(t("login.error.generic"));
        }
      } else {
        setScreen("check-email");
      }
    } catch { setGenericError(t("login.error.generic")); }
    finally { setAuthLoading(false); }
  };

  const handleLogin = async () => {
    clearErrors();
    if (!validateEmail(email)) return;
    if (!password) { setPasswordError(t("login.error.password.empty")); return; }
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setGenericError(t("login.error.invalid")); }
    } catch { setGenericError(t("login.error.generic")); }
    finally { setAuthLoading(false); }
  };

  const handleForgotPassword = async () => {
    clearErrors();
    if (!validateEmail(email)) return;
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (error) { setGenericError(t("login.error.generic")); }
      else { setForgotSent(true); }
    } catch { setGenericError(t("login.error.generic")); }
    finally { setForgotLoading(false); }
  };

  const handleResendVerification = async () => {
    setAuthLoading(true); setGenericError("");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup", email,
        options: { emailRedirectTo: window.location.origin + "/auth/callback" },
      });
      if (error) { setGenericError(t("login.error.generic")); }
    } catch { setGenericError(t("login.error.generic")); }
    finally { setAuthLoading(false); }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true); setGenericError("");
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        const msg = result.error?.message || "";
        if (!msg.includes("cancelled") && !msg.includes("closed") && !msg.includes("popup")) {
          setGenericError(t("login.error.google"));
        }
      }
    } catch { setGenericError(t("login.error.google")); }
    finally { setGoogleLoading(false); }
  };

  // Check email screen
  if (screen === "check-email") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 max-w-[428px] mx-auto">
        <div className="flex flex-col items-center gap-6 w-full">
          <div className="text-center space-y-2">
            <h1 className="text-[28px] font-semibold leading-[1.2]">{t("checkEmail.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("checkEmail.sent")}</p>
            <p className="text-sm font-medium">{email}</p>
          </div>
          <button onClick={handleResendVerification} disabled={authLoading}
            className="text-sm text-primary underline underline-offset-4 hover:opacity-80 disabled:opacity-50">
            {authLoading ? t("checkEmail.sending") : t("checkEmail.resend")}
          </button>
          <button onClick={() => { setScreen("auth"); clearErrors(); }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {t("checkEmail.back")}
          </button>
          {genericError && <p className="text-sm text-destructive">{genericError}</p>}
        </div>
      </div>
    );
  }

  // Forgot password screen
  if (screen === "forgot") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 max-w-[428px] mx-auto">
        <div className="flex flex-col items-center gap-6 w-full">
          <div className="text-center space-y-2">
            <h1 className="text-[28px] font-semibold leading-[1.2]">{t("forgot.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {forgotSent ? t("forgot.sent") : t("forgot.description")}
            </p>
          </div>
          {!forgotSent && (
            <div className="w-full space-y-3">
              <input type="email" value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                placeholder={t("login.email.placeholder")}
                className="w-full h-12 rounded-xl bg-card px-4 text-base text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary transition-colors" />
              {emailError && <p className="text-sm text-destructive">{emailError}</p>}
              <button onClick={handleForgotPassword} disabled={forgotLoading || !email}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium text-base flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity min-h-[44px]">
                {forgotLoading && <Loader2 size={18} className="animate-spin" />}
                {t("forgot.button")}
              </button>
            </div>
          )}
          <button onClick={() => { setScreen("auth"); setForgotSent(false); clearErrors(); }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {t("forgot.back")}
          </button>
          {genericError && <p className="text-sm text-destructive">{genericError}</p>}
        </div>
      </div>
    );
  }

  const isLogin = tab === "login";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 max-w-[428px] mx-auto">
      <div className="flex flex-col items-center gap-8 w-full">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-[28px] font-semibold leading-[1.2]"><span className="text-foreground">opad</span><span style={{ color: '#B5453A' }}>.me</span></h1>
          <p className="text-sm text-muted-foreground">{t("app.tagline")}</p>
        </div>

        <div className="flex w-full rounded-xl bg-card ring-1 ring-border overflow-hidden">
          <button onClick={() => { setTab("login"); clearErrors(); }}
            className={`flex-1 h-11 text-sm font-medium transition-colors ${isLogin ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t("login.tab.login")}
          </button>
          <button onClick={() => { setTab("signup"); clearErrors(); }}
            className={`flex-1 h-11 text-sm font-medium transition-colors ${!isLogin ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t("login.tab.signup")}
          </button>
        </div>

        <div className="w-full space-y-3">
          <input type="email" value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailError(""); setGenericError(""); }}
            placeholder={t("login.email.placeholder")}
            className="w-full h-12 rounded-xl bg-card px-4 text-base text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary transition-colors" />
          {emailError && <p className="text-sm text-destructive">{emailError}</p>}

          <div className="relative">
            <input type={showPassword ? "text" : "password"} value={password}
              onChange={(e) => { setPassword(e.target.value); setPasswordError(""); setGenericError(""); }}
              placeholder={isLogin ? t("login.password.placeholder") : t("login.password.create")}
              className="w-full h-12 rounded-xl bg-card px-4 pr-12 text-base text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary transition-colors" />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}

          <button onClick={isLogin ? handleLogin : handleSignUp} disabled={!email || !password || authLoading}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium text-base flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity min-h-[44px]">
            {authLoading && <Loader2 size={18} className="animate-spin" />}
            {isLogin ? t("login.button.login") : t("login.button.signup")}
          </button>

          {isLogin && (
            <button onClick={() => { setScreen("forgot"); clearErrors(); }}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors text-center py-1">
              {t("login.forgot")}
            </button>
          )}
        </div>

        <div className="flex w-full items-center gap-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">{t("login.or")}</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button onClick={handleGoogleLogin} disabled={googleLoading}
          className="w-full h-12 rounded-xl bg-card ring-1 ring-border font-medium text-base flex items-center justify-center gap-3 hover:opacity-90 disabled:opacity-50 transition-opacity min-h-[44px]">
          {googleLoading ? <Loader2 size={18} className="animate-spin" /> : (
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
          )}
          {t("login.google")}
        </button>

        {genericError && <p className="text-sm text-destructive text-center">{genericError}</p>}

        <button onClick={handleDemo}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4">
          {t("login.demo")}
        </button>
      </div>
    </div>
  );
};

export default Login;
