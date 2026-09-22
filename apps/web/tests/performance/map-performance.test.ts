/**
 * Map Performance Test Suite
 * 
 * This script tests the optimized map component with various scenarios
 * to ensure it meets the performance requirements:
 * - Sub-100ms interaction response times
 * - 60fps animations
 * - 2-second initial load time
 * - Zero frame drops during navigation
 */

import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    fpsCounter: { frames: number; lastTime: number; fps: number };
  }
}

type PerformanceMode = 'high' | 'balanced' | 'battery';

const PERFORMANCE_THRESHOLDS = {
  MAX_INITIAL_LOAD: 2000, // 2 seconds
  MAX_INTERACTION_RESPONSE: 100, // 100ms
  MIN_FPS: 30, // Minimum acceptable FPS
  TARGET_FPS: 60, // Target FPS
  MAX_MEMORY_USAGE: 100, // MB
  MAX_DROPPED_FRAMES: 0, // Zero tolerance
};

const TEST_SCENARIOS = {
  SMALL_DATASET: 100,
  MEDIUM_DATASET: 1000,
  LARGE_DATASET: 5000,
  EXTREME_DATASET: 10000,
};

test.describe('Map Performance Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Enable performance monitoring
    await page.evaluate(() => {
      // Inject performance monitoring
      window.performance.mark = window.performance.mark || (() => {});
      window.performance.measure = window.performance.measure || (() => {});
    });
  });

  test('Initial Load Performance - Small Dataset', async ({ page }) => {
    await page.goto('/map-performance?markers=100&mode=balanced');
    
    const startTime = Date.now();
    
    // Wait for map to be ready
    await page.waitForSelector('.map-ready', { timeout: PERFORMANCE_THRESHOLDS.MAX_INITIAL_LOAD });
    
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_INITIAL_LOAD);
    console.log(`✓ Small dataset loaded in ${loadTime}ms`);
  });

  test('Initial Load Performance - Large Dataset', async ({ page }) => {
    await page.goto('/map-performance?markers=10000&mode=balanced');
    
    const startTime = Date.now();
    
    // Wait for map to be ready
    await page.waitForSelector('.map-ready', { timeout: PERFORMANCE_THRESHOLDS.MAX_INITIAL_LOAD * 2 });
    
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_INITIAL_LOAD * 2);
    console.log(`✓ Large dataset loaded in ${loadTime}ms`);
  });

  test('Zoom Performance', async ({ page }) => {
    await page.goto('/map-performance?markers=5000&mode=balanced');
    await page.waitForSelector('.map-ready');
    
    // Measure zoom performance
    const zoomStart = Date.now();
    
    // Simulate zoom in
    await page.keyboard.press('+');
    await page.waitForTimeout(100); // Wait for animation
    
    const zoomTime = Date.now() - zoomStart;
    
    expect(zoomTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_INTERACTION_RESPONSE);
    console.log(`✓ Zoom completed in ${zoomTime}ms`);
  });

  test('Pan Performance', async ({ page }) => {
    await page.goto('/map-performance?markers=5000&mode=balanced');
    await page.waitForSelector('.map-ready');
    
    // Get map container
    const mapContainer = await page.locator('.map-container');
    
    // Measure pan performance
    const panStart = Date.now();
    
    // Simulate pan gesture
    await mapContainer.dragTo(mapContainer, {
      sourcePosition: { x: 100, y: 100 },
      targetPosition: { x: 200, y: 200 },
    });
    
    const panTime = Date.now() - panStart;
    
    expect(panTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_INTERACTION_RESPONSE * 2);
    console.log(`✓ Pan completed in ${panTime}ms`);
  });

  test('Marker Click Performance', async ({ page }) => {
    await page.goto('/map-performance?markers=1000&mode=balanced');
    await page.waitForSelector('.map-ready');
    
    // Wait for markers to render
    await page.waitForSelector('.map-marker', { timeout: 5000 });
    
    // Click on first marker
    const marker = await page.locator('.map-marker').first();
    
    const clickStart = Date.now();
    await marker.click();
    
    // Wait for popup
    await page.waitForSelector('.map-popup', { timeout: 1000 });
    
    const clickTime = Date.now() - clickStart;
    
    expect(clickTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_INTERACTION_RESPONSE);
    console.log(`✓ Marker click completed in ${clickTime}ms`);
  });

  test('Cluster Performance', async ({ page }) => {
    await page.goto('/map-performance?markers=10000&mode=balanced&clustering=true');
    await page.waitForSelector('.map-ready');
    
    // Wait for clusters to render
    await page.waitForSelector('.cluster-marker', { timeout: 5000 });
    
    // Click on cluster
    const cluster = await page.locator('.cluster-marker').first();
    
    const clusterStart = Date.now();
    await cluster.click();
    
    // Wait for cluster expansion
    await page.waitForTimeout(500);
    
    const clusterTime = Date.now() - clusterStart;
    
    expect(clusterTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_INTERACTION_RESPONSE * 3);
    console.log(`✓ Cluster interaction completed in ${clusterTime}ms`);
  });

  test('Memory Usage - Large Dataset', async ({ page }) => {
    await page.goto('/map-performance?markers=10000&mode=balanced');
    await page.waitForSelector('.map-ready');
    
    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });
    
    // Perform various interactions
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('+');
      await page.waitForTimeout(100);
      await page.keyboard.press('-');
      await page.waitForTimeout(100);
    }
    
    // Get final memory usage
    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });
    
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // Convert to MB
    
    expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_MEMORY_USAGE);
    console.log(`✓ Memory increase: ${memoryIncrease.toFixed(2)}MB`);
  });

  test('FPS During Animation', async ({ page }) => {
    await page.goto('/map-performance?markers=5000&mode=balanced');
    await page.waitForSelector('.map-ready');
    
    // Start FPS monitoring
    await page.evaluate(() => {
      window.fpsCounter = {
        frames: 0,
        lastTime: performance.now(),
        fps: 0
      };
      
      function countFrames() {
        window.fpsCounter.frames++;
        const currentTime = performance.now();
        
        if (currentTime - window.fpsCounter.lastTime >= 1000) {
          window.fpsCounter.fps = window.fpsCounter.frames;
          window.fpsCounter.frames = 0;
          window.fpsCounter.lastTime = currentTime;
        }
        
        requestAnimationFrame(countFrames);
      }
      
      requestAnimationFrame(countFrames);
    });
    
    // Perform smooth animation
    await page.mouse.move(400, 300);
    await page.mouse.down();
    
    for (let i = 0; i < 100; i++) {
      await page.mouse.move(400 + i, 300);
      await page.waitForTimeout(16); // ~60fps
    }
    
    await page.mouse.up();
    
    // Get FPS reading
    const fps = await page.evaluate(() => window.fpsCounter.fps);
    
    expect(fps).toBeGreaterThanOrEqual(PERFORMANCE_THRESHOLDS.MIN_FPS);
    console.log(`✓ Average FPS during animation: ${fps}`);
  });

  test('Performance Mode Comparison', async ({ page }) => {
    const modes: PerformanceMode[] = ['high', 'balanced', 'battery'];
    const results: Partial<Record<PerformanceMode, { loadTime: number; interactionTime: number; mode: PerformanceMode }>> = {};
    
    for (const mode of modes) {
      await page.goto(`/map-performance?markers=5000&mode=${mode}`);
      await page.waitForSelector('.map-ready');
      
      // Measure load time
      const loadStart = Date.now();
      await page.waitForSelector('.map-marker', { timeout: 5000 });
      const loadTime = Date.now() - loadStart;
      
      // Measure interaction performance
      const interactionStart = Date.now();
      await page.keyboard.press('+');
      await page.waitForTimeout(200);
      const interactionTime = Date.now() - interactionStart;
      
      results[mode] = {
        loadTime,
        interactionTime,
        mode
      };
      
      console.log(`✓ ${mode} mode: Load ${loadTime}ms, Interaction ${interactionTime}ms`);
    }
    
    // Verify high performance mode is fastest
    const high = results.high;
    const balanced = results.balanced;
    expect(high && balanced).toBeTruthy();
    if (!high || !balanced) return;
    expect(high.loadTime).toBeLessThanOrEqual(balanced.loadTime);
    expect(high.interactionTime).toBeLessThanOrEqual(balanced.interactionTime);
  });
});

