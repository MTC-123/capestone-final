# GPU Tier Strategy

**Version:** 1.0
**Date:** 2026-02-12
**Status:** V1 Release Recommendation
**Project Context:** RICER Fire Dispatch Map (Ifrane Region)

---

## Executive Summary

This document defines a GPU capability detection and progressive enhancement strategy for the RICER fire dispatch mapping application. Given the project constraints (deck.gl v8.9.25, MapLibre v4.7.1, real-time fire detection requirements), we recommend a **WebGL2/WebGL1 tiering approach** for V1, deferring WebGPU to V2.

**Key Decision:** Tier A will use **WebGL2 with animated routes**, not WebGPU, due to deck.gl v8.9.25 limitations and WebGPU's experimental status in deck.gl v9.

---

## Detection Approach

### Runtime Detection Strategy

Capability detection occurs at application initialization using a waterfall detection pattern:

```typescript
// lib/gpu/detection.ts

export type GPUTier = 'tier-a' | 'tier-b' | 'tier-c';

export interface GPUCapabilities {
  tier: GPUTier;
  renderer: 'webgl2' | 'webgl' | 'canvas2d';
  contextLost: boolean;
  extensions: string[];
  vendor?: string;
  maxTextureSize: number;
  maxViewportDims: [number, number];
}

/**
 * Detects GPU capabilities and assigns a performance tier.
 *
 * Detection waterfall:
 * 1. Try WebGL2 (Tier A)
 * 2. Try WebGL1 (Tier B)
 * 3. Fallback to Canvas2D (Tier C)
 */
export async function detectGPUCapabilities(): Promise<GPUCapabilities> {
  // Check for user override (localStorage/URL param)
  const override = getUserTierOverride();
  if (override) {
    return createCapabilitiesForTier(override);
  }

  // Attempt WebGL2
  const canvas = document.createElement('canvas');
  let gl2 = canvas.getContext('webgl2', {
    failIfMajorPerformanceCaveat: true, // Fail if software rendering
    antialias: false, // Disable for performance testing
  });

  if (gl2 && !gl2.isContextLost()) {
    const capabilities = extractWebGL2Capabilities(gl2);

    // Additional quality gates for Tier A
    if (meetsWebGL2TierARequirements(capabilities)) {
      return {
        tier: 'tier-a',
        renderer: 'webgl2',
        contextLost: false,
        extensions: gl2.getSupportedExtensions() || [],
        vendor: gl2.getParameter(gl2.RENDERER),
        maxTextureSize: gl2.getParameter(gl2.MAX_TEXTURE_SIZE),
        maxViewportDims: gl2.getParameter(gl2.MAX_VIEWPORT_DIMS),
      };
    }
  }

  // Attempt WebGL1
  let gl1 = canvas.getContext('webgl', {
    failIfMajorPerformanceCaveat: true,
    antialias: false,
  });

  if (gl1 && !gl1.isContextLost()) {
    return {
      tier: 'tier-b',
      renderer: 'webgl',
      contextLost: false,
      extensions: gl1.getSupportedExtensions() || [],
      vendor: gl1.getParameter(gl1.RENDERER),
      maxTextureSize: gl1.getParameter(gl1.MAX_TEXTURE_SIZE),
      maxViewportDims: gl1.getParameter(gl1.MAX_VIEWPORT_DIMS),
    };
  }

  // Fallback to Tier C
  return {
    tier: 'tier-c',
    renderer: 'canvas2d',
    contextLost: false,
    extensions: [],
    maxTextureSize: 4096, // Conservative estimate
    maxViewportDims: [4096, 4096],
  };
}

/**
 * Quality gates for Tier A (WebGL2 with advanced features)
 */
function meetsWebGL2TierARequirements(capabilities: WebGL2Capabilities): boolean {
  // Minimum texture size (for high-res icons, heatmaps)
  if (capabilities.maxTextureSize < 4096) return false;

  // Check for instanced rendering (deck.gl performance optimization)
  if (!capabilities.extensions.includes('ANGLE_instanced_arrays') &&
      !capabilities.isWebGL2Core) return false;

  // Check for VAO support (WebGL2 core, but verify)
  if (!capabilities.hasVertexArrayObjects) return false;

  // Memory constraints: Estimate available VRAM
  // Note: No reliable API for this, use heuristics
  const estimatedVRAM = estimateAvailableVRAM(capabilities);
  if (estimatedVRAM < 256) return false; // 256MB minimum for Tier A

  return true;
}

/**
 * Estimates available VRAM (MB) based on device characteristics
 * Heuristic-based: no direct API available
 */
function estimateAvailableVRAM(capabilities: any): number {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  const hasHighPerformance = navigator.hardwareConcurrency >= 4;
  const deviceMemory = (navigator as any).deviceMemory || 4; // GB

  if (isMobile) {
    return deviceMemory >= 6 ? 512 : 256; // Conservative mobile estimates
  }

  if (hasHighPerformance && deviceMemory >= 8) {
    return 1024; // Desktop with decent specs
  }

  return 512; // Default desktop estimate
}

/**
 * User override detection (localStorage or URL parameter)
 * Used for testing and accessibility
 */
function getUserTierOverride(): GPUTier | null {
  // Check URL parameter first: ?gpu-tier=tier-b
  const urlParams = new URLSearchParams(window.location.search);
  const urlOverride = urlParams.get('gpu-tier') as GPUTier;
  if (urlOverride && ['tier-a', 'tier-b', 'tier-c'].includes(urlOverride)) {
    return urlOverride;
  }

  // Check localStorage: localStorage.setItem('ricer:gpu-tier', 'tier-c')
  const storageOverride = localStorage.getItem('ricer:gpu-tier') as GPUTier;
  if (storageOverride && ['tier-a', 'tier-b', 'tier-c'].includes(storageOverride)) {
    return storageOverride;
  }

  return null;
}
```

