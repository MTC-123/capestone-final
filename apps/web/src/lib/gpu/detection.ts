/**
 * GPU Capability Detection
 *
 * Detects WebGL2/WebGL1 capabilities and assigns a performance tier.
 * Used for progressive enhancement in map rendering.
 *
 * Tier A: WebGL2 with animations (high performance)
 * Tier B: WebGL2 static (standard performance)
 * Tier C: Canvas2D fallback (compatibility)
 *
 * @see docs/perf/gpu-tiers.md for full strategy documentation
 */

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

interface WebGL2Capabilities {
  maxTextureSize: number;
  maxViewportDims: [number, number];
  extensions: string[];
  hasVertexArrayObjects: boolean;
  isWebGL2Core: boolean;
}

/**
 * Main entry point: Detects GPU capabilities and assigns a performance tier.
 *
 * PRODUCTION FIX: Now includes timeout protection and proper cleanup to prevent:
 * - Indefinite hangs blocking map boot
 * - Memory leaks from unreleased WebGL contexts
 * - Race conditions in async detection
 *
 * Detection waterfall:
 * 1. Check for user override (localStorage/URL param)
 * 2. Try WebGL2 (Tier A if meets quality gates)
 * 3. Try WebGL1 (Tier B)
 * 4. Fallback to Canvas2D (Tier C)
 *
 * @param timeoutMs - Maximum time to wait for detection (default 2000ms)
 * @returns GPUCapabilities object with tier and rendering context info
 */
export async function detectGPUCapabilities(timeoutMs = 2000): Promise<GPUCapabilities> {
  const fallback: GPUCapabilities = {
    tier: 'tier-c',
    renderer: 'canvas2d',
    contextLost: false,
    extensions: [],
    maxTextureSize: 4096,
    maxViewportDims: [4096, 4096],
  };

  try {
    // Race between detection and timeout
    const result = await Promise.race([
      _detectGPUCapabilitiesInternal(),
      new Promise<GPUCapabilities>((resolve) =>
        setTimeout(() => {
          console.warn('[GPU] Detection timeout, using fallback Tier C');
          resolve(fallback);
        }, timeoutMs)
      ),
    ]);
    return result;
  } catch (error) {
    console.error('[GPU] Detection failed', error);
    return fallback;
  }
}

/**
 * Internal GPU detection with proper cleanup
 * Extracted to separate function to enable timeout racing
 */
async function _detectGPUCapabilitiesInternal(): Promise<GPUCapabilities> {
  let canvas: HTMLCanvasElement | null = null;
  let gl2: WebGL2RenderingContext | null = null;
  let gl1: WebGLRenderingContext | null = null;

  try {
    // Check for user override first
    const override = getUserTierOverride();
    if (override) {
      return createCapabilitiesForTier(override);
    }

    // Check for previous crash flag
    if (sessionStorage.getItem('ricer:gpu-fallback') === 'true') {
      console.warn('[GPU] Previous crash detected, forcing Tier C');
      return createCapabilitiesForTier('tier-c');
    }

    // Attempt WebGL2
    canvas = document.createElement('canvas');
    gl2 = canvas.getContext('webgl2', {
      failIfMajorPerformanceCaveat: true, // Fail if software rendering
      antialias: false, // Disable for performance testing
    });

    if (gl2 && !gl2.isContextLost()) {
      const capabilities = extractWebGL2Capabilities(gl2);

      // Quality gates for Tier A
      if (meetsWebGL2TierARequirements(capabilities, gl2)) {
        const result = {
          tier: 'tier-a' as GPUTier,
          renderer: 'webgl2' as const,
          contextLost: false,
          extensions: gl2.getSupportedExtensions() || [],
          vendor: gl2.getParameter(gl2.RENDERER) as string,
          maxTextureSize: gl2.getParameter(gl2.MAX_TEXTURE_SIZE) as number,
          maxViewportDims: gl2.getParameter(gl2.MAX_VIEWPORT_DIMS) as [number, number],
        };

        // Clean up before returning
        cleanupWebGLContext(gl2, canvas);
        return result;
      }

      // WebGL2 available but doesn't meet Tier A requirements -> Tier B
      const result = {
        tier: 'tier-b' as GPUTier,
        renderer: 'webgl2' as const,
        contextLost: false,
        extensions: gl2.getSupportedExtensions() || [],
        vendor: gl2.getParameter(gl2.RENDERER) as string,
        maxTextureSize: gl2.getParameter(gl2.MAX_TEXTURE_SIZE) as number,
        maxViewportDims: gl2.getParameter(gl2.MAX_VIEWPORT_DIMS) as [number, number],
      };

      cleanupWebGLContext(gl2, canvas);
      return result;
    }

    // Attempt WebGL1
    gl1 = canvas.getContext('webgl', {
      failIfMajorPerformanceCaveat: true,
      antialias: false,
    });

    if (gl1 && !gl1.isContextLost()) {
      const result = {
        tier: 'tier-b' as GPUTier,
        renderer: 'webgl' as const,
        contextLost: false,
        extensions: gl1.getSupportedExtensions() || [],
        vendor: gl1.getParameter(gl1.RENDERER) as string,
        maxTextureSize: gl1.getParameter(gl1.MAX_TEXTURE_SIZE) as number,
        maxViewportDims: gl1.getParameter(gl1.MAX_VIEWPORT_DIMS) as [number, number],
      };

      cleanupWebGLContext(gl1, canvas);
      return result;
    }

    // Fallback to Tier C
    console.warn('[GPU] WebGL unavailable, falling back to Tier C');
    return {
      tier: 'tier-c',
      renderer: 'canvas2d',
      contextLost: false,
      extensions: [],
      maxTextureSize: 4096, // Conservative estimate
      maxViewportDims: [4096, 4096],
    };
  } finally {
    // Ensure cleanup happens even if errors occur
    if (gl2) cleanupWebGLContext(gl2, canvas);
    if (gl1) cleanupWebGLContext(gl1, canvas);
    if (canvas && !gl2 && !gl1) cleanupCanvas(canvas);
  }
}

