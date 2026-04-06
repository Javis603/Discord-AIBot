/**
 * Configuration options for PingMonitor.
 */
export interface PingMonitorOptions {
  /** Poll interval in ms. Default: 10_000 */
  pollIntervalMs?: number;
  /** Gateway RTT threshold for 'degraded' event in ms. Default: 200 */
  degradedThresholdMs?: number;
  /** Gateway RTT threshold for 'critical' event in ms. Default: 500 */
  criticalThresholdMs?: number;
  /** DNS cache TTL in ms. Default: 60_000 */
  dnsTtlMs?: number;
  /** Discord endpoints to pre-resolve on start. */
  dnsEndpoints?: string[];
}

/**
 * A point-in-time snapshot of ping metrics.
 */
export interface PingSnapshot {
  /** Discord gateway WebSocket RTT in ms (client.ws.ping). -1 if not yet available. */
  gatewayRtt: number;
  /** Voice UDP RTT in ms. null if no voice connection is tracked. */
  voiceRtt: number | null;
  /** Unix timestamp (ms) when the sample was taken. */
  timestamp: number;
}

/** Severity level of the current ping. */
export type PingLevel = 'ok' | 'degraded' | 'critical';

/** A cached DNS resolution entry. */
export interface DnsCacheEntry {
  addresses: string[];
  resolvedAt: number;
  ttlMs: number;
}

/** Typed events emitted by PingMonitor. */
export interface PingMonitorEvents {
  /** Emitted on every poll with a full snapshot. */
  ping: (snapshot: PingSnapshot) => void;
  /** Emitted when a tracked voice connection reports RTT. */
  'voice-ping': (rtt: number, connectionId: string) => void;
  /** Emitted when gateway RTT >= degradedThresholdMs. */
  degraded: (snapshot: PingSnapshot) => void;
  /** Emitted when gateway RTT >= criticalThresholdMs. */
  critical: (snapshot: PingSnapshot) => void;
  /** Emitted on internal errors (e.g. DNS warmup failure). */
  error: (err: Error) => void;
}