### Browser Compatibility Matrix

| Browser           | WebGL2 (Tier A) | WebGL1 (Tier B) | Canvas2D (Tier C) |
|-------------------|-----------------|-----------------|-------------------|
| Chrome 56+        | Yes             | Yes             | Yes               |
| Firefox 51+       | Yes             | Yes             | Yes               |
| Safari 15+        | Yes             | Yes             | Yes               |
| Edge 79+          | Yes             | Yes             | Yes               |
| Mobile Safari 15+ | Yes             | Yes             | Yes               |
| Chrome Android 56+| Yes             | Yes             | Yes               |
| Samsung Internet  | Yes (v8+)       | Yes             | Yes               |
| Firefox Android   | Yes (68+)       | Yes             | Yes               |

**Support Coverage:**
- Tier A (WebGL2): ~95% desktop, ~85% mobile (2026 estimates)
- Tier B (WebGL1): ~99% all devices
- Tier C (Canvas2D): 100% (guaranteed fallback)

### Detection Performance

Detection is non-blocking and fast:
- **Cold start cost:** <50ms (canvas creation + context probing)
- **Cached result:** Stored in app state, no re-detection during session
- **User override:** Bypasses detection, <5ms

---

## Tier Definitions

### Tier A: WebGL2 (High Performance)

**Target Devices:** Modern desktops, high-end mobile devices (2020+)

**GPU Requirements:**
- WebGL2 context available
- Hardware acceleration enabled (not software rendering)
- Minimum 256MB estimated VRAM
- MAX_TEXTURE_SIZE >= 4096
- Instanced rendering support

**Rendering Engine:**
- MapLibre GL JS v4.7.1 (WebGL2 mode)
- deck.gl v8.9.25 overlay (WebGL2)

**Enabled Features:**
- Full deck.gl layer support (IconLayer, PathLayer)
- Animated route dash (PathLayer with dashOffset animation)
- High-resolution icons (32px)
- Full clustering (FIRMS, incidents)
- MapLibre 3D terrain (if enabled)
- Heatmap visualization
- Real-time layer updates (10s polling)

**Performance Budget:**
- Target: 60 FPS (pan/zoom/rotate)
- Acceptable: 45+ FPS sustained
- Max layer count: 50 layers total
- Max data points per layer: 10,000 (IconLayer), 50,000 (PathLayer)

### Tier B: WebGL1 (Standard Performance)

**Target Devices:** Older desktops, mid-range mobile devices (2018-2020)

**GPU Requirements:**
- WebGL1 context available
- Hardware acceleration enabled
- MAX_TEXTURE_SIZE >= 2048

**Rendering Engine:**
- MapLibre GL JS v4.7.1 (WebGL1 mode)
- deck.gl v8.9.25 overlay (WebGL1)

**Enabled Features:**
- deck.gl IconLayer, PathLayer (no animation)
- Static route rendering (no dashOffset updates)
- Standard-resolution icons (24px)
- Reduced clustering (max 100 clusters)
- MapLibre 2D only (3D terrain disabled)
- Heatmap visualization (simplified)
- Standard layer updates (15s polling)

**Degraded Features:**
- No animated route dash (static dashed lines only)
- Reduced icon sizes
- Fewer clustered points (performance limit)
- No 3D terrain

**Performance Budget:**
- Target: 30 FPS (pan/zoom)
- Acceptable: 20+ FPS sustained
- Max layer count: 30 layers total
- Max data points per layer: 5,000 (IconLayer), 20,000 (PathLayer)

### Tier C: Canvas2D Fallback (Compatibility)

**Target Devices:** Very old devices, integrated GPUs with driver issues, software rendering

**GPU Requirements:**
- WebGL unavailable or context lost
- Fallback to Canvas2D or MapLibre raster tiles

**Rendering Engine:**
- MapLibre GL JS v4.7.1 (raster fallback or Canvas2D)
- No deck.gl overlay (replaced with MapLibre native layers)