/**
 * Properly clean up WebGL context and canvas to prevent memory leaks
 * @param gl - WebGL context to clean up
 * @param canvas - Canvas element to clean up
 */
function cleanupWebGLContext(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  canvas: HTMLCanvasElement | null
): void {
  try {
    // Force context loss to release GPU resources
    const loseContext = gl.getExtension('WEBGL_lose_context');
    if (loseContext) {
      loseContext.loseContext();
    }
  } catch (error) {
    console.debug('[GPU] Context cleanup warning:', error);
  }

  // Clean up canvas
  if (canvas) {
    cleanupCanvas(canvas);
  }
}

/**
 * Clean up canvas element
 * @param canvas - Canvas to clean up
 */
function cleanupCanvas(canvas: HTMLCanvasElement): void {
  try {
    canvas.width = 0;
    canvas.height = 0;
    // Remove from DOM if attached (shouldn't be, but safety check)
    canvas.remove();
  } catch (error) {
    console.debug('[GPU] Canvas cleanup warning:', error);
  }
}

/**
 * Extracts WebGL2 capabilities for quality gate checks
 */
function extractWebGL2Capabilities(gl: WebGL2RenderingContext): WebGL2Capabilities {
  return {
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
    maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS) as [number, number],
    extensions: gl.getSupportedExtensions() || [],
    hasVertexArrayObjects: true, // WebGL2 core feature
    isWebGL2Core: true,
  };
}

/**
 * Quality gates for Tier A (WebGL2 with advanced features)
 *
 * Checks:
 * - Minimum texture size (4096 for high-res icons, heatmaps)
 * - Vertex Array Objects (WebGL2 core, but verify)
 * - Estimated VRAM (256MB minimum)
 * - Known problematic GPUs (Intel HD <= 5500)
 */
function meetsWebGL2TierARequirements(capabilities: WebGL2Capabilities, gl: WebGL2RenderingContext): boolean {
  // Minimum texture size
  if (capabilities.maxTextureSize < 4096) {
    console.debug('[GPU] Tier A rejected: maxTextureSize too small', capabilities.maxTextureSize);
    return false;
  }

  // VAO support (should always be true for WebGL2, but check anyway)
  if (!capabilities.hasVertexArrayObjects) {
    console.debug('[GPU] Tier A rejected: no VAO support');
    return false;
  }

  // Estimate available VRAM
  const estimatedVRAM = estimateAvailableVRAM();
  if (estimatedVRAM < 256) {
    console.debug('[GPU] Tier A rejected: insufficient VRAM', estimatedVRAM);
    return false;
  }

  // Check for known problematic GPUs (reuses existing GL context)
  if (isProblematicGPU(gl)) {
    console.debug('[GPU] Tier A rejected: known problematic GPU');
    return false;
  }

  return true;
}

