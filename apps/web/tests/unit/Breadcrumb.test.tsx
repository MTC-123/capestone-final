import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import type { BreadcrumbItem } from '@/components/ui/Breadcrumb';

describe('Breadcrumb', () => {
  it('renders nothing when items array is empty', () => {
    const { container } = render(<Breadcrumb items={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders a nav element with aria-label', () => {
    render(<Breadcrumb items={[{ label: 'Home' }]} />);
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveAttribute('aria-label', 'Breadcrumb');
  });

  it('renders an ordered list', () => {
    render(<Breadcrumb items={[{ label: 'Home' }]} />);
    const list = screen.getByRole('list');
    expect(list.tagName).toBe('OL');
  });

  it('renders a single item as text (not a link)', () => {
    render(<Breadcrumb items={[{ label: 'Dashboard' }]} />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('marks the last item as current page', () => {
    render(<Breadcrumb items={[{ label: 'Home' }, { label: 'Settings' }]} />);
    const current = screen.getByText('Settings');
    expect(current).toHaveAttribute('aria-current', 'page');
  });

  it('renders the last item with font-medium class', () => {
    render(<Breadcrumb items={[{ label: 'Home' }, { label: 'Settings' }]} />);
    const current = screen.getByText('Settings');
    expect(current.className).toContain('font-medium');
  });

  it('does not set aria-current on non-last items', () => {
    render(
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Settings', href: '/settings' },
          { label: 'Profile' },
        ]}
      />
    );
    const home = screen.getByText('Home');
    expect(home).not.toHaveAttribute('aria-current');
  });

  it('renders intermediate items with href as links', () => {
    const items: BreadcrumbItem[] = [
      { label: 'Home', href: '/' },
      { label: 'Map', href: '/map' },
      { label: 'Details' },
    ];
    render(<Breadcrumb items={items} />);
    const homeLink = screen.getByText('Home').closest('a');
    expect(homeLink).toHaveAttribute('href', '/');
    const mapLink = screen.getByText('Map').closest('a');
    expect(mapLink).toHaveAttribute('href', '/map');
  });

  it('renders the last item as span even if href is provided', () => {
    const items: BreadcrumbItem[] = [
      { label: 'Home', href: '/' },
      { label: 'Current', href: '/current' },
    ];
    render(<Breadcrumb items={items} />);
    const current = screen.getByText('Current');
    expect(current.tagName).toBe('SPAN');
  });

  it('renders separator between items', () => {
    const items: BreadcrumbItem[] = [
      { label: 'A', href: '/' },
      { label: 'B', href: '/b' },
      { label: 'C' },
    ];
    const { container } = render(<Breadcrumb items={items} />);
    const separators = container.querySelectorAll('[aria-hidden="true"]');
    expect(separators).toHaveLength(2);
  });

  it('does not render separator before the first item', () => {
    render(<Breadcrumb items={[{ label: 'Only' }]} />);
    const { container } = render(<Breadcrumb items={[{ label: 'Only' }]} />);
    const separators = container.querySelectorAll('[aria-hidden="true"]');
    expect(separators).toHaveLength(0);
  });

  it('renders intermediate items without href as plain spans', () => {
    const items: BreadcrumbItem[] = [
      { label: 'No Link' },
      { label: 'Last' },
    ];
    render(<Breadcrumb items={items} />);
    const noLink = screen.getByText('No Link');
    expect(noLink.tagName).toBe('SPAN');
    expect(noLink.closest('a')).toBeNull();
  });

  it('handles many items', () => {
    const items: BreadcrumbItem[] = Array.from({ length: 5 }, (_, i) => ({
      label: `Level ${i}`,
      href: i < 4 ? `/level-${i}` : undefined,
    }));
    render(<Breadcrumb items={items} />);
    items.forEach((item) => {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    });
  });

  it('passes axe accessibility checks with single item', async () => {
    const { container } = render(<Breadcrumb items={[{ label: 'Home' }]} />);
    const results = await axe(container);
    expect(results.violations.length).toBe(0);
  });

  it('passes axe accessibility checks with multiple items', async () => {
    const items: BreadcrumbItem[] = [
      { label: 'Home', href: '/' },
      { label: 'Analytics', href: '/analytics' },
      { label: 'Report' },
    ];
    const { container } = render(<Breadcrumb items={items} />);
    const results = await axe(container);
    expect(results.violations.length).toBe(0);
  });
});