**Enabled Features:**
- MapLibre native layers only (no deck.gl)
- Simple circle markers (GeoJSON + symbolLayer)
- Static lines (lineLayer, no dashing)
- No clustering (show all points up to limit)
- 2D map only
- Static layer updates (30s polling)

**Disabled Features:**
- All deck.gl layers
- Animated routes
- Custom icons (replaced with simple circles)
- Heatmap
- 3D terrain
- Advanced visual effects

**Performance Budget:**
- Target: 15 FPS (pan/zoom)
- Acceptable: 10+ FPS sustained
- Max layer count: 10 layers total
- Max data points per layer: 1,000 (markers), 5,000 (lines)

**User Experience:**
- Display tier notification banner: "Using simplified rendering for compatibility"
- Provide link to GPU troubleshooting guide
- Suggest browser update or device upgrade

---

## Feature Toggle Matrix

### Layer Availability by Tier

| Feature                     | Tier A (WebGL2) | Tier B (WebGL1) | Tier C (Canvas2D) |
|-----------------------------|-----------------|-----------------|-------------------|
| **deck.gl Layers**          |                 |                 |                   |
| IconLayer (Resources)       | Yes (32px)      | Yes (24px)      | No (MapLibre alt) |
| IconLayer (Infrastructure)  | Yes (28px)      | Yes (20px)      | No (MapLibre alt) |
| PathLayer (Routes)          | Yes             | Yes (static)    | No (lineLayer alt)|
| PathLayer (Firebreaks)      | Yes             | Yes             | No (lineLayer alt)|
| IconLayer (Teams)           | Yes             | Yes             | No (MapLibre alt) |
| **Animations**              |                 |                 |                   |
| Animated route dash         | Yes (60fps)     | No              | No                |
| Icon pulsing (active fire)  | Yes             | No              | No                |
| Smooth transitions          | Yes             | Limited         | No                |
| **MapLibre Features**       |                 |                 |                   |
| 3D Terrain                  | Yes             | No              | No                |
| Heatmap (FIRMS)             | Yes (full)      | Yes (reduced)   | No                |
| Clustering                  | Yes (unlimited) | Yes (max 100)   | No                |
| Custom icons                | SVG data URLs   | SVG data URLs   | Simple circles    |
| **Data Layers**             |                 |                 |                   |
| FIRMS Detections            | All             | Last 24h        | Last 12h          |
| Incidents                   | All             | Last 7d         | Last 3d           |
| Resources                   | All             | All             | Limited (1000)    |
| Infrastructure              | All             | All             | Limited (500)     |
| Risk Basins                 | All             | All             | All               |
| **Polling Intervals**       |                 |                 |                   |
| FIRMS updates               | 10s             | 15s             | 30s               |
| Incidents updates           | 15s             | 20s             | 30s               |
| Resources updates           | 15s             | 20s             | 30s               |

### Decision Logic (Pseudocode)

```typescript
// lib/map/performanceLayers.ts

import type { GPUTier, GPUCapabilities } from '@/lib/gpu/detection';
import { createResourceLayer, createInfrastructureLayers } from '@/lib/map/layers';
import { createRouteLayer, createActiveTeamsLayer } from '@/lib/map/dispatchLayers';

export interface LayerConfig {
  useDeckGL: boolean;
  iconSize: number;
  maxClusters: number;
  enableAnimations: boolean;
  enable3D: boolean;
  pollingInterval: {
    firms: number;
    incidents: number;
    resources: number;
  };
  dataLimits: {
    firmsMaxAge: number; // hours
    incidentsMaxAge: number; // days
    maxResourceMarkers: number;
    maxInfrastructureMarkers: number;
  };
}

/**
 * Returns layer configuration based on GPU tier
 */
export function getLayerConfigForTier(tier: GPUTier): LayerConfig {
  switch (tier) {
    case 'tier-a':
      return {
        useDeckGL: true,
        iconSize: 32,
        maxClusters: Infinity,
        enableAnimations: true,
        enable3D: true,
        pollingInterval: {
          firms: 10_000,
          incidents: 15_000,
          resources: 15_000,
        },
        dataLimits: {
          firmsMaxAge: Infinity,
          incidentsMaxAge: Infinity,
          maxResourceMarkers: 10_000,
          maxInfrastructureMarkers: 5_000,
        },
      };

    case 'tier-b':
      return {
        useDeckGL: true,
        iconSize: 24,
        maxClusters: 100,
        enableAnimations: false,
        enable3D: false,
        pollingInterval: {
          firms: 15_000,
          incidents: 20_000,
          resources: 20_000,
        },
        dataLimits: {
          firmsMaxAge: 24, // Last 24 hours only
          incidentsMaxAge: 7, // Last 7 days only
          maxResourceMarkers: 5_000,
          maxInfrastructureMarkers: 2_000,
        },
      };

    case 'tier-c':
      return {
        useDeckGL: false,
        iconSize: 16,
        maxClusters: 0, // No clustering
        enableAnimations: false,
        enable3D: false,
        pollingInterval: {
          firms: 30_000,
          incidents: 30_000,
          resources: 30_000,
        },
        dataLimits: {
          firmsMaxAge: 12, // Last 12 hours only
          incidentsMaxAge: 3, // Last 3 days only
          maxResourceMarkers: 1_000,
          maxInfrastructureMarkers: 500,
        },
      };
  }
}

/**
 * Creates layers appropriate for the current GPU tier
 */
export function createLayersForTier(
  tier: GPUTier,
  config: LayerConfig,
  data: {
    resources: GeoFeatureCollection<GeoResourceProps>;
    infrastructure: GeoFeatureCollection<GeoInfrastructureProps>;
    routes: RouteData[];
    teams: TeamData[];
  },
  layerVisibility: {
    resources: boolean;
    infrastructure: boolean;
    routes: boolean;
    teams: boolean;
  }
): Layer[] {
  if (config.useDeckGL) {
    // Tier A & B: Use deck.gl layers
    return [
      createResourceLayer(data.resources, layerVisibility.resources),
      ...createInfrastructureLayers(data.infrastructure, layerVisibility.infrastructure),
      ...data.routes.map(route =>
        createRouteLayer(route, config.enableAnimations)
      ),
      createActiveTeamsLayer(data.teams, layerVisibility.teams),
    ].filter(Boolean);
  } else {
    // Tier C: Return empty array, use MapLibre native layers instead
    return [];
  }
}
```

