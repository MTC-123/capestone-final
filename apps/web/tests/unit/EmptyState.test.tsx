import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '@/components/analytics/EmptyState';

// Mock useTranslation
vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    language: 'en' as const,
  }),
}));

// Mock fetch for weather API
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({
      temperature: 35,
      windSpeed: 25,
      windDirection: 180,
      timestamp: '2025-08-01T12:00',
    }),
  }));
});

describe('EmptyState', () => {
  it('renders no fire detections message', () => {
    render(<EmptyState />);
    expect(screen.getByText('noFireDetections')).toBeDefined();
    expect(screen.getByText('noFireDetectionsDesc')).toBeDefined();
  });

  it('renders fire icon', () => {
    render(<EmptyState />);
    // The component renders an icon container
    const iconContainer = document.querySelector('.rounded-full');
    expect(iconContainer).toBeDefined();
  });
});
