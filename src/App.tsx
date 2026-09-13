import { useEffect } from "react";
import {
  Navigate,
  Route,
  HashRouter,
  Routes,
  useLocation,
} from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuthStore } from "@/store/useAuthStore";
import { useFleetStore } from "@/store/useFleetStore";
import { bootstrapSystem } from "@/lib/bootstrap";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Devices from "@/pages/Devices";
import DeviceDetail from "@/pages/DeviceDetail";
import Alerts from "@/pages/Alerts";
import Assistant from "@/pages/Assistant";
import Simulator from "@/pages/Simulator";
import Architecture from "@/pages/Architecture";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const session = useAuthStore((s) => s.session);
  const initialized = useAuthStore((s) => s.initialized);
  const location = useLocation();

  if (!initialized) return <BootSplash />;
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}

function BootSplash() {
  return (
    <div className="grid h-screen place-items-center">
      <div className="flex flex-col items-center gap-3 animate-fade-in">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-brand-400" />
        <p className="text-sm text-ink-400">Starting HealthGuard…</p>
      </div>
    </div>
  );
}

export default function App() {
  const initAuth = useAuthStore((s) => s.init);
  const session = useAuthStore((s) => s.session);
  const initFleet = useFleetStore((s) => s.init);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Boot the runtime once the user is authenticated.
  useEffect(() => {
    if (session) {
      bootstrapSystem();
      initFleet();
    }
  }, [session, initFleet]);

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/devices/:id" element={<DeviceDetail />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/simulator" element={<Simulator />} />
          <Route path="/architecture" element={<Architecture />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </HashRouter>
  );
}