### Tier C MapLibre Fallback Layers

When `tier === 'tier-c'`, replace deck.gl layers with MapLibre native layers:

```typescript
// lib/map/fallbackLayers.ts

import type { LayerProps } from 'react-map-gl';

/**
 * Creates MapLibre native layers for Tier C fallback
 */
export function createFallbackResourceLayer(): LayerProps {
  return {
    id: 'resources-fallback',
    type: 'circle',
    source: 'resources',
    paint: {
      'circle-radius': 8,
      'circle-color': [
        'match',
        ['get', 'type'],
        'TRUCK', '#ef4444',
        'AIRCRAFT', '#f59e0b',
        'PERSONNEL', '#10b981',
        'EQUIPMENT', '#6366f1',
        '#6b7280', // default
      ],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  };
}

export function createFallbackInfrastructureLayer(): LayerProps {
  return {
    id: 'infrastructure-fallback',
    type: 'circle',
    source: 'infrastructure',
    filter: ['in', ['get', 'type'], ['literal', ['WATCHTOWER', 'WATER_POINT', 'STATION']]],
    paint: {
      'circle-radius': 6,
      'circle-color': [
        'match',
        ['get', 'type'],
        'WATCHTOWER', '#7c3aed',
        'WATER_POINT', '#0ea5e9',
        'STATION', '#14b8a6',
        '#6b7280',
      ],
      'circle-stroke-width': 1,
      'circle-stroke-color': '#ffffff',
    },
  };
}

export function createFallbackFirebreakLayer(): LayerProps {
  return {
    id: 'firebreak-fallback',
    type: 'line',
    source: 'infrastructure',
    filter: ['==', ['get', 'type'], 'FIREBREAK'],
    paint: {
      'line-color': '#8b5cf6',
      'line-width': 2,
    },
  };
}

export function createFallbackRouteLayer(): LayerProps {
  return {
    id: 'routes-fallback',
    type: 'line',
    source: 'routes',
    paint: {
      'line-color': '#3b82f6',
      'line-width': 3,
    },
  };
}
```

---

## Failure Modes & Recovery

### 1. Context Loss (webglcontextlost)

**Trigger Scenarios:**
- GPU driver crash
- Browser GPU reset (long-running operation in another tab)
- Low memory condition (mobile devices)
- Tab backgrounding for extended period (mobile Safari)
- GPU shared resource contention

**Detection:**
```typescript
// lib/gpu/contextMonitor.ts

export class WebGLContextMonitor {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  private onContextLost: () => void;
  private onContextRestored: () => void;

  constructor(
    canvas: HTMLCanvasElement,
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    handlers: {
      onContextLost: () => void;
      onContextRestored: () => void;
    }
  ) {
    this.canvas = canvas;
    this.gl = gl;
    this.onContextLost = handlers.onContextLost;
    this.onContextRestored = handlers.onContextRestored;

    this.attachListeners();
  }

  private attachListeners() {
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);
  }

  private handleContextLost = (event: Event) => {
    event.preventDefault(); // Critical: prevent permanent loss
    console.error('[WebGL] Context lost, attempting recovery');

    // Halt rendering loop
    this.onContextLost();

    // Log telemetry
    logger.error('webgl_context_lost', {
      renderer: this.gl.getParameter(this.gl.RENDERER),
      vendor: this.gl.getParameter(this.gl.VENDOR),
      timestamp: Date.now(),
    });
  };

  private handleContextRestored = () => {
    console.info('[WebGL] Context restored');

    // Trigger re-initialization
    this.onContextRestored();

    // Log telemetry
    logger.info('webgl_context_restored', {
      timestamp: Date.now(),
    });
  };

  public isContextLost(): boolean {
    return this.gl.isContextLost();
  }

  public destroy() {
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
  }
}
```

