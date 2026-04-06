import dns from 'dns';
import { promisify } from 'util';
import { DnsCacheEntry } from './types';

const resolve4 = promisify(dns.resolve4);

/** Default Discord endpoints to pre-resolve. */
export const DEFAULT_DNS_ENDPOINTS = [
  'gateway.discord.gg',
  'discord.com',
  'cdn.discordapp.com',
];

/**
 * TTL-based DNS cache for Discord endpoints.
 * Pre-resolves on warmUp() to eliminate DNS lookup latency during
 * reconnect storms or cold starts.
 */
export class DnsCache {
  private readonly cache = new Map<string, DnsCacheEntry>();
  private readonly ttlMs: number;
  private readonly endpoints: string[];

  constructor(ttlMs = 60_000, endpoints = DEFAULT_DNS_ENDPOINTS) {
    this.ttlMs = ttlMs;
    this.endpoints = endpoints;
  }

  /**
   * Pre-warm the cache for all configured endpoints.
   * Safe to call multiple times — uses Promise.allSettled so a
   * single failure does not block others.
   */
  async warmUp(): Promise<void> {
    await Promise.allSettled(this.endpoints.map(h => this.resolve(h)));
  }

  /**
   * Returns cached addresses or re-resolves when TTL has expired.
   * Throws if DNS resolution fails and no cache entry exists.
   */
  async resolve(hostname: string): Promise<string[]> {
    const now = Date.now();
    const cached = this.cache.get(hostname);
    if (cached && now - cached.resolvedAt < cached.ttlMs) {
      return cached.addresses;
    }
    const addresses = await resolve4(hostname);
    this.cache.set(hostname, { addresses, resolvedAt: now, ttlMs: this.ttlMs });
    return addresses;
  }

  /** Raw snapshot of the cache — useful for health-check output. */
  getCacheSnapshot(): Record<string, DnsCacheEntry> {
    return Object.fromEntries(this.cache);
  }

  /** Number of entries currently in cache. */
  get size(): number {
    return this.cache.size;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
