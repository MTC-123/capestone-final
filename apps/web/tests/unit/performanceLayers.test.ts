import { describe, it, expect } from 'vitest';
import { getLayerConfigForTier } from '@/lib/map/performanceLayers';

describe('getLayerConfigForTier', () => {
  it('tier-a: useDeckGL=true, enableAnimations=true, fastest polling, WMS enabled', () => {
    const cfg = getLayerConfigForTier('tier-a');
    expect(cfg.useDeckGL).toBe(true);
    expect(cfg.enableAnimations).toBe(true);
    expect(cfg.pollingInterval.incidents).toBeLessThan(20_000);
    expect(cfg.dataLimits.enableWMSOverlays).toBe(true);
  });

  it('tier-b: useDeckGL=true, enableAnimations=false, WMS enabled', () => {
    const cfg = getLayerConfigForTier('tier-b');
    expect(cfg.useDeckGL).toBe(true);
    expect(cfg.enableAnimations).toBe(false);
    expect(cfg.dataLimits.firmsMaxAge).toBe(24);
    expect(cfg.dataLimits.enableWMSOverlays).toBe(true);
  });

  it('tier-c: useDeckGL=false (MapLibre native), no animations, WMS disabled', () => {
    const cfg = getLayerConfigForTier('tier-c');
    expect(cfg.useDeckGL).toBe(false);
    expect(cfg.enableAnimations).toBe(false);
    expect(cfg.dataLimits.maxResourceMarkers).toBeLessThan(5_000);
    expect(cfg.dataLimits.enableWMSOverlays).toBe(false);
  });

  it('tier-a data limits are more permissive than tier-c', () => {
    const cfgA = getLayerConfigForTier('tier-a');
    const cfgC = getLayerConfigForTier('tier-c');
    expect(cfgA.dataLimits.maxResourceMarkers).toBeGreaterThan(cfgC.dataLimits.maxResourceMarkers);
  });
});

describe('tier config monotonicity', () => {
  const cfgA = getLayerConfigForTier('tier-a');
  const cfgB = getLayerConfigForTier('tier-b');
  const cfgC = getLayerConfigForTier('tier-c');

  it('maxResourceMarkers: A >= B >= C', () => {
    expect(cfgA.dataLimits.maxResourceMarkers).toBeGreaterThanOrEqual(cfgB.dataLimits.maxResourceMarkers);
    expect(cfgB.dataLimits.maxResourceMarkers).toBeGreaterThanOrEqual(cfgC.dataLimits.maxResourceMarkers);
  });

  it('maxInfrastructureMarkers: A >= B >= C', () => {
    expect(cfgA.dataLimits.maxInfrastructureMarkers).toBeGreaterThanOrEqual(cfgB.dataLimits.maxInfrastructureMarkers);
    expect(cfgB.dataLimits.maxInfrastructureMarkers).toBeGreaterThanOrEqual(cfgC.dataLimits.maxInfrastructureMarkers);
  });

  it('polling intervals: A <= B <= C for all categories', () => {
    for (const key of ['firms', 'incidents', 'resources'] as const) {
      expect(cfgA.pollingInterval[key]).toBeLessThanOrEqual(cfgB.pollingInterval[key]);
      expect(cfgB.pollingInterval[key]).toBeLessThanOrEqual(cfgC.pollingInterval[key]);
    }
  });

  it('iconSize: A >= B >= C', () => {
    expect(cfgA.iconSize).toBeGreaterThanOrEqual(cfgB.iconSize);
    expect(cfgB.iconSize).toBeGreaterThanOrEqual(cfgC.iconSize);
  });
});
