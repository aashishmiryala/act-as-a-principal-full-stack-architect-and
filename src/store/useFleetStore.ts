import { create } from "zustand";
import type { BrokerStats } from "@/types";
import { broker } from "@/lib/mqtt/broker";
import { fleet } from "@/lib/iot/fleet";
import type { ScenarioKind } from "@/lib/iot/sensors";

interface FleetState {
  running: boolean;
  timeScale: number;
  brokerStats: BrokerStats;
  init: () => void;
  toggleRunning: () => void;
  setTimeScale: (scale: number) => void;
  injectScenario: (deviceId: string, kind: ScenarioKind) => void;
  setDeviceOnline: (deviceId: string, online: boolean) => void;
}

let statsUnsub: (() => void) | null = null;

export const useFleetStore = create<FleetState>((set) => ({
  running: true,
  timeScale: 1,
  brokerStats: broker.stats(),

  init: () => {
    fleet.start();
    set({ running: fleet.isRunning, timeScale: fleet.scale });
    if (!statsUnsub) {
      statsUnsub = broker.onStats((brokerStats) => set({ brokerStats }));
    }
  },

  toggleRunning: () => {
    if (fleet.isRunning) fleet.pause();
    else fleet.resume();
    set({ running: fleet.isRunning });
  },

  setTimeScale: (scale) => {
    fleet.setTimeScale(scale);
    set({ timeScale: fleet.scale });
  },

  injectScenario: (deviceId, kind) => {
    fleet.injectScenario(deviceId, kind);
  },

  setDeviceOnline: (deviceId, online) => {
    fleet.setDeviceOnline(deviceId, online);
  },
}));
