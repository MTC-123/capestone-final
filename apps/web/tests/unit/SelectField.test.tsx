import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { SelectField } from '@/components/ui/SelectField';
import type { SelectFieldOption } from '@/components/ui/SelectField';

const OPTIONS: SelectFieldOption[] = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C', disabled: true },
];

describe('SelectField', () => {
  // ── options rendering ─────────────────────────────────────────────────

  it('renders all options as <option> elements', () => {
    render(<SelectField id="sel" label="Pick" options={OPTIONS} />);
    const select = screen.getByRole('combobox');
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent('Option A');
    expect(options[1]).toHaveTextContent('Option B');
    expect(options[2]).toHaveTextContent('Option C');
  });

  it('sets correct value attributes on each <option>', () => {
    render(<SelectField id="sel" label="Pick" options={OPTIONS} />);
    const select = screen.getByRole('combobox');
    const options = select.querySelectorAll('option');
    expect(options[0]).toHaveAttribute('value', 'a');
    expect(options[1]).toHaveAttribute('value', 'b');
    expect(options[2]).toHaveAttribute('value', 'c');
  });

  // ── disabled option ───────────────────────────────────────────────────

  it('sets the disabled attribute on the disabled option', () => {
    render(<SelectField id="sel" label="Pick" options={OPTIONS} />);
    const select = screen.getByRole('combobox');
    const options = select.querySelectorAll('option');
    expect(options[0]).not.toBeDisabled();
    expect(options[1]).not.toBeDisabled();
    expect(options[2]).toBeDisabled();
  });

  // ── label association ─────────────────────────────────────────────────

  it('associates the label with the select via htmlFor / id', () => {
    render(<SelectField id="dept" label="Department" options={OPTIONS} />);
    const label = screen.getByText('Department');
    const select = screen.getByRole('combobox');
    expect(label.getAttribute('for')).toBe('dept');
    expect(select.getAttribute('id')).toBe('dept');
  });

  // ── error text ────────────────────────────────────────────────────────

  it('renders error text in a role="alert" element', () => {
    render(
      <SelectField id="sel" label="Pick" options={OPTIONS} errorText="Required field" />
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Required field');
  });

  it('sets aria-invalid on the select when errorText is provided', () => {
    render(
      <SelectField id="sel" label="Pick" options={OPTIONS} errorText="Err" />
    );
    const select = screen.getByRole('combobox');
    expect(select).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not set aria-invalid when there is no error', () => {
    render(<SelectField id="sel" label="Pick" options={OPTIONS} />);
    const select = screen.getByRole('combobox');
    expect(select.getAttribute('aria-invalid')).toBeNull();
  });

  // ── helper text + aria-describedby ────────────────────────────────────

  it('links helper text via aria-describedby', () => {
    render(
      <SelectField id="sel" label="Pick" options={OPTIONS} helperText="Choose one" />
    );
    const select = screen.getByRole('combobox');
    expect(select).toHaveAttribute('aria-describedby', 'sel-help');
  });

  it('includes both error and helper IDs in aria-describedby', () => {
    render(
      <SelectField id="sel" label="Pick" options={OPTIONS} errorText="E" helperText="H" />
    );
    const select = screen.getByRole('combobox');
    expect(select).toHaveAttribute('aria-describedby', 'sel-error sel-help');
  });

  // ── accessibility ─────────────────────────────────────────────────────

  it('passes axe in the default state', async () => {
    const { container } = render(
      <SelectField id="a11y-default" label="Default" options={OPTIONS} />
    );
    const results = await axe(container);
    expect(results.violations.length).toBe(0);
  });

  it('passes axe in the error state', async () => {
    const { container } = render(
      <SelectField id="a11y-err" label="Error" options={OPTIONS} errorText="Pick one" />
    );
    const results = await axe(container);
    expect(results.violations.length).toBe(0);
  });
});
