import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ProgressBar } from '@/components/report/ProgressBar';
import { StepLocation } from '@/components/report/StepLocation';

// Mock dynamic imports / map components
vi.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    const MockLocationPicker = (props: { onLocationSelect?: (lat: number, lng: number) => void; selectedLocation?: { lat: number; lng: number } }) => (
      <div data-testid="location-picker">
        <button onClick={() => props.onLocationSelect?.(33.5, -5.1)}>Select location</button>
        {props.selectedLocation && <span>Location set</span>}
      </div>
    );
    MockLocationPicker.displayName = 'MockLocationPicker';
    return MockLocationPicker;
  },
}));

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    language: 'en',
  }),
}));

vi.mock('@/components/map/LocationPicker', () => ({
  __esModule: true,
  default: (props: { onLocationSelect?: (lat: number, lng: number) => void; selectedLocation?: { lat: number; lng: number } }) => (
    <div data-testid="location-picker">
      <button onClick={() => props.onLocationSelect?.(33.5, -5.1)}>Select location</button>
      {props.selectedLocation && <span>Location set</span>}
    </div>
  ),
}));

describe('ProgressBar', () => {
  it('renders all 3 steps', () => {
    render(<ProgressBar currentStep="location" />);
    expect(screen.getByText('1')).toBeInTheDocument();
    // Steps 2 and 3 should also be present
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('marks current step with aria-current', () => {
    render(<ProgressBar currentStep="details" />);
    const currentStep = document.querySelector('[aria-current="step"]');
    expect(currentStep).toBeInTheDocument();
  });

  it('shows checkmark for completed steps', () => {
    render(<ProgressBar currentStep="review" />);
    // First two steps should be completed (no "1" or "2" text, replaced by checkmarks)
    expect(screen.queryByText('1')).not.toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });
});

describe('StepLocation', () => {
  let onLocationSelect: ReturnType<typeof vi.fn>;
  let onNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onLocationSelect = vi.fn();
    onNext = vi.fn();
  });

  it('disables Next button when no location is selected', () => {
    render(<StepLocation location={null} onLocationSelect={onLocationSelect} onNext={onNext} />);
    const nextButton = screen.getByText('nextStep');
    expect(nextButton.closest('button')).toBeDisabled();
  });

  it('enables Next button when location is selected', () => {
    render(
      <StepLocation
        location={{ lat: 33.5, lng: -5.1 }}
        onLocationSelect={onLocationSelect}
        onNext={onNext}
      />
    );
    const nextButton = screen.getByText('nextStep');
    expect(nextButton.closest('button')).not.toBeDisabled();
  });

  it('calls onNext when Next is clicked with a location', async () => {
    const user = userEvent.setup();
    render(
      <StepLocation
        location={{ lat: 33.5, lng: -5.1 }}
        onLocationSelect={onLocationSelect}
        onNext={onNext}
      />
    );
    await user.click(screen.getByText('nextStep'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('shows coordinates when location is selected', () => {
    render(
      <StepLocation
        location={{ lat: 33.527500, lng: -5.105600 }}
        onLocationSelect={onLocationSelect}
        onNext={onNext}
      />
    );
    expect(screen.getByText(/33\.527500/)).toBeInTheDocument();
    expect(screen.getByText(/-5\.105600/)).toBeInTheDocument();
  });
});
