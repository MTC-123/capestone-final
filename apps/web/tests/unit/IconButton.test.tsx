import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { IconButton } from '@/components/ui/IconButton';
import { Icon } from '@/components/ui/Icon';

describe('IconButton', () => {
  it('requires a label and passes basic a11y checks', async () => {
    const { container } = render(
      <IconButton label="Notifications">
        <Icon name="notifications" aria-hidden={true} />
      </IconButton>
    );

    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    const results = await axe(container);
    expect(results.violations.length).toBe(0);
  });
});
