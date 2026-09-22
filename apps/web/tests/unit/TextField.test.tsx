import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { TextField } from '@/components/ui/TextField';

describe('TextField', () => {
  // ── label association ───────────────────────────────────────────────────

  it('associates the label with the input via htmlFor / id', () => {
    render(<TextField id="email" label="Email" />);
    const label = screen.getByText('Email');
    const input = screen.getByRole('textbox');
    expect(label.getAttribute('for')).toBe('email');
    expect(input.getAttribute('id')).toBe('email');
  });

  // ── required asterisk ───────────────────────────────────────────────────

  it('renders a required asterisk when required={true}', () => {
    render(<TextField id="name" label="Name" required />);
    // The asterisk is inside a <span> sibling to the label text
    const label = screen.getByText('Name', { exact: false });
    const asterisk = label.querySelector('span');
    expect(asterisk).toBeInTheDocument();
    expect(asterisk?.textContent).toBe('*');
  });

  it('does not render an asterisk when required is not set', () => {
    render(<TextField id="name" label="Name" />);
    const label = screen.getByText('Name');
    expect(label.querySelector('span')).toBeNull();
  });

  // ── error text ──────────────────────────────────────────────────────────

  it('renders error text in a role="alert" element', () => {
    render(<TextField id="email" label="Email" errorText="Invalid email" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Invalid email');
  });

  it('sets aria-invalid on the input when errorText is provided', () => {
    render(<TextField id="email" label="Email" errorText="Bad" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not set aria-invalid when there is no error', () => {
    render(<TextField id="email" label="Email" />);
    const input = screen.getByRole('textbox');
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  // ── helper text ─────────────────────────────────────────────────────────

  it('renders helper text and links it via aria-describedby', () => {
    render(<TextField id="pw" label="Password" helperText="Min 8 chars" />);
    expect(screen.getByText('Min 8 chars')).toBeInTheDocument();

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-describedby', 'pw-help');
  });

  // ── both error + helper ─────────────────────────────────────────────────

  it('includes both error and helper IDs in aria-describedby', () => {
    render(
      <TextField id="field" label="Field" errorText="Err" helperText="Help" />
    );
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-describedby', 'field-error field-help');
  });

  // ── accessibility ───────────────────────────────────────────────────────

  it('passes axe in the default state', async () => {
    const { container } = render(<TextField id="def" label="Default" />);
    const results = await axe(container);
    expect(results.violations.length).toBe(0);
  });

  it('passes axe in the error state', async () => {
    const { container } = render(
      <TextField id="err" label="With Error" errorText="Something went wrong" />
    );
    const results = await axe(container);
    expect(results.violations.length).toBe(0);
  });

  it('passes axe in the disabled state', async () => {
    const { container } = render(
      <TextField id="dis" label="Disabled" disabled />
    );
    const results = await axe(container);
    expect(results.violations.length).toBe(0);
  });

  // ── user interaction ────────────────────────────────────────────────────

  it('allows the user to type and updates the input value', async () => {
    const user = userEvent.setup();
    render(<TextField id="search" label="Search" />);
    const input = screen.getByRole('textbox');

    await user.type(input, 'hello');
    expect(input).toHaveValue('hello');
  });
});
