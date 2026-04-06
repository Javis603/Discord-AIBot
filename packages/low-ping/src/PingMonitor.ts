import { EventEmitter } from 'events';
import {
  PingMonitorOptions,
  PingSnapshot,
  PingLevel,
  PingMonitorEvents,
} from './types';
import { DnsCache } from './DnsCache';

// Minimal interface — avoids hard dependency on discord.js types at runtime
interface DiscordClient {
  ws: { ping: number };
}

// Minimal interface — avoids hard dependency on @discordjs/voice at runtime
interface VoiceConnectionLike {
  ping?: number | null;
  on(event: string, listener: (...args: unknown[]) => void): this;
}

const DEFAULTS: Required<PingMonitorOptions> = {
  pollIntervalMs: 10_000,
  degradedThresholdMs: 200,
  criticalThresholdMs: 500,
  dnsTtlMs: 60_000,
  dnsEndpoints: ['gateway.discord.gg', 'discord.com'],
};

/**
 * Global low-ping monitor for Discord bots.
 *
 * Tracks Discord gateway WebSocket RTT and optional voice UDP latency.
 * Warms a DNS cache for Discord endpoints on start to reduce reconnect
 * latency on cold starts or token rotations.
 *
 * @example
 * const monitor = new PingMonitor({ pollIntervalMs: 10_000 });
 * monitor.attachClient(client);
 * monitor.on('critical', snap => logger.error('High ping!', snap));
 * await monitor.start();
 */
export class PingMonitor extends EventEmitter {
  private readonly opts: Required<PingMonitorOptions>;
  private readonly dnsCache: DnsCache;
  private client: DiscordClient | null = null;
  private readonly voiceConnections = new Map<string, VoiceConnectionLike>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastSnapshot: PingSnapshot | null = null;

  constructor(options: PingMonitorOptions = {}) {
    super();
    this.opts = { ...DEFAULTS, ...options };
    this.dnsCache = new DnsCache(this.opts.dnsTtlMs, this.opts.dnsEndpoints);
  }

  /**
   * Attach a Discord.js Client instance.
   * Safe to call before client.login() — ping will be -1 until ready.
   */
  attachClient(client: DiscordClient): this {
    this.client = client;
    return this;
  }

  /**
   * Track a voice connection for UDP latency reporting.
   * @param id   Unique key (e.g. voice channel ID).
   * @param conn VoiceConnection from @discordjs/voice.
   */
  trackVoiceConnection(id: string, conn: VoiceConnectionLike): this {
    this.voiceConnections.set(id, conn);
    // Auto-remove when connection is destroyed
    conn.on('stateChange', (_old: unknown, next: { status?: string }) => {
      if (next?.status === 'destroyed') {
        this.voiceConnections.delete(id);
      }
    });
    return this;
  }

  /**
   * Start polling. Pre-warms the DNS cache before first sample.
   * Emits an initial 'ping' sample immediately after warmup.
   */
  async start(): Promise<void> {
    try {
      await this.dnsCache.warmUp();
    } catch (err) {
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
    }
    // Immediate first sample
    this.poll();
    this.timer = setInterval(() => this.poll(), this.opts.pollIntervalMs);
  }

  /** Stop polling. Safe to call even if not started. */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Returns the most recent snapshot, or null if start() has not been called. */
  getLastSnapshot(): PingSnapshot | null {
    return this.lastSnapshot;
  }

  /** Expose the underlying DNS cache (for health-check routes). */
  getDnsCache(): DnsCache {
    return this.dnsCache;
  }

  /** Whether the monitor is currently active. */
  get isRunning(): boolean {
    return this.timer !== null;
  }

  private poll(): void {
    const gatewayRtt = this.client?.ws.ping ?? -1;
    let voiceRtt: number | null = null;

    for (const [id, conn] of this.voiceConnections) {
      const p = conn.ping;
      if (typeof p === 'number') {
        voiceRtt = p;
        this.emit('voice-ping', p, id);
      }
    }

    const snapshot: PingSnapshot = {
      gatewayRtt,
      voiceRtt,
      timestamp: Date.now(),
    };
    this.lastSnapshot = snapshot;
    this.emit('ping', snapshot);

    const level = this.classify(gatewayRtt);
    if (level === 'critical') this.emit('critical', snapshot);
    else if (level === 'degraded') this.emit('degraded', snapshot);
  }

  private classify(rtt: number): PingLevel {
    if (rtt < 0) return 'ok'; // -1 = not yet connected
    if (rtt >= this.opts.criticalThresholdMs) return 'critical';
    if (rtt >= this.opts.degradedThresholdMs) return 'degraded';
    return 'ok';
  }
}

// Augment EventEmitter typings for full type safety on .on()/.emit()
export declare interface PingMonitor {
  on<K extends keyof PingMonitorEvents>(
    event: K,
    listener: PingMonitorEvents[K]
  ): this;
  emit<K extends keyof PingMonitorEvents>(
    event: K,
    ...args: Parameters<PingMonitorEvents[K]>
  ): boolean;
}