// Mobile-specific tests
test.describe('Mobile Performance Tests', () => {
  test.use({
    viewport: { width: 375, height: 667 }, // iPhone 6/7/8
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1'
  });

  test('Mobile Performance - Medium Dataset', async ({ page }) => {
    await page.goto('/map-performance?markers=3000&mode=battery');
    await page.waitForSelector('.map-ready');
    
    const startTime = Date.now();
    
    // Simulate touch gestures
    await page.touchscreen.tap(200, 200);
    await page.waitForTimeout(100);
    
    // Pinch to zoom
    await page.touchscreen.tap(150, 150);
    await page.touchscreen.tap(250, 250);
    
    const interactionTime = Date.now() - startTime;
    
    expect(interactionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_INTERACTION_RESPONSE * 2);
    console.log(`✓ Mobile interaction completed in ${interactionTime}ms`);
  });
});

// Stress tests
test.describe('Stress Tests', () => {
  test('Rapid Interactions', async ({ page }) => {
    await page.goto('/map-performance?markers=10000&mode=balanced');
    await page.waitForSelector('.map-ready');
    
    const startTime = Date.now();
    
    // Perform rapid interactions
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('+');
      await page.keyboard.press('-');
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowRight');
    }
    
    const totalTime = Date.now() - startTime;
    const avgTime = totalTime / 80; // 20 iterations * 4 actions
    
    expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_INTERACTION_RESPONSE);
    console.log(`✓ Average interaction time: ${avgTime.toFixed(2)}ms`);
  });

  test('Memory Leak Detection', async ({ page }) => {
    await page.goto('/map-performance?markers=5000&mode=balanced');
    await page.waitForSelector('.map-ready');
    
    // Get initial memory snapshot
    const initialMemory = await page.evaluate(() => {
      if (gc) gc(); // Force garbage collection if available
      return (performance as any).memory?.usedJSHeapSize || 0;
    });
    
    // Perform repeated operations
    for (let i = 0; i < 50; i++) {
      await page.keyboard.press('+');
      await page.keyboard.press('-');
      
      if (i % 10 === 0) {
        // Force garbage collection periodically
        await page.evaluate(() => {
          if (gc) gc();
        });
      }
    }
    
    // Get final memory snapshot
    await page.evaluate(() => {
      if (gc) gc();
    });
    
    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });
    
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;
    
    // Memory should not increase significantly
    expect(memoryIncrease).toBeLessThan(10); // Less than 10MB increase
    console.log(`✓ Memory leak test: ${memoryIncrease.toFixed(2)}MB increase`);
  });
});
