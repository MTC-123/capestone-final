import { describe, expect, it } from 'vitest';
import { realtimeCapability, OFFICIALS_CHANNEL, userChannel } from '@/lib/realtime/channels';

describe('realtimeCapability', () => {
  it('lets a resident subscribe to their own channel only', () => {
    expect(realtimeCapability('u1', 'CIVILIAN')).toEqual({ [userChannel('u1')]: ['subscribe'] });
  });

  it('adds the officials channel and vehicle telemetry for officials', () => {
    expect(realtimeCapability('o1', 'OFFICIAL')).toEqual({
      [userChannel('o1')]: ['subscribe'],
      [OFFICIALS_CHANNEL]: ['subscribe'],
      'vehicles:*': ['subscribe'],
    });
  });

  it('never grants publish or presence to a browser', () => {
    for (const role of ['CIVILIAN', 'OFFICIAL']) {
      const ops = Object.values(realtimeCapability('x', role)).flat();
      expect(new Set(ops)).toEqual(new Set(['subscribe']));
    }
  });
});
