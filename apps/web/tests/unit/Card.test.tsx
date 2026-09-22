import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { Card } from '@/components/ui/Card';

describe('Card', () => {
  it('renders children text', () => {
    render(<Card>Hello Card</Card>);
    expect(screen.getByText('Hello Card')).toBeInTheDocument();
  });

  it('renders as a div element', () => {
    const { container } = render(<Card>Test</Card>);
    expect(container.firstElementChild?.tagName).toBe('DIV');
  });

  it('applies default tone classes (shadow-elev-1)', () => {
    const { container } = render(<Card>Default</Card>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('shadow-elev-1');
  });

  it('applies elevated tone classes', () => {
    const { container } = render(<Card tone="elevated">Elevated</Card>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('shadow-elev-2');
    expect(el.className).toContain('hover:shadow-elev-3');
  });

  it('applies subtle tone classes', () => {
    const { container } = render(<Card tone="subtle">Subtle</Card>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('bg-surface/70');
    expect(el.className).toContain('shadow-sm');
  });

  it('has common base classes for all tones', () => {
    const { container } = render(<Card>Test</Card>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('rounded-lg');
    expect(el.className).toContain('border');
    expect(el.className).toContain('bg-surface');
    expect(el.className).toContain('text-foreground');
  });

  it('forwards additional className', () => {
    const { container } = render(<Card className="p-6 my-card">X</Card>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('p-6');
    expect(el.className).toContain('my-card');
  });

  it('forwards additional HTML attributes', () => {
    render(<Card data-testid="my-card" id="card-1">Content</Card>);
    const card = screen.getByTestId('my-card');
    expect(card).toHaveAttribute('id', 'card-1');
  });

  it('forwards onClick handler', async () => {
    const onClick = vi.fn();
    render(<Card onClick={onClick}>Clickable</Card>);
    screen.getByText('Clickable').click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders nested elements', () => {
    render(
      <Card>
        <h2>Title</h2>
        <p>Description</p>
      </Card>
    );
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('passes axe accessibility checks with default tone', async () => {
    const { container } = render(<Card>Accessible card</Card>);
    const results = await axe(container);
    expect(results.violations.length).toBe(0);
  });

  it('passes axe accessibility checks with elevated tone', async () => {
    const { container } = render(<Card tone="elevated">Elevated</Card>);
    const results = await axe(container);
    expect(results.violations.length).toBe(0);
  });

  it('passes axe accessibility checks with subtle tone', async () => {
    const { container } = render(<Card tone="subtle">Subtle</Card>);
    const results = await axe(container);
    expect(results.violations.length).toBe(0);
  });
});
