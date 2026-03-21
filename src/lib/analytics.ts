import posthog from "posthog-js";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_API_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST;

let initialized = false;

export function initAnalytics() {
  if (initialized || !POSTHOG_KEY) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST || "https://eu.i.posthog.com",
    autocapture: false,
    capture_pageview: true,
    disable_session_recording: true,
    persistence: "localStorage",
    respect_dnt: true,
  });
  initialized = true;
}

function isReady() {
  return initialized && !!POSTHOG_KEY;
}

// ── Identify / Reset ──

export function identifyUser(
  userId: string,
  properties: {
    plan?: string;
    language?: string;
    areas_count?: number;
    cards_enabled?: string[];
    created_at?: string;
  }
) {
  if (!isReady()) return;
  posthog.identify(userId, properties);
}

export function updateUserProperties(properties: Record<string, unknown>) {
  if (!isReady()) return;
  posthog.people.set(properties);
}

export function resetAnalytics() {
  if (!isReady()) return;
  posthog.reset();
}

// ── Generic track ──

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!isReady()) return;
  posthog.capture(event, properties);
}

// ── Typed helpers ──

// Auth
export const trackLogin = (method: "email" | "google") => trackEvent("auth_login", { method });
export const trackSignup = (method: "email" | "google") => trackEvent("auth_signup", { method });
export const trackLogout = () => trackEvent("auth_logout");

// Onboarding
export const trackOnboardingStarted = () => trackEvent("onboarding_started");
export const trackOnboardingStepCompleted = (step: number) => trackEvent("onboarding_step_completed", { step });
export const trackOnboardingCompleted = (areasCount: number) => trackEvent("onboarding_completed", { areas_count: areasCount });

// Check-in
export const trackCheckinCompleted = (props: { area_type: string; tracking_mode: string; source: "home" | "area_detail" }) =>
  trackEvent("checkin_completed", props);
export const trackCheckinUndo = (areaType: string) => trackEvent("checkin_undo", { area_type: areaType });

// Areas
export const trackAreaCreated = (areaType: string, trackingMode: string) => trackEvent("area_created", { area_type: areaType, tracking_mode: trackingMode });
export const trackAreaEdited = (areaType: string) => trackEvent("area_edited", { area_type: areaType });
export const trackAreaArchived = (areaType: string) => trackEvent("area_archived", { area_type: areaType });

// Cards
export const trackCardEnabled = (cardType: string) => trackEvent("card_enabled", { card_type: cardType });
export const trackCardDisabled = (cardType: string) => trackEvent("card_disabled", { card_type: cardType });
export const trackCardOpened = (cardType: string) => trackEvent("card_opened", { card_type: cardType });

// Gym
export const trackGymSessionStarted = () => trackEvent("session_gym_started");
export const trackGymSessionCompleted = (exercisesDone: number) => trackEvent("session_gym_completed", { exercises_done: exercisesDone });

// Navigation
export const trackTabSwitched = (tab: string) => trackEvent("tab_switched", { tab });
export const trackAreaDetailViewed = (areaType: string, timeRange?: string) => trackEvent("area_detail_viewed", { area_type: areaType, time_range: timeRange });

// Plus
export const trackPlusPageViewed = (source: "banner" | "settings" | "gating") => trackEvent("plus_page_viewed", { source });
export const trackPlusUpgradeClicked = () => trackEvent("plus_upgrade_clicked");
export const trackPlusBannerDismissed = () => trackEvent("plus_banner_dismissed");

// Settings
export const trackLanguageChanged = (language: string) => trackEvent("settings_language_changed", { language });
export const trackThemeChanged = (theme: string, palette: string) => trackEvent("settings_theme_changed", { theme, palette });
export const trackScoreToggled = (visible: boolean) => trackEvent("settings_score_toggled", { visible });