**Recovery Strategy:**

1. **Immediate Response:**
   - Display toast notification: "Map rendering paused due to GPU issue. Attempting recovery..."
   - Halt rendering loop (cancel requestAnimationFrame)
   - Preserve app state (layer visibility, selected features, viewState)

2. **Automatic Recovery:**
   - Wait for `webglcontextrestored` event
   - Re-create all GPU resources (MapLibre + deck.gl will handle this internally)
   - Restore app state
   - Resume rendering loop
   - Display success toast: "Map rendering restored"

3. **Fallback on Repeated Failure:**
   - If context lost > 3 times in 60 seconds, downgrade to Tier C
   - Display persistent banner: "Switched to compatibility mode due to GPU instability"
   - Store fallback flag in sessionStorage to prevent thrashing

**UI Response:**
```tsx
// components/map/ContextLossHandler.tsx

export function ContextLossHandler({ tier }: { tier: GPUTier }) {
  const [contextLostCount, setContextLostCount] = useState(0);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (contextLostCount >= 3) {
      // Downgrade to Tier C
      sessionStorage.setItem('ricer:gpu-fallback', 'true');
      window.location.reload(); // Force re-initialization
    }
  }, [contextLostCount]);

  return (
    <>
      {showBanner && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50
                        bg-orange-500 text-white px-4 py-2 rounded-md shadow-lg">
          Map rendering paused due to GPU issue. Attempting recovery...
        </div>
      )}
    </>
  );
}
```

### 2. Out of Memory (OOM)

**Trigger Scenarios:**
- Too many data points loaded simultaneously
- Large texture uploads (high-res icons, heatmaps)
- Memory leak in rendering loop
- Mobile device memory pressure
- Browser memory cap reached (Chrome: ~1GB per tab)

**Detection:**
```typescript
// lib/gpu/memoryMonitor.ts

export class GPUMemoryMonitor {
  private memoryWarningThreshold = 0.8; // 80% of estimated VRAM
  private estimatedVRAM: number;
  private estimatedUsage = 0;

  constructor(capabilities: GPUCapabilities) {
    this.estimatedVRAM = this.estimateMaxVRAM(capabilities);
  }

  /**
   * Estimates memory usage for a layer
   */
  public estimateLayerMemory(layer: {
    type: string;
    dataCount: number;
  }): number {
    // Rough estimates in MB
    switch (layer.type) {
      case 'IconLayer':
        return (layer.dataCount * 256) / 1024 / 1024; // 256 bytes per icon
      case 'PathLayer':
        return (layer.dataCount * 512) / 1024 / 1024; // 512 bytes per path segment
      case 'HeatmapLayer':
        return 10; // Texture memory
      default:
        return 1;
    }
  }

  public trackLayerAddition(layer: any) {
    this.estimatedUsage += this.estimateLayerMemory(layer);
    this.checkMemoryPressure();
  }

  public trackLayerRemoval(layer: any) {
    this.estimatedUsage -= this.estimateLayerMemory(layer);
  }

  private checkMemoryPressure() {
    const usage = this.estimatedUsage / this.estimatedVRAM;

    if (usage > this.memoryWarningThreshold) {
      console.warn('[GPU] Memory pressure detected', {
        usage: this.estimatedUsage,
        max: this.estimatedVRAM,
        percentage: (usage * 100).toFixed(1) + '%',
      });

      // Trigger memory reduction strategies
      this.dispatchMemoryWarning();
    }
  }

  private dispatchMemoryWarning() {
    window.dispatchEvent(new CustomEvent('gpu:memory-warning', {
      detail: { usage: this.estimatedUsage, max: this.estimatedVRAM },
    }));
  }
}
```

**Recovery Strategy:**

1. **Preventive Measures:**
   - Implement data limits per tier (see Feature Toggle Matrix)
   - Use `updateTriggers` to minimize buffer regeneration
   - Pre-compute attributes server-side when possible
   - Lazy-load layers (only render visible layers)

2. **Runtime Mitigation:**
   - Monitor estimated memory usage
   - If approaching limit (80% VRAM):
     - Reduce FIRMS detection timeframe (load last 12h instead of 24h)
     - Reduce cluster detail (max 50 clusters instead of 100)
     - Disable heatmap temporarily
   - Display warning toast: "Reducing map detail to prevent performance issues"

3. **Graceful Degradation:**
   - If OOM occurs, catch error and downgrade to lower tier
   - Clear all layers, re-initialize with lower tier config
   - Display banner: "Switched to simplified rendering due to memory constraints"

