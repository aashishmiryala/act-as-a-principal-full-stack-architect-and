import { NavLink } from "react-router-dom";
import {
  Activity,
  Bot,
  Cpu,
  LayoutDashboard,
  Network,
  ShieldAlert,
  SlidersHorizontal,
  Waypoints,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAlertStore } from "@/store/useAlertStore";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/devices", label: "Device Fleet", icon: Cpu },
  { to: "/alerts", label: "Alerts", icon: ShieldAlert, badge: true },
  { to: "/assistant", label: "RAG Assistant", icon: Bot },
  { to: "/simulator", label: "IoT Simulator", icon: SlidersHorizontal },
  { to: "/architecture", label: "Architecture", icon: Network },
] as const;

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const unack = useAlertStore((s) => s.alerts.filter((a) => !a.acknowledged).length);

  return (
    <aside className="flex h-full w-64 flex-col border-r border-white/5 bg-ink-950/80 backdrop-blur">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500/15 ring-1 ring-brand-400/30">
          <Activity className="h-5 w-5 text-brand-300" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-tight text-ink-50">HealthGuard</div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-brand-300/80">
            AIoT Platform
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-brand-500/15 text-brand-100 ring-1 ring-brand-400/25"
                  : "text-ink-300 hover:bg-white/5 hover:text-ink-100",
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    "h-4.5 w-4.5 shrink-0 transition-colors",
                    isActive ? "text-brand-300" : "text-ink-400 group-hover:text-ink-200",
                  )}
                  style={{ width: 18, height: 18 }}
                />
                <span className="flex-1">{item.label}</span>
                {"badge" in item && item.badge && unack > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose-500/90 px-1.5 text-[10px] font-bold text-white">
                    {unack > 99 ? "99+" : unack}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/5 p-3">
        <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2.5">
          <Waypoints className="h-4 w-4 text-emerald-400" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold text-ink-100">Edge → Cloud</div>
            <div className="truncate text-[10px] text-ink-500">MQTT · WebSocket · RLS</div>
          </div>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
        </div>
      </div>
    </aside>
  );
}
