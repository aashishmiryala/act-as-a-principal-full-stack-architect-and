import { create } from "zustand";
import type { Alert } from "@/types";
import { repository } from "@/lib/db/repository";

interface AlertState {
  alerts: Alert[];
  init: () => void;
  ingest: (alert: Alert) => void;
  acknowledge: (id: string, by: string) => void;
  acknowledgeAll: (by: string) => void;
  clear: () => void;
  unacknowledgedCount: () => number;
  criticalCount: () => number;
}

export const useAlertStore = create<AlertState>((set, get) => ({
  alerts: [],

  init: () => {
    repository.init();
    set({ alerts: repository.listAlerts() });
  },

  ingest: (alert) => {
    repository.addAlert(alert);
    set({ alerts: repository.listAlerts() });
  },

  acknowledge: (id, by) => {
    repository.acknowledgeAlert(id, by);
    set({ alerts: repository.listAlerts() });
  },

  acknowledgeAll: (by) => {
    repository.acknowledgeAll(by);
    set({ alerts: repository.listAlerts() });
  },

  clear: () => {
    repository.clearAlerts();
    set({ alerts: [] });
  },

  unacknowledgedCount: () => get().alerts.filter((a) => !a.acknowledged).length,
  criticalCount: () =>
    get().alerts.filter((a) => !a.acknowledged && a.severity === "critical").length,
}));