**UI Response:**
```tsx
// components/map/MemoryWarning.tsx

export function MemoryWarning() {
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setShowWarning(true);
      setTimeout(() => setShowWarning(false), 5000);
    };

    window.addEventListener('gpu:memory-warning', handler as EventListener);
    return () => window.removeEventListener('gpu:memory-warning', handler as EventListener);
  }, []);

  if (!showWarning) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50
                    bg-yellow-500 text-white px-4 py-3 rounded-md shadow-lg max-w-sm">
      <strong>Memory Warning:</strong> Reducing map detail to maintain performance.
    </div>
  );
}
```

### 3. Driver Crashes / GPU Hangs

**Trigger Scenarios:**
- Buggy GPU drivers (especially Intel integrated GPUs)
- Overheating (mobile devices, laptops)
- Hardware failure
- Conflicting GPU processes (mining software, video rendering)

**Detection:**
- Browser console errors: "WebGL: CONTEXT_LOST_WEBGL"
- Black screen / frozen rendering
- Browser tab crash

**Recovery Strategy:**

1. **Automatic Detection:**
   - Context loss event handler (see section 1)
   - watchdog timer: if no render frame for 5 seconds, assume hang

2. **Immediate Response:**
   - Display full-screen overlay: "Map rendering has stopped. Please reload the page."
   - Provide reload button
   - Log error to Sentry/observability platform

3. **Persistent Fallback:**
   - On next page load, check for crash flag in sessionStorage
   - If found, force Tier C mode
   - Display banner: "Using simplified rendering due to previous GPU issue"

**UI Response:**
```tsx
// components/map/CrashRecovery.tsx

export function CrashRecovery() {
  const [crashed, setCrashed] = useState(false);

  useEffect(() => {
    // Check for previous crash
    const previousCrash = sessionStorage.getItem('ricer:gpu-crash');
    if (previousCrash) {
      // Force Tier C on reload
      localStorage.setItem('ricer:gpu-tier', 'tier-c');
      sessionStorage.removeItem('ricer:gpu-crash');
    }

    // Watchdog timer
    let lastFrameTime = Date.now();
    const checkInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastFrameTime > 5000) {
        console.error('[GPU] Rendering hang detected');
        sessionStorage.setItem('ricer:gpu-crash', 'true');
        setCrashed(true);
      }
    }, 1000);

    // Update frame time on each render
    const frameCallback = () => {
      lastFrameTime = Date.now();
    };
    window.addEventListener('map:render-frame', frameCallback);

    return () => {
      clearInterval(checkInterval);
      window.removeEventListener('map:render-frame', frameCallback);
    };
  }, []);

  if (!crashed) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-md text-center">
        <h2 className="text-xl font-bold text-red-600 mb-4">
          Map Rendering Stopped
        </h2>
        <p className="text-gray-700 mb-4">
          The map has stopped responding. This is likely due to a GPU issue.
          Reloading will switch to compatibility mode.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}
```

### 4. Progressive Degradation (Tier A → B → C)

**Automatic Downgrade Triggers:**
- 3+ context losses in 60 seconds → downgrade to next tier
- Sustained low FPS (<15 FPS for 10 seconds) → downgrade to next tier
- Memory warnings (3+ in 60 seconds) → downgrade to next tier
- Manual user selection (settings panel)

**Downgrade Flow:**
```
Tier A (WebGL2 + animations)
    ↓ (context loss or low FPS)
Tier B (WebGL2 static)
    ↓ (context loss or low FPS)
Tier C (Canvas2D fallback)
    ↓ (complete failure)
Error screen with reload option
```

