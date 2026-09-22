import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { RightDrawer } from '@/components/shell/RightDrawer';

describe('RightDrawer', () => {
  it('renders as a dialog with an accessible name', async () => {
    const onOpenChange = vi.fn();
    const { container } = render(
      <RightDrawer title="Incident Details" open={true} onOpenChange={onOpenChange}>
        <div>Content</div>
      </RightDrawer>
    );

    expect(screen.getByRole('dialog', { name: 'Incident Details' })).toBeInTheDocument();
    const results = await axe(container);
    expect(results.violations.length).toBe(0);
  });

  it('closes when clicking the overlay', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { container } = render(
      <RightDrawer title="Incident Details" open={true} onOpenChange={onOpenChange}>
        <div>Content</div>
      </RightDrawer>
    );

    const overlay = container.querySelector('[data-testid="right-drawer-overlay"]');
    if (!overlay) throw new Error('Overlay not found');
    await user.click(overlay);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
