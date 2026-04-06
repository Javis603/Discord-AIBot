import { PingMonitor } from '../src/PingMonitor';
import { DnsCache } from '../src/DnsCache';
import { PingSnapshot } from '../src/types';

/** Factory: mock Discord client with a given ws.ping value */
const makeClient = (ping = 50) => ({ ws: { ping } } as any);

/** Factory: mock VoiceConnection with a given ping value */
const makeVoiceConn = (ping: number | null = 80) => ({
  ping,
  on: jest.fn(),
} as any);

/** Spy warmUp to be a no-op so tests don't hit DNS */
function stubWarmUp(monitor: PingMonitor): jest.SpyInstance {
  return jest.spyOn(monitor.getDnsCache(), 'warmUp').mockResolvedValue();
}

describe('PingMonitor', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  describe('start() / stop()', () => {
    it('is not running before start()', () => {
      const m = new PingMonitor();
      expect(m.isRunning).toBe(false);
    });

    it('is running after start()', async () => {
      const m = new PingMonitor();
      stubWarmUp(m);
      await m.start();
      expect(m.isRunning).toBe(true);
      m.stop();
    });

    it('is not running after stop()', async () => {
      const m = new PingMonitor();
      stubWarmUp(m);
      await m.start();
      m.stop();
      expect(m.isRunning).toBe(false);
    });

    it('stop() is safe to call before start()', () => {
      const m = new PingMonitor();
      expect(() => m.stop()).not.toThrow();
    });
  });

  // ─── Polling & events ───────────────────────────────────────────────────────

  describe('ping event', () => {
    it('emits immediately on start()', async () => {
      const m = new PingMonitor({ pollIntervalMs: 1_000 });
      m.attachClient(makeClient(30));
      stubWarmUp(m);
      const spy = jest.fn<void, [PingSnapshot]>();
      m.on('ping', spy);
      await m.start();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].gatewayRtt).toBe(30);
      m.stop();
    });

    it('emits again after interval', async () => {
      const m = new PingMonitor({ pollIntervalMs: 1_000 });
      m.attachClient(makeClient(40));
      stubWarmUp(m);
      const spy = jest.fn();
      m.on('ping', spy);
      await m.start();
      jest.advanceTimersByTime(1_000);
      expect(spy).toHaveBeenCalledTimes(2);
      m.stop();
    });

    it('returns gatewayRtt -1 when no client attached', async () => {
      const m = new PingMonitor();
      stubWarmUp(m);
      const spy = jest.fn<void, [PingSnapshot]>();
      m.on('ping', spy);
      await m.start();
      expect(spy.mock.calls[0][0].gatewayRtt).toBe(-1);
      m.stop();
    });
  });

  describe('degraded / critical events', () => {
    it('emits degraded when ping >= 200ms', async () => {
      const m = new PingMonitor({ degradedThresholdMs: 200 });
      m.attachClient(makeClient(250));
      stubWarmUp(m);
      const spy = jest.fn();
      m.on('degraded', spy);
      await m.start();
      expect(spy).toHaveBeenCalledTimes(1);
      m.stop();
    });

    it('emits critical when ping >= 500ms', async () => {
      const m = new PingMonitor({ criticalThresholdMs: 500 });
      m.attachClient(makeClient(600));
      stubWarmUp(m);
      const spy = jest.fn();
      m.on('critical', spy);
      await m.start();
      expect(spy).toHaveBeenCalledTimes(1);
      m.stop();
    });

    it('does NOT emit degraded for ok ping', async () => {
      const m = new PingMonitor({ degradedThresholdMs: 200 });
      m.attachClient(makeClient(50));
      stubWarmUp(m);
      const spy = jest.fn();
      m.on('degraded', spy);
      await m.start();
      expect(spy).not.toHaveBeenCalled();
      m.stop();
    });

    it('does NOT emit degraded when ping is -1 (not connected)', async () => {
      const m = new PingMonitor({ degradedThresholdMs: 200 });
      m.attachClient(makeClient(-1));
      stubWarmUp(m);
      const spy = jest.fn();
      m.on('degraded', spy);
      await m.start();
      expect(spy).not.toHaveBeenCalled();
      m.stop();
    });
  });

  // ─── Voice connections ───────────────────────────────────────────────────────

  describe('voice-ping event', () => {
    it('emits voice-ping for a tracked connection', async () => {
      const m = new PingMonitor();
      m.attachClient(makeClient(30));
      stubWarmUp(m);
      const conn = makeVoiceConn(80);
      m.trackVoiceConnection('ch1', conn);
      const spy = jest.fn();
      m.on('voice-ping', spy);
      await m.start();
      expect(spy).toHaveBeenCalledWith(80, 'ch1');
      m.stop();
    });

    it('does NOT emit voice-ping when connection.ping is null', async () => {
      const m = new PingMonitor();
      m.attachClient(makeClient(30));
      stubWarmUp(m);
      m.trackVoiceConnection('ch1', makeVoiceConn(null));
      const spy = jest.fn();
      m.on('voice-ping', spy);
      await m.start();
      expect(spy).not.toHaveBeenCalled();
      m.stop();
    });

    it('sets voiceRtt in snapshot when voice conn has ping', async () => {
      const m = new PingMonitor();
      m.attachClient(makeClient(30));
      stubWarmUp(m);
      m.trackVoiceConnection('ch1', makeVoiceConn(99));
      const spy = jest.fn<void, [PingSnapshot]>();
      m.on('ping', spy);
      await m.start();
      expect(spy.mock.calls[0][0].voiceRtt).toBe(99);
      m.stop();
    });
  });

  // ─── Snapshot ───────────────────────────────────────────────────────────────

  describe('getLastSnapshot()', () => {
    it('returns null before start()', () => {
      const m = new PingMonitor();
      expect(m.getLastSnapshot()).toBeNull();
    });

    it('returns snapshot after start()', async () => {
      const m = new PingMonitor();
      m.attachClient(makeClient(55));
      stubWarmUp(m);
      await m.start();
      const snap = m.getLastSnapshot();
      expect(snap).not.toBeNull();
      expect(snap!.gatewayRtt).toBe(55);
      m.stop();
    });
  });

  // ─── Error handling ──────────────────────────────────────────────────────────

  describe('error event', () => {
    it('emits error when DNS warmUp throws', async () => {
      const m = new PingMonitor();
      jest.spyOn(m.getDnsCache(), 'warmUp').mockRejectedValue(new Error('DNS fail'));
      const spy = jest.fn();
      m.on('error', spy);
      await m.start();
      expect(spy).toHaveBeenCalledWith(expect.any(Error));
      m.stop();
    });
  });

  // ─── getDnsCache() ───────────────────────────────────────────────────────────

  describe('getDnsCache()', () => {
    it('returns a DnsCache instance', () => {
      const m = new PingMonitor();
      expect(m.getDnsCache()).toBeInstanceOf(DnsCache);
    });
  });

  // ─── Voice connection auto-removal ──────────────────────────────────────────

  describe('trackVoiceConnection() auto-removal', () => {
    it('removes connection from map when stateChange status is destroyed', () => {
      const m = new PingMonitor();
      const conn = makeVoiceConn(50);
      m.trackVoiceConnection('ch1', conn);
      // Simulate the stateChange event firing with destroyed status
      const stateChangeHandler = (conn.on as jest.Mock).mock.calls[0][1] as Function;
      stateChangeHandler({}, { status: 'destroyed' });
      // Verify it's been removed by checking voice-ping is no longer emitted
      const spy = jest.fn();
      m.on('voice-ping', spy);
      // poll manually — voice connection should be gone
      (m as any).poll();
      expect(spy).not.toHaveBeenCalled();
    });

    it('keeps connection when stateChange status is not destroyed', () => {
      const m = new PingMonitor();
      const conn = makeVoiceConn(50);
      m.trackVoiceConnection('ch1', conn);
      const stateChangeHandler = (conn.on as jest.Mock).mock.calls[0][1] as Function;
      stateChangeHandler({}, { status: 'connected' });
      const spy = jest.fn();
      m.on('voice-ping', spy);
      (m as any).poll();
      expect(spy).toHaveBeenCalledWith(50, 'ch1');
    });
  });
});
