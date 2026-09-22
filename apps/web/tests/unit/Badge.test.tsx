import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { Badge } from '@/components/ui/Badge';

const TONES = ['neutral', 'primary', 'success', 'warning', 'danger'] as const;

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders as a <span> element', () => {
    const { container } = render(<Badge>Test</Badge>);
    expect(container.firstElementChild?.tagName).toBe('SPAN');
  });

  TONES.forEach((tone) => {
    it(`tone="${tone}" passes axe accessibility checks`, async () => {
      const { container } = render(<Badge tone={tone}>Status</Badge>);
      const results = await axe(container);
      expect(results.violations.length).toBe(0);
    });
  });

  it('applies the neutral tone class by default', () => {
    const { container } = render(<Badge>Default</Badge>);
    const span = container.firstElementChild as HTMLElement;
    expect(span.className).toContain('border-border');
    expect(span.className).toContain('bg-surface-2');
  });

  it('applies the primary tone class when tone="primary"', () => {
    const { container } = render(<Badge tone="primary">Primary</Badge>);
    const span = container.firstElementChild as HTMLElement;
    expect(span.className).toContain('bg-primary/10');
    expect(span.className).toContain('text-primary');
  });

  it('applies the success tone class when tone="success"', () => {
    const { container } = render(<Badge tone="success">Success</Badge>);
    const span = container.firstElementChild as HTMLElement;
    expect(span.className).toContain('text-success-foreground');
  });

  it('applies the warning tone class when tone="warning"', () => {
    const { container } = render(<Badge tone="warning">Warning</Badge>);
    const span = container.firstElementChild as HTMLElement;
    expect(span.className).toContain('text-warning-foreground');
  });

  it('applies the danger tone class when tone="danger"', () => {
    const { container } = render(<Badge tone="danger">Danger</Badge>);
    const span = container.firstElementChild as HTMLElement;
    expect(span.className).toContain('text-danger-foreground');
  });

  it('forwards additional className onto the span', () => {
    const { container } = render(<Badge className="my-custom">X</Badge>);
    const span = container.firstElementChild as HTMLElement;
    expect(span.className).toContain('my-custom');
  });
});
