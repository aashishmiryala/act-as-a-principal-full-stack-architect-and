import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, LogOut, Menu, Pause, Play, Radio, Zap } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { useFleetStore } from "@/store/useFleetStore";
import { useAlertStore } from "@/store/useAlertStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useTelemetry } from "@/hooks/useTelemetry";
import { telemetryHub } from "@/lib/telemetryHub";
import { Avatar } from "@/components/ui/Avatar";
import { ScoreRing } from "@/components/ui/ScoreRing";

const SPEEDS = [1, 2, 5, 10];

export function Topbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  useTelemetry();
  const navigate = useNavigate();
  const running = useFleetStore((s) => s.running);
  const timeScale = useFleetStore((s) => s.timeScale);
  const brokerStats = useFleetStore((s) => s.brokerStats);
  const toggleRunning = useFleetStore((s) => s.toggleRunning);
  const setTimeScale = useFleetStore((s) => s.setTimeScale);

  const unack = useAlertStore((s) => s.alerts.filter((a) => !a.acknowledged).length);
  const critical = useAlertStore((s) =>
    s.alerts.filter((a) => !a.acknowledged && a.severity === "critical").length,
  );
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const [menuOpen, setMenuOpen] = useState(false);

  const fleetRisk = telemetryHub.fleetRiskScore();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/5 bg-ink-950/70 px-4 backdrop-blur-xl sm:px-6">
      <button
        onClick={onOpenSidebar}
        className="btn-ghost h-9 w-9 !px-0 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Fleet risk */}
      <div className="hidden items-center gap-2.5 sm:flex">
        <ScoreRing value={fleetRisk} size={40} strokeWidth={5} />
        <div className="leading-tight">
          <div className="text-xs font-semibold text-ink-100">Fleet risk index</div>
          <div className="text-[11px] text-ink-400">{telemetryHub.allSnapshots().length} devices live</div>
        </div>
      </div>

      <div className="flex-1" />

      {/* Broker throughput */}
      <div
        className="hidden items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-1.5 md:flex"
        title="In-browser MQTT broker throughput"
      >
        <Radio className="h-4 w-4 text-emerald-400" />
        <div className="leading-tight">
          <div className="text-[11px] font-semibold tabular-nums text-ink-100">
            {formatNumber(brokerStats.throughputMsgSec)} msg/s
          </div>
          <div className="text-[10px] text-ink-500">
            {formatNumber(brokerStats.publishedMessages)} published · {brokerStats.transport}
          </div>
        </div>
      </div>

      {/* Sim controls */}
      <div className="flex items-center gap-1 rounded-xl border border-white/5 bg-white/[0.03] p-1">
        <button
          onClick={toggleRunning}
          className={cn(
            "grid h-7 w-7 place-items-center rounded-lg transition-colors",
            running ? "text-amber-300 hover:bg-amber-400/10" : "text-emerald-300 hover:bg-emerald-400/10",
          )}
          title={running ? "Pause simulation" : "Resume simulation"}
        >
          {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <div className="h-4 w-px bg-white/10" />
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => setTimeScale(s)}
            className={cn(
              "rounded-lg px-2 py-1 text-[11px] font-semibold tabular-nums transition-colors",
              timeScale === s ? "bg-brand-500/20 text-brand-200" : "text-ink-400 hover:text-ink-200",
            )}
          >
            {s}×
          </button>
        ))}
      </div>

      {/* Alerts */}
      <button
        onClick={() => navigate("/alerts")}
        className="relative grid h-9 w-9 place-items-center rounded-xl border border-white/5 bg-white/[0.03] text-ink-200 hover:bg-white/10"
        aria-label="Alerts"
      >
        <Bell className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
        {unack > 0 && (
          <span
            className={cn(
              "absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-bold text-white",
              critical > 0 ? "bg-rose-500 animate-pulse" : "bg-amber-500",
            )}
          >
            {unack > 9 ? "9+" : unack}
          </span>
        )}
      </button>

      {/* User */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] py-1 pl-1 pr-2.5 hover:bg-white/10"
        >
          <Avatar name={user?.fullName ?? "User"} color={user?.avatarColor} size={30} />
          <div className="hidden text-left leading-tight sm:block">
            <div className="text-xs font-semibold text-ink-100">{user?.fullName ?? "User"}</div>
            <div className="text-[10px] capitalize text-ink-400">{user?.role}</div>
          </div>
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 z-20 mt-2 w-52 animate-fade-in rounded-xl border border-white/10 bg-ink-900 p-1.5 shadow-card">
              <div className="px-3 py-2">
                <div className="text-sm font-semibold text-ink-50">{user?.fullName}</div>
                <div className="truncate text-xs text-ink-400">{user?.email}</div>
              </div>
              <div className="my-1 h-px bg-white/5" />
              <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-ink-400">
                <Zap className="h-3.5 w-3.5 text-brand-300" />
                Simulation @ {timeScale}× speed
              </div>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  signOut();
                }}
                className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