/**
 * Estimates available VRAM (MB) based on device characteristics.
 * Heuristic-based: no direct API available.
 */
function estimateAvailableVRAM(): number {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  const hasHighPerformance = navigator.hardwareConcurrency >= 4;
  const deviceMemory = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4; // GB (Chrome/Edge only)

  if (isMobile) {
    // Mobile devices: conservative estimates
    return deviceMemory >= 6 ? 512 : 256;
  }

  // Desktop devices
  if (hasHighPerformance && deviceMemory >= 8) {
    return 1024; // Desktop with decent specs
  }

  return 512; // Default desktop estimate
}

/**
 * Checks for known problematic GPUs (force Tier B)
 * Examples: Intel HD 4000-5500, old Mali GPUs
 */
function isProblematicGPU(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  if (!debugInfo) return false;

  const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string;
  const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) as string;

  console.debug('[GPU] Detected:', { renderer, vendor });

  // Intel integrated GPUs (old generations)
  if (
    renderer.includes('Intel') &&
    (renderer.includes('HD 4000') ||
      renderer.includes('HD 5000') ||
      renderer.includes('HD 5500'))
  ) {
    return true;
  }

  // Old Mali GPUs (pre-2018)
  if (renderer.includes('Mali-4') || renderer.includes('Mali-T7')) {
    return true;
  }

  // Software rendering
  if (
    renderer.includes('SwiftShader') ||
    renderer.includes('llvmpipe') ||
    renderer.includes('Software')
  ) {
    return true;
  }

  return false;
}

/**
 * User override detection (localStorage or URL parameter)
 * Used for testing and accessibility.
 *
 * URL parameter: ?gpu-tier=tier-b
 * localStorage: localStorage.setItem('ricer:gpu-tier', 'tier-c')
 */
function getUserTierOverride(): GPUTier | null {
  // Check URL parameter first
  if (typeof window === 'undefined') return null;

  const urlParams = new URLSearchParams(window.location.search);
  const urlOverride = urlParams.get('gpu-tier') as GPUTier;
  if (urlOverride && ['tier-a', 'tier-b', 'tier-c'].includes(urlOverride)) {
    console.info('[GPU] Using URL tier override:', urlOverride);
    return urlOverride;
  }

  // Check localStorage
  const storageOverride = localStorage.getItem('ricer:gpu-tier') as GPUTier;
  if (storageOverride && ['tier-a', 'tier-b', 'tier-c'].includes(storageOverride)) {
    console.info('[GPU] Using localStorage tier override:', storageOverride);
    return storageOverride;
  }

  return null;
}

/**
 * Creates synthetic capabilities for a forced tier (user override)
 */
function createCapabilitiesForTier(tier: GPUTier): GPUCapabilities {
  switch (tier) {
    case 'tier-a':
      return {
        tier: 'tier-a',
        renderer: 'webgl2',
        contextLost: false,
        extensions: [],
        maxTextureSize: 8192,
        maxViewportDims: [8192, 8192],
      };

    case 'tier-b':
      return {
        tier: 'tier-b',
        renderer: 'webgl2',
        contextLost: false,
        extensions: [],
        maxTextureSize: 4096,
        maxViewportDims: [4096, 4096],
      };

    case 'tier-c':
      return {
        tier: 'tier-c',
        renderer: 'canvas2d',
        contextLost: false,
        extensions: [],
        maxTextureSize: 2048,
        maxViewportDims: [2048, 2048],
      };
  }
}

/**
 * Gets a human-readable label for a GPU tier
 */
export function getTierLabel(tier: GPUTier): string {
  switch (tier) {
    case 'tier-a':
      return 'High Performance';
    case 'tier-b':
      return 'Standard';
    case 'tier-c':
      return 'Compatibility Mode';
  }
}

/**
 * Gets a description of what's enabled/disabled in a tier
 */
export function getTierDescription(tier: GPUTier): string {
  switch (tier) {
    case 'tier-a':
      return 'Full features with animations and advanced rendering';
    case 'tier-b':
      return 'Standard features without animations';
    case 'tier-c':
      return 'Simplified rendering for compatibility';
  }
}
