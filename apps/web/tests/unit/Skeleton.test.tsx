import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { SkeletonBox, SkeletonText, SkeletonCard } from '@/components/ui/Skeleton';

describe('SkeletonBox', () => {
  it('renders a div element', () => {
    const { container } = render(<SkeletonBox />);
    expect(container.firstElementChild?.tagName).toBe('DIV');
  });

  it('is hidden from screen readers with aria-hidden', () => {
    const { container } = render(<SkeletonBox />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies animate-pulse class', () => {
    const { container } = render(<SkeletonBox />);
    expect(container.firstElementChild).toHaveClass('animate-pulse');
  });

  it('applies rounded-lg and bg-muted classes', () => {
    const { container } = render(<SkeletonBox />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('rounded-lg');
    expect(el.className).toContain('bg-muted');
  });

  it('forwards additional className', () => {
    const { container } = render(<SkeletonBox className="h-12 w-32" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('h-12');
    expect(el.className).toContain('w-32');
  });

  it('passes axe accessibility checks', async () => {
    const { container } = render(<SkeletonBox />);
    const results = await axe(container);
    expect(results.violations.length).toBe(0);
  });
});

describe('SkeletonText', () => {
  it('renders a wrapper div with aria-hidden', () => {
    const { container } = render(<SkeletonText />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders 1 line by default', () => {
    const { container } = render(<SkeletonText />);
    const wrapper = container.firstElementChild as HTMLElement;
    const lines = wrapper.querySelectorAll('div');
    expect(lines).toHaveLength(1);
  });

  it('renders the correct number of lines', () => {
    const { container } = render(<SkeletonText lines={4} />);
    const wrapper = container.firstElementChild as HTMLElement;
    const lines = wrapper.querySelectorAll('div');
    expect(lines).toHaveLength(4);
  });

  it('applies w-3/4 to the last line when lines > 1', () => {
    const { container } = render(<SkeletonText lines={3} />);
    const wrapper = container.firstElementChild as HTMLElement;
    const lines = wrapper.querySelectorAll('div');
    const lastLine = lines[lines.length - 1] as HTMLElement;
    expect(lastLine.className).toContain('w-3/4');
  });

  it('does not apply w-3/4 when lines=1', () => {
    const { container } = render(<SkeletonText lines={1} />);
    const wrapper = container.firstElementChild as HTMLElement;
    const line = wrapper.querySelector('div') as HTMLElement;
    expect(line.className).not.toContain('w-3/4');
  });

  it('each line has animate-pulse class', () => {
    const { container } = render(<SkeletonText lines={2} />);
    const wrapper = container.firstElementChild as HTMLElement;
    const lines = wrapper.querySelectorAll('div');
    lines.forEach((line) => {
      expect(line).toHaveClass('animate-pulse');
    });
  });

  it('forwards additional className to wrapper', () => {
    const { container } = render(<SkeletonText className="my-custom" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('my-custom');
  });

  it('passes axe accessibility checks', async () => {
    const { container } = render(<SkeletonText lines={3} />);
    const results = await axe(container);
    expect(results.violations.length).toBe(0);
  });
});

describe('SkeletonCard', () => {
  it('renders a div with aria-hidden', () => {
    const { container } = render(<SkeletonCard />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies animate-pulse class', () => {
    const { container } = render(<SkeletonCard />);
    expect(container.firstElementChild).toHaveClass('animate-pulse');
  });

  it('applies rounded-xl and border classes', () => {
    const { container } = render(<SkeletonCard />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('rounded-xl');
    expect(el.className).toContain('border');
  });

  it('contains three child placeholder divs', () => {
    const { container } = render(<SkeletonCard />);
    const card = container.firstElementChild as HTMLElement;
    const placeholders = card.querySelectorAll(':scope > div');
    expect(placeholders).toHaveLength(3);
  });

  it('forwards additional className', () => {
    const { container } = render(<SkeletonCard className="w-64" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('w-64');
  });

  it('passes axe accessibility checks', async () => {
    const { container } = render(<SkeletonCard />);
    const results = await axe(container);
    expect(results.violations.length).toBe(0);
  });
});
