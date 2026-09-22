import * as React from 'react';
import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Slider } from '@/components/ui/Slider';

// Radix Slider uses ResizeObserver internally
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

describe('Slider', () => {
  const defaultProps = {
    value: 50,
    onValueChange: vi.fn(),
    min: 0,
    max: 100,
    label: 'Volume',
  };

  it('renders a slider element', () => {
    render(<Slider {...defaultProps} />);
    const slider = screen.getByRole('slider');
    expect(slider).toBeInTheDocument();
  });

  it('passes aria-label to the root element', () => {
    const { container } = render(<Slider {...defaultProps} label="Brightness" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute('aria-label', 'Brightness');
  });

  it('reflects the current value via aria-valuenow', () => {
    render(<Slider {...defaultProps} value={75} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuenow', '75');
  });

  it('reflects min via aria-valuemin', () => {
    render(<Slider {...defaultProps} min={10} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuemin', '10');
  });

  it('reflects max via aria-valuemax', () => {
    render(<Slider {...defaultProps} max={200} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuemax', '200');
  });

  it('forwards additional className to the root', () => {
    const { container } = render(<Slider {...defaultProps} className="my-slider" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('my-slider');
  });

  it('renders track and range elements', () => {
    const { container } = render(<Slider {...defaultProps} />);
    const track = container.querySelector('[data-orientation]');
    expect(track).toBeInTheDocument();
  });

  it('renders a thumb (role=slider)', () => {
    render(<Slider {...defaultProps} />);
    const slider = screen.getByRole('slider');
    expect(slider).toBeInTheDocument();
  });

  it('root has horizontal orientation by default', () => {
    const { container } = render(<Slider {...defaultProps} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute('data-orientation', 'horizontal');
  });

  it('value at min boundary renders correctly', () => {
    render(<Slider {...defaultProps} value={0} min={0} max={100} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuenow', '0');
  });

  it('value at max boundary renders correctly', () => {
    render(<Slider {...defaultProps} value={100} min={0} max={100} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuenow', '100');
  });

  it('applies base layout classes to root', () => {
    const { container } = render(<Slider {...defaultProps} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('flex');
    expect(root.className).toContain('items-center');
  });

  it('thumb has rounded-full and border-primary classes', () => {
    render(<Slider {...defaultProps} />);
    const thumb = screen.getByRole('slider');
    expect(thumb.className).toContain('rounded-full');
    expect(thumb.className).toContain('border-primary');
  });
});