**User Notification:**
```tsx
// components/map/TierDowngradeNotification.tsx

export function TierDowngradeNotification({
  previousTier,
  currentTier
}: {
  previousTier: GPUTier;
  currentTier: GPUTier;
}) {
  return (
    <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50
                    bg-blue-500 text-white px-4 py-3 rounded-md shadow-lg max-w-lg">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Rendering Mode Changed</strong>
          <p className="text-sm mt-1">
            Switched to {getTierLabel(currentTier)} to improve stability.
            Some visual features may be disabled.
          </p>
          <button
            onClick={() => localStorage.removeItem('ricer:gpu-tier')}
            className="text-sm underline mt-2"
          >
            Reset to auto-detection
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## Implementation Notes

### Integration Points

1. **App Initialization (apps/web/src/app/layout.tsx):**
   ```typescript
   // Detect GPU capabilities on mount
   const [gpuCapabilities, setGPUCapabilities] = useState<GPUCapabilities | null>(null);

   useEffect(() => {
     detectGPUCapabilities().then(setGPUCapabilities);
   }, []);
   ```

2. **Map Component (apps/web/src/components/map/RicerMap.tsx):**
   ```typescript
   // Get layer config based on tier
   const layerConfig = useMemo(() => {
     return getLayerConfigForTier(gpuCapabilities.tier);
   }, [gpuCapabilities]);

   // Create layers based on tier
   const deckLayers = useMemo(() => {
     if (!layerConfig.useDeckGL) return [];
     return createLayersForTier(gpuCapabilities.tier, layerConfig, data, layerVisibility);
   }, [gpuCapabilities, layerConfig, data, layerVisibility]);
   ```

3. **Context Monitoring (attach to MapLibre canvas):**
   ```typescript
   useEffect(() => {
     const map = mapRef.current?.getMap();
     if (!map) return;

     const canvas = map.getCanvas();
     const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
     if (!gl) return;

     const monitor = new WebGLContextMonitor(canvas, gl, {
       onContextLost: () => {
         // Pause rendering, show notification
       },
       onContextRestored: () => {
         // Resume rendering
       },
     });

     return () => monitor.destroy();
   }, [mapRef]);
   ```

4. **Settings Panel (user override):**
   ```tsx
   // components/settings/GPUSettings.tsx
   <select
     value={localStorage.getItem('ricer:gpu-tier') || 'auto'}
     onChange={(e) => {
       if (e.target.value === 'auto') {
         localStorage.removeItem('ricer:gpu-tier');
       } else {
         localStorage.setItem('ricer:gpu-tier', e.target.value);
       }
       window.location.reload();
     }}
   >
     <option value="auto">Auto-detect</option>
     <option value="tier-a">High Performance (WebGL2 + animations)</option>
     <option value="tier-b">Standard (WebGL2 static)</option>
     <option value="tier-c">Compatibility (Canvas2D)</option>
   </select>
   ```

### Performance Budgets

| Tier   | Target FPS | Acceptable FPS | Max Layers | Max Data Points | VRAM Budget |
|--------|------------|----------------|------------|-----------------|-------------|
| Tier A | 60         | 45+            | 50         | 10,000/layer    | 512MB+      |
| Tier B | 30         | 20+            | 30         | 5,000/layer     | 256MB+      |
| Tier C | 15         | 10+            | 10         | 1,000/layer     | 128MB+      |

### Testing Strategy

1. **Unit Tests:**
   ```typescript
   // lib/gpu/__tests__/detection.test.ts
   describe('detectGPUCapabilities', () => {
     it('should detect WebGL2 as Tier A', async () => {
       const capabilities = await detectGPUCapabilities();
       expect(capabilities.tier).toBe('tier-a');
       expect(capabilities.renderer).toBe('webgl2');
     });

     it('should respect user override', async () => {
       localStorage.setItem('ricer:gpu-tier', 'tier-c');
       const capabilities = await detectGPUCapabilities();
       expect(capabilities.tier).toBe('tier-c');
     });
   });
   ```

2. **Integration Tests:**
   ```typescript
   // tests/integration/gpu-tiering.test.ts
   describe('GPU Tier Integration', () => {
     it('should render deck.gl layers in Tier A', () => {
       // Mock WebGL2 context
       // Render map
       // Assert deck.gl layers present
     });

     it('should use MapLibre fallback layers in Tier C', () => {
       // Force Tier C
       // Render map
       // Assert MapLibre native layers present
       // Assert no deck.gl layers
     });
   });
   ```

3. **E2E Tests (Playwright):**
   ```typescript
   // tests/e2e/gpu-tiers.spec.ts
   test('should display tier notification when downgraded', async ({ page }) => {
     // Simulate context loss
     await page.evaluate(() => {
       const canvas = document.querySelector('canvas');
       const ext = canvas.getContext('webgl').getExtension('WEBGL_lose_context');
       ext.loseContext();
     });

     // Assert notification displayed
     await expect(page.locator('text=Map rendering paused')).toBeVisible();
   });
   ```

4. **Manual Testing Checklist:**
   - [ ] Test Tier A on modern desktop (Chrome, Firefox, Safari)
   - [ ] Test Tier B on older device (WebGL2 disabled)
   - [ ] Test Tier C fallback (force via localStorage)
   - [ ] Simulate context loss (WEBGL_lose_context extension)
   - [ ] Test recovery after context restored
   - [ ] Test downgrade on low FPS (throttle CPU in DevTools)
   - [ ] Test user override in settings panel
   - [ ] Test URL parameter override (?gpu-tier=tier-b)
   - [ ] Test mobile Safari (iOS 15+)
   - [ ] Test Chrome Android
   - [ ] Verify telemetry logging (Sentry events)

### Monitoring & Telemetry

Track GPU tier distribution and failure rates:

```typescript
// lib/observability/gpu-telemetry.ts

export function logGPUTierSelection(capabilities: GPUCapabilities) {
  logger.info('gpu_tier_selected', {
    tier: capabilities.tier,
    renderer: capabilities.renderer,
    vendor: capabilities.vendor,
    maxTextureSize: capabilities.maxTextureSize,
    userAgent: navigator.userAgent,
    deviceMemory: (navigator as any).deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
  });
}

