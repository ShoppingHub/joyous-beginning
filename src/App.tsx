import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { DemoProvider } from "@/hooks/useDemo";
import { I18nProvider } from "@/hooks/useI18n";
import { NavConfigProvider } from "@/hooks/useNavConfig";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index";
import Areas from "./pages/Activities";
import Finance from "./pages/Finance";
import SettingsPage from "./pages/SettingsPage";
import Progress from "./pages/Progress";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import ResetPassword from "./pages/ResetPassword";
import OnboardingLayout from "./pages/OnboardingLayout";
import OnboardingAreas from "./pages/OnboardingAreas";
import OnboardingFrequency from "./pages/OnboardingFrequency";
import AreaForm from "./pages/AreaForm";
import AreaDetail from "./pages/AreaDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <DemoProvider>
        <AuthProvider>
        <I18nProvider>
        <NavConfigProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<OnboardingLayout />}>
              <Route path="/onboarding" element={<Navigate to="/onboarding/areas" replace />} />
              <Route path="/onboarding/areas" element={<OnboardingAreas />} />
              <Route path="/onboarding/frequency" element={<OnboardingFrequency />} />
            </Route>
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Index />} />
              <Route path="/activities" element={<Areas />} />
              <Route path="/activities/new" element={<AreaForm mode="add" />} />
              <Route path="/activities/:id" element={<AreaDetail />} />
              <Route path="/activities/:id/edit" element={<AreaForm mode="edit" />} />
              {/* Legacy redirects */}
              <Route path="/progress" element={<Progress />} />
              <Route path="/areas" element={<Navigate to="/activities" replace />} />
              <Route path="/areas/*" element={<Navigate to="/activities" replace />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </NavConfigProvider>
        </I18nProvider>
        </AuthProvider>
        </DemoProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
