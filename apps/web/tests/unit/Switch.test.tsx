import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { Switch } from '@/components/ui/Switch';

describe('Switch', () => {
  const defaultProps = {
    checked: false,
    onCheckedChange: vi.fn(),
    label: 'Toggle feature',
  };

  it('renders as a button element', () => {
    render(<Switch {...defaultProps} />);
    const switchEl = screen.getByRole('switch');
    expect(switchEl).toBeInTheDocument();
  });

  it('has correct aria-label', () => {
    render(<Switch {...defaultProps} label="Dark mode" />);
    const switchEl = screen.getByRole('switch');
    expect(switchEl).toHaveAttribute('aria-label', 'Dark mode');
  });

  it('reflects checked=false state', () => {
    render(<Switch {...defaultProps} checked={false} />);
    const switchEl = screen.getByRole('switch');
    expect(switchEl).toHaveAttribute('aria-checked', 'false');
  });

  it('reflects checked=true state', () => {
    render(<Switch {...defaultProps} checked={true} />);
    const switchEl = screen.getByRole('switch');
    expect(switchEl).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onCheckedChange when clicked', async () => {
    const handler = vi.fn();
    const user = userEvent.setup();
    render(<Switch {...defaultProps} onCheckedChange={handler} />);
    const switchEl = screen.getByRole('switch');
    await user.click(switchEl);
    expect(handler).toHaveBeenCalledWith(true);
  });

  it('applies bg-primary class when checked', () => {
    const { container } = render(<Switch {...defaultProps} checked={true} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('bg-primary');
  });

  it('applies bg-muted class when unchecked', () => {
    const { container } = render(<Switch {...defaultProps} checked={false} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('bg-muted');
  });

  it('renders as disabled when disabled prop is true', () => {
    render(<Switch {...defaultProps} disabled={true} />);
    const switchEl = screen.getByRole('switch');
    expect(switchEl).toBeDisabled();
  });

  it('applies opacity-50 when disabled', () => {
    const { container } = render(<Switch {...defaultProps} disabled={true} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('opacity-50');
  });

  it('does not call onCheckedChange when disabled', async () => {
    const handler = vi.fn();
    const user = userEvent.setup();
    render(<Switch {...defaultProps} onCheckedChange={handler} disabled={true} />);
    const switchEl = screen.getByRole('switch');
    await user.click(switchEl);
    expect(handler).not.toHaveBeenCalled();
  });

  it('forwards additional className', () => {
    const { container } = render(<Switch {...defaultProps} className="my-custom" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('my-custom');
  });

  it('passes axe accessibility checks when unchecked', async () => {
    const { container } = render(<Switch {...defaultProps} />);
    const results = await axe(container);
    expect(results.violations.length).toBe(0);
  });

  it('passes axe accessibility checks when checked', async () => {
    const { container } = render(<Switch {...defaultProps} checked={true} />);
    const results = await axe(container);
    expect(results.violations.length).toBe(0);
  });

  it('passes axe accessibility checks when disabled', async () => {
    const { container } = render(<Switch {...defaultProps} disabled={true} />);
    const results = await axe(container);
    expect(results.violations.length).toBe(0);
  });

  it('is keyboard accessible via Space', async () => {
    const handler = vi.fn();
    const user = userEvent.setup();
    render(<Switch {...defaultProps} onCheckedChange={handler} />);
    const switchEl = screen.getByRole('switch');
    switchEl.focus();
    expect(switchEl).toHaveFocus();
    await user.keyboard(' ');
    expect(handler).toHaveBeenCalledWith(true);
  });
});
