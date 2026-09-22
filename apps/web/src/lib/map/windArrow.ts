/**
 * Creates an SDF-compatible arrow image for wind direction rendering.
 * The arrow points upward (north) — MapLibre rotates it via `icon-rotate`.
 * Used with `map.addImage('wind-arrow', img, { sdf: true })` so the
 * icon-color paint property can dynamically recolor the arrow.
 */
export function createWindArrowImage(size = 32): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const top = size * 0.12;
  const bottom = size * 0.85;
  const wingX = size * 0.3;

  // Draw arrow pointing up (white on transparent — SDF mode)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(cx, top);                    // tip
  ctx.lineTo(cx + wingX, bottom);         // right wing
  ctx.lineTo(cx, bottom - size * 0.18);   // notch
  ctx.lineTo(cx - wingX, bottom);         // left wing
  ctx.closePath();
  ctx.fill();

  return ctx.getImageData(0, 0, size, size);
}
