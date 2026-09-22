import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { GlassPanel } from '@/components/ui/GlassPanel';

describe('GlassPanel', () => {
  it('renders children', () => {
    render(<GlassPanel>Panel content</GlassPanel>);
    expect(screen.getByText('Panel content')).toBeInTheDocument();
  });

  it('renders as a div with glass class', () => {
    const { container } = render(<GlassPanel>Test</GlassPanel>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('glass');
  });

  it('applies rounded-xl and shadow-glass classes', () => {
    const { container } = render(<GlassPanel>Test</GlassPanel>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('rounded-xl');
    expect(el.className).toContain('shadow-glass');
  });

  it('forwards additional className', () => {
    const { container } = render(<GlassPanel className="w-96">Test</GlassPanel>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('w-96');
  });

  it('does not render a title button when title is not provided', () => {
    render(<GlassPanel>No title</GlassPanel>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders a title when title prop is provided', () => {
    render(<GlassPanel title="Panel Title">Content</GlassPanel>);
    expect(screen.getByText('Panel Title')).toBeInTheDocument();
  });

  it('renders headerActions next to the title', () => {
    render(
      <GlassPanel title="Title" headerActions={<span data-testid="action">Act</span>}>
        Content
      </GlassPanel>
    );
    expect(screen.getByTestId('action')).toBeInTheDocument();
  });

  describe('non-collapsible', () => {
    it('does not set aria-expanded when not collapsible', () => {
      render(<GlassPanel title="Title">Content</GlassPanel>);
      const button = screen.getByRole('button');
      expect(button).not.toHaveAttribute('aria-expanded');
    });

    it('does not render a chevron when not collapsible', () => {
      const { container } = render(<GlassPanel title="Title">Content</GlassPanel>);
      const svg = container.querySelector('svg');
      expect(svg).not.toBeInTheDocument();
    });

    it('always shows content when not collapsible', () => {
      render(<GlassPanel title="Title">Visible content</GlassPanel>);
      expect(screen.getByText('Visible content')).toBeInTheDocument();
    });
  });

  describe('collapsible', () => {
    it('sets aria-expanded=true when not collapsed', () => {
      render(
        <GlassPanel title="Title" collapsible>
          Content
        </GlassPanel>
      );
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('sets aria-expanded=false when defaultCollapsed', () => {
      render(
        <GlassPanel title="Title" collapsible defaultCollapsed>
          Content
        </GlassPanel>
      );
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('renders a chevron SVG when collapsible', () => {
      const { container } = render(
        <GlassPanel title="Title" collapsible>
          Content
        </GlassPanel>
      );
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('shows content when expanded', () => {
      render(
        <GlassPanel title="Title" collapsible>
          Panel body
        </GlassPanel>
      );
      expect(screen.getByText('Panel body')).toBeInTheDocument();
    });

    it('hides content when defaultCollapsed', () => {
      render(
        <GlassPanel title="Title" collapsible defaultCollapsed>
          Hidden body
        </GlassPanel>
      );
      expect(screen.queryByText('Hidden body')).not.toBeInTheDocument();
    });

    it('toggles content visibility on click', async () => {
      const user = userEvent.setup();
      render(
        <GlassPanel title="Title" collapsible>
          Toggle me
        </GlassPanel>
      );
      expect(screen.getByText('Toggle me')).toBeInTheDocument();
      await user.click(screen.getByRole('button'));
      expect(screen.queryByText('Toggle me')).not.toBeInTheDocument();
    });

    it('expands collapsed panel on click', async () => {
      const user = userEvent.setup();
      render(
        <GlassPanel title="Title" collapsible defaultCollapsed>
          Expandable
        </GlassPanel>
      );
      expect(screen.queryByText('Expandable')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button'));
      expect(screen.getByText('Expandable')).toBeInTheDocument();
    });

    it('calls onCollapsedChange when toggled', async () => {
      const handler = vi.fn();
      const user = userEvent.setup();
      render(
        <GlassPanel title="Title" collapsible onCollapsedChange={handler}>
          Content
        </GlassPanel>
      );
      await user.click(screen.getByRole('button'));
      expect(handler).toHaveBeenCalledWith(true);
      await user.click(screen.getByRole('button'));
      expect(handler).toHaveBeenCalledWith(false);
    });
  });

  it('passes axe accessibility checks without title', async () => {
    const { container } = render(<GlassPanel>Content</GlassPanel>);
    const results = await axe(container);
    expect(results.violations.length).toBe(0);
  });

  it('passes axe accessibility checks with title', async () => {
    const { container } = render(<GlassPanel title="Title">Content</GlassPanel>);
    const results = await axe(container);
    expect(results.violations.length).toBe(0);
  });

  it('passes axe accessibility checks when collapsible', async () => {
    const { container } = render(
      <GlassPanel title="Title" collapsible>
        Content
      </GlassPanel>
    );
    const results = await axe(container);
    expect(results.violations.length).toBe(0);
  });
});