export function logContextLoss(event: {
  tier: GPUTier;
  renderer: string;
  timestamp: number;
}) {
  logger.error('webgl_context_loss', event);

  // Increment counter in Sentry
  Sentry.captureMessage('WebGL context lost', {
    level: 'error',
    tags: { tier: event.tier, renderer: event.renderer },
  });
}

export function logTierDowngrade(event: {
  previousTier: GPUTier;
  currentTier: GPUTier;
  reason: string;
}) {
  logger.warn('gpu_tier_downgrade', event);
}
```

**Dashboards to Monitor:**
- Tier distribution (Tier A/B/C percentages)
- Context loss rate (events per 1000 sessions)
- Tier downgrade rate
- Average FPS by tier
- Memory warnings by tier
- Browser/device breakdown by tier

---

## Future Considerations (V2+)

### WebGPU Support (Tier A+)

When deck.gl v9+ WebGPU support matures and browser support increases:

1. **Add Tier A+ (WebGPU):**
   - Requires deck.gl v9+
   - Detection: `navigator.gpu.requestAdapter()`
   - Benefits: 3x performance, compute shaders, render bundles
   - Use cases: Animated heatmaps, particle effects, real-time fire spread simulation

2. **Migration Path:**
   ```typescript
   // Future Tier A+ detection
   if (navigator.gpu) {
     const adapter = await navigator.gpu.requestAdapter();
     if (adapter) {
       // Check deck.gl WebGPU layer support
       if (deckGLSupportsWebGPU(requiredLayers)) {
         return { tier: 'tier-a-plus', renderer: 'webgpu' };
       }
     }
   }
   ```

3. **Feature Ideas:**
   - Animated fire spread visualization (compute shaders)
   - Real-time smoke simulation
   - Advanced heatmap effects (temporal interpolation)
   - GPU-accelerated clustering

### Performance Optimization Ideas

- **Web Workers:** Offload data processing (GeoJSON parsing, clustering)
- **Binary Data:** Pre-compute attributes server-side, send as typed arrays
- **Level of Detail (LOD):** Reduce detail at lower zoom levels
- **Spatial Indexing:** R-tree for efficient viewport queries
- **Texture Atlases:** Combine icons into single texture for IconLayer
- **InstancingExtension:** Reduce draw calls for repeated geometries

### Accessibility

- **User Preference:** Respect `prefers-reduced-motion` for animations
- **High Contrast Mode:** Adjust colors for visibility
- **Keyboard Navigation:** Allow tier selection via keyboard
- **Screen Reader:** Announce tier changes and failures

---

## Appendix: Known Issues & Workarounds

### Issue 1: Safari WebGL Context Loss on Tab Switch

**Symptom:** Safari iOS/macOS loses WebGL context when tab is backgrounded for >30 seconds.

**Workaround:**
- Implement aggressive context restoration
- Store map state in sessionStorage
- Reload map on tab focus if context lost

### Issue 2: Intel Integrated GPU Performance

**Symptom:** Intel HD 4000-5500 GPUs perform poorly with WebGL2.

**Workaround:**
- Detect Intel GPU via `gl.getParameter(gl.RENDERER)`
- Force Tier B (WebGL1) for Intel HD <= 5500
- Add to quality gate in `meetsWebGL2TierARequirements()`

### Issue 3: Firefox Context Loss on Driver Update

**Symptom:** Firefox loses context when GPU driver is updated (Windows).

**Workaround:**
- Display persistent notification: "GPU driver updated. Please reload page."
- Auto-reload after 5 seconds if context not restored

### Issue 4: Chrome Memory Leak with Large Datasets

**Symptom:** Chrome 1GB memory cap reached with >50k markers.

**Workaround:**
- Implement data limits per tier (see Feature Toggle Matrix)
- Use clustering to reduce marker count
- Lazy-load data by viewport

---

## References

- [MDN: GPU Interface](https://developer.mozilla.org/en-US/docs/Web/API/GPU)
- [MDN: WebGLRenderingContext](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext)
- [deck.gl Performance Guide](https://deck.gl/docs/developer-guide/performance)
- [deck.gl WebGPU Support](https://deck.gl/docs/developer-guide/webgpu)
- [Khronos: Handling Context Lost](https://wikis.khronos.org/webgl/HandlingContextLost)
- [WebGL2 Fundamentals](https://webgl2fundamentals.org/webgl/lessons/webgl1-to-webgl2.html)
- [luma.gl Feature Detection](https://tsherif.github.io/luma.gl/docs/api-reference/webgl/context/has-features.html)
- [Chrome WebGPU Blog](https://developer.chrome.com/blog/webgpu-io2023)
- [WebGPU Implementation Status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status)

---

**Document Revision History:**
- v1.0 (2026-02-12): Initial release for V1 dispatch system
