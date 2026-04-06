import dns from 'dns';
import { DnsCache, DEFAULT_DNS_ENDPOINTS } from '../src/DnsCache';

// Mock the entire dns module so no real network calls happen
jest.mock('dns');

const mockDns = dns as jest.Mocked<typeof dns>;

/** Helper: make dns.resolve4 resolve with the given addresses */
function mockResolve(addresses: string[]) {
  (mockDns.resolve4 as unknown as jest.Mock).mockImplementation(
    (_host: string, cb: (err: null, addrs: string[]) => void) => {
      cb(null, addresses);
    }
  );
}

describe('DnsCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolve(['1.2.3.4']);
  });

  describe('resolve()', () => {
    it('resolves a hostname and caches the result', async () => {
      const cache = new DnsCache(60_000, ['gateway.discord.gg']);
      const result = await cache.resolve('gateway.discord.gg');
      expect(result).toEqual(['1.2.3.4']);
      expect(mockDns.resolve4).toHaveBeenCalledTimes(1);
    });

    it('returns cached result on second call within TTL', async () => {
      const cache = new DnsCache(60_000, ['discord.com']);
      await cache.resolve('discord.com');
      await cache.resolve('discord.com');
      expect(mockDns.resolve4).toHaveBeenCalledTimes(1);
    });

    it('re-resolves after TTL expiry', async () => {
      jest.useFakeTimers();
      const ttl = 100;
      const cache = new DnsCache(ttl, ['discord.com']);
      await cache.resolve('discord.com');
      // Advance time past TTL
      jest.advanceTimersByTime(ttl + 1);
      await cache.resolve('discord.com');
      expect(mockDns.resolve4).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });
  });

  describe('warmUp()', () => {
    it('pre-resolves all configured endpoints', async () => {
      const endpoints = ['a.discord.gg', 'b.discord.gg'];
      const cache = new DnsCache(60_000, endpoints);
      await cache.warmUp();
      expect(mockDns.resolve4).toHaveBeenCalledTimes(2);
      expect(cache.size).toBe(2);
    });

    it('does not throw if one endpoint fails', async () => {
      let callCount = 0;
      (mockDns.resolve4 as unknown as jest.Mock).mockImplementation(
        (_host: string, cb: (err: Error | null, addrs?: string[]) => void) => {
          callCount++;
          if (callCount === 1) cb(new Error('ENOTFOUND'));
          else cb(null, ['1.2.3.4']);
        }
      );
      const cache = new DnsCache(60_000, ['bad.host', 'good.host']);
      await expect(cache.warmUp()).resolves.not.toThrow();
    });
  });

  describe('getCacheSnapshot()', () => {
    it('returns a plain object of all cached entries', async () => {
      const cache = new DnsCache(60_000, ['discord.com']);
      await cache.resolve('discord.com');
      const snap = cache.getCacheSnapshot();
      expect(snap['discord.com']).toBeDefined();
      expect(snap['discord.com'].addresses).toEqual(['1.2.3.4']);
    });
  });

  describe('clearCache()', () => {
    it('empties the cache', async () => {
      const cache = new DnsCache(60_000, ['discord.com']);
      await cache.resolve('discord.com');
      expect(cache.size).toBe(1);
      cache.clearCache();
      expect(cache.size).toBe(0);
    });
  });

  describe('DEFAULT_DNS_ENDPOINTS', () => {
    it('includes gateway.discord.gg', () => {
      expect(DEFAULT_DNS_ENDPOINTS).toContain('gateway.discord.gg');
    });
  });
});
