/**
 * Performance-Optimized Layer Configuration
 *
 * Provides tier-based layer configuration for progressive enhancement.
 * Each tier has different feature availability, performance budgets, and data limits.
 *
 * @see docs/perf/gpu-tiers.md for full strategy documentation
 */

import type { GPUTier } from '@/lib/gpu/detection';

export interface LayerConfig {
  /**
   * Whether to use deck.gl for rendering (false = use MapLibre native layers)
   */
  useDeckGL: boolean;

  /**
   * Icon size in pixels
   */
  iconSize: number;

  /**
   * Maximum number of clusters (0 = no clustering)
   */
  maxClusters: number;

  /**
   * Enable animations (route dash, icon pulsing)
   */
  enableAnimations: boolean;

  /**
   * Polling intervals (milliseconds)
   */
  pollingInterval: {
    firms: number;
    incidents: number;
    resources: number;
  };

  /**
   * Data limits to prevent memory issues
   */
  dataLimits: {
    /** Maximum age of FIRMS detections in hours (Infinity = all) */
    firmsMaxAge: number;
    /** Maximum age of incidents in days (Infinity = all) */
    incidentsMaxAge: number;
    /** Maximum number of resource markers to render */
    maxResourceMarkers: number;
    /** Maximum number of infrastructure markers to render */
    maxInfrastructureMarkers: number;
    /** Whether to enable WMS raster overlays (EFFIS FWI, Burned Areas) */
    enableWMSOverlays: boolean;
  };
}

/**
 * Returns layer configuration based on GPU tier.
 *
 * Tier A (WebGL2 High Performance):
 * - Full deck.gl support with animations
 * - 60 FPS target
 * - No data limits
 *
 * Tier B (WebGL2 Standard):
 * - deck.gl without animations
 * - 30 FPS target
 * - Time-based data limits
 *
 * Tier C (Canvas2D Fallback):
 * - MapLibre native layers only
 * - 15 FPS target
 * - Strict data limits
 */
export function getLayerConfigForTier(tier: GPUTier): LayerConfig {
  switch (tier) {
    case 'tier-a':
      return {
        useDeckGL: true,
        iconSize: 32,
        maxClusters: Infinity,
        enableAnimations: true,

        pollingInterval: {
          firms: 10_000, // 10s
          incidents: 15_000, // 15s
          resources: 15_000, // 15s
        },
        dataLimits: {
          firmsMaxAge: Infinity, // All detections
          incidentsMaxAge: Infinity, // All incidents
          maxResourceMarkers: 10_000,
          maxInfrastructureMarkers: 5_000,
          enableWMSOverlays: true,
        },
      };

    case 'tier-b':
      return {
        useDeckGL: true,
        iconSize: 24,
        maxClusters: 100,
        enableAnimations: false,

        pollingInterval: {
          firms: 15_000, // 15s
          incidents: 20_000, // 20s
          resources: 20_000, // 20s
        },
        dataLimits: {
          firmsMaxAge: 24, // Last 24 hours
          incidentsMaxAge: 7, // Last 7 days
          maxResourceMarkers: 5_000,
          maxInfrastructureMarkers: 2_000,
          enableWMSOverlays: true,
        },
      };

    case 'tier-c':
      return {
        useDeckGL: false,
        iconSize: 16,
        maxClusters: 0, // No clustering
        enableAnimations: false,

        pollingInterval: {
          firms: 30_000, // 30s
          incidents: 30_000, // 30s
          resources: 30_000, // 30s
        },
        dataLimits: {
          firmsMaxAge: 12, // Last 12 hours
          incidentsMaxAge: 3, // Last 3 days
          maxResourceMarkers: 1_000,
          maxInfrastructureMarkers: 500,
          enableWMSOverlays: false, // Skip WMS on low-end GPUs
        },
      };
  }
}
