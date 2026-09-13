/**
 * In-browser MQTT-style message broker.
 * ------------------------------------------------------------------
 * Implements the subset of MQTT semantics the platform relies on: hierarchical
 * topics (`healthguard/{deviceId}/telemetry`), single-level (`+`) and
 * multi-level (`#`) wildcard subscriptions, retained messages, and QoS-0 style
 * fire-and-forget delivery. This lets the ESP32 fleet emulator "publish" and the
 * dashboard "subscribe" through the exact same API surface you'd use against a
 * real broker (EMQX / Mosquitto over WebSockets), so swapping in
 * `VITE_MQTT_WSS_URL` later is a transport change, not an app rewrite.
 */

import type { BrokerStats } from "@/types";

export type BrokerMessage<T = unknown> = {
  topic: string;
  payload: T;
  ts: number;
  retained: boolean;
  qos: 0 | 1;
};

type Handler<T = unknown> = (msg: BrokerMessage<T>) => void;

interface Subscription {
  id: string;
  filter: string;
  segments: string[];
  handler: Handler;
}

/** Match a concrete topic against an MQTT topic filter with +/# wildcards. */
export function topicMatches(filter: string, topic: string): boolean {
  const f = filter.split("/");
  const t = topic.split("/");
  for (let i = 0; i < f.length; i++) {
    const seg = f[i];
    if (seg === "#") return true; // multi-level, must be last
    if (seg === "+") {
      if (t[i] === undefined) return false;
      continue;
    }
    if (seg !== t[i]) return false;
  }
  return f.length === t.length;
}

export class MqttBroker {
  private subscriptions = new Map<string, Subscription>();
  private retained = new Map<string, BrokerMessage>();
  private statsListeners = new Set<(s: BrokerStats) => void>();

  private published = 0;
  private delivered = 0;
  private windowCount = 0;
  private windowStart = Date.now();
  private throughput = 0;
  private subId = 0;
  private tickHandle: ReturnType<typeof setInterval> | null = null;

  readonly transport: "in-browser" | "wss";

  constructor() {
    this.transport = import.meta.env.VITE_MQTT_WSS_URL ? "wss" : "in-browser";
    this.tickHandle = setInterval(() => this.recomputeThroughput(), 1000);
  }

  /** Publish a payload to a topic. Retained messages are cached for late joiners. */
  publish<T>(topic: string, payload: T, opts: { retained?: boolean; qos?: 0 | 1 } = {}): void {
    const msg: BrokerMessage<T> = {
      topic,
      payload,
      ts: Date.now(),
      retained: !!opts.retained,
      qos: opts.qos ?? 0,
    };
    this.published++;
    this.windowCount++;

    if (msg.retained) this.retained.set(topic, msg as BrokerMessage);

    for (const sub of this.subscriptions.values()) {
      if (topicMatches(sub.filter, topic)) {
        this.delivered++;
        try {
          sub.handler(msg as BrokerMessage);
        } catch (err) {
          // Never let a bad subscriber take down the bus.
          console.error(`[broker] subscriber ${sub.id} threw`, err);
        }
      }
    }
  }

  /** Subscribe to a topic filter. Returns an unsubscribe function. */
  subscribe<T>(filter: string, handler: Handler<T>): () => void {
    const id = `sub_${++this.subId}`;
    const sub: Subscription = {
      id,
      filter,
      segments: filter.split("/"),
      handler: handler as Handler,
    };
    this.subscriptions.set(id, sub);

    // Replay retained messages that match this new subscription.
    for (const msg of this.retained.values()) {
      if (topicMatches(filter, msg.topic)) {
        try {
          (handler as Handler)(msg);
        } catch (err) {
          console.error(`[broker] retained replay for ${id} threw`, err);
        }
      }
    }

    return () => {
      this.subscriptions.delete(id);
    };
  }

  onStats(listener: (s: BrokerStats) => void): () => void {
    this.statsListeners.add(listener);
    listener(this.stats());
    return () => this.statsListeners.delete(listener);
  }

  stats(): BrokerStats {
    return {
      connected: true,
      publishedMessages: this.published,
      deliveredMessages: this.delivered,
      activeSubscriptions: this.subscriptions.size,
      throughputMsgSec: this.throughput,
      transport: this.transport,
    };
  }

  private recomputeThroughput(): void {
    const now = Date.now();
    const elapsed = (now - this.windowStart) / 1000;
    if (elapsed >= 1) {
      this.throughput = Math.round(this.windowCount / elapsed);
      this.windowCount = 0;
      this.windowStart = now;
      const snapshot = this.stats();
      for (const l of this.statsListeners) l(snapshot);
    }
  }

  dispose(): void {
    if (this.tickHandle) clearInterval(this.tickHandle);
    this.subscriptions.clear();
    this.retained.clear();
    this.statsListeners.clear();
  }
}

/** Canonical topic builders — keep topic strings in one place. */
export const Topics = {
  telemetry: (deviceId: string) => `healthguard/${deviceId}/telemetry`,
  telemetryAll: () => `healthguard/+/telemetry`,
  status: (deviceId: string) => `healthguard/${deviceId}/status`,
  statusAll: () => `healthguard/+/status`,
  alerts: (deviceId: string) => `healthguard/${deviceId}/alerts`,
  alertsAll: () => `healthguard/+/alerts`,
  command: (deviceId: string) => `healthguard/${deviceId}/cmd`,
  everything: () => `healthguard/#`,
} as const;

/** Application-wide singleton broker instance. */
export const broker = new MqttBroker();
