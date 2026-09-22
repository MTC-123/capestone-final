import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('createWindArrowImage', () => {
  let createWindArrowImage: (size?: number) => ImageData;

  const mockGetImageData = vi.fn();
  const mockCtx = {
    fillStyle: '',
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    getImageData: mockGetImageData,
  };

  beforeEach(async () => {
    vi.restoreAllMocks();
    // Spy on createElement to return a mock canvas with 2d context
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'canvas') {
        return { width: 0, height: 0, getContext: () => mockCtx } as unknown as HTMLCanvasElement;
      }
      return document.createElement(tag);
    }) as typeof document.createElement);

    const mod = await import('@/lib/map/windArrow');
    createWindArrowImage = mod.createWindArrowImage;
  });

  it('returns ImageData with default 32x32 dimensions', () => {
    const fakeData = new Uint8ClampedArray(32 * 32 * 4);
    mockGetImageData.mockReturnValue({ data: fakeData, width: 32, height: 32 });

    const img = createWindArrowImage();
    expect(img.width).toBe(32);
    expect(img.height).toBe(32);
    expect(img.data.length).toBe(32 * 32 * 4);
  });

  it('returns ImageData with custom size', () => {
    const fakeData = new Uint8ClampedArray(64 * 64 * 4);
    mockGetImageData.mockReturnValue({ data: fakeData, width: 64, height: 64 });

    const img = createWindArrowImage(64);
    expect(img.width).toBe(64);
    expect(img.height).toBe(64);
  });

  it('calls canvas drawing methods to draw arrow shape', () => {
    const fakeData = new Uint8ClampedArray(32 * 32 * 4);
    mockGetImageData.mockReturnValue({ data: fakeData, width: 32, height: 32 });

    createWindArrowImage(32);

    expect(mockCtx.beginPath).toHaveBeenCalled();
    expect(mockCtx.moveTo).toHaveBeenCalled();
    expect(mockCtx.lineTo).toHaveBeenCalled();
    expect(mockCtx.closePath).toHaveBeenCalled();
    expect(mockCtx.fill).toHaveBeenCalled();
    expect(mockGetImageData).toHaveBeenCalledWith(0, 0, 32, 32);
  });
});
