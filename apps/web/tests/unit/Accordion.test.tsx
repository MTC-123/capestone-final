import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/Accordion';

function renderAccordion(defaultValue?: string[]) {
  return render(
    <Accordion defaultValue={defaultValue}>
      <AccordionItem value="item-1">
        <AccordionTrigger>Section One</AccordionTrigger>
        <AccordionContent>Content One</AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>Section Two</AccordionTrigger>
        <AccordionContent>Content Two</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

describe('Accordion', () => {
  it('renders trigger text', () => {
    renderAccordion();
    expect(screen.getByText('Section One')).toBeInTheDocument();
    expect(screen.getByText('Section Two')).toBeInTheDocument();
  });

  it('content is hidden by default when no defaultValue', () => {
    renderAccordion();
    expect(screen.queryByText('Content One')).not.toBeInTheDocument();
    expect(screen.queryByText('Content Two')).not.toBeInTheDocument();
  });

  it('shows content for defaultValue items', () => {
    renderAccordion(['item-1']);
    expect(screen.getByText('Content One')).toBeInTheDocument();
    expect(screen.queryByText('Content Two')).not.toBeInTheDocument();
  });

  it('allows multiple items open by default', () => {
    renderAccordion(['item-1', 'item-2']);
    expect(screen.getByText('Content One')).toBeInTheDocument();
    expect(screen.getByText('Content Two')).toBeInTheDocument();
  });

  it('opens content when trigger is clicked', async () => {
    const user = userEvent.setup();
    renderAccordion();
    await user.click(screen.getByText('Section One'));
    expect(screen.getByText('Content One')).toBeInTheDocument();
  });

  it('closes content when trigger is clicked again', async () => {
    const user = userEvent.setup();
    renderAccordion(['item-1']);
    expect(screen.getByText('Content One')).toBeInTheDocument();
    await user.click(screen.getByText('Section One'));
    expect(screen.queryByText('Content One')).not.toBeInTheDocument();
  });

  it('allows multiple sections open simultaneously', async () => {
    const user = userEvent.setup();
    renderAccordion();
    await user.click(screen.getByText('Section One'));
    await user.click(screen.getByText('Section Two'));
    expect(screen.getByText('Content One')).toBeInTheDocument();
    expect(screen.getByText('Content Two')).toBeInTheDocument();
  });

  it('renders triggers as buttons', () => {
    renderAccordion();
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('renders a chevron SVG inside each trigger', () => {
    const { container } = renderAccordion();
    const svgs = container.querySelectorAll('svg');
    expect(svgs).toHaveLength(2);
  });

  it('forwards className to the root', () => {
    const { container } = render(
      <Accordion className="my-accordion">
        <AccordionItem value="a">
          <AccordionTrigger>T</AccordionTrigger>
          <AccordionContent>C</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('my-accordion');
  });

  it('forwards className to AccordionItem', () => {
    const { container } = render(
      <Accordion>
        <AccordionItem value="a" className="custom-item">
          <AccordionTrigger>T</AccordionTrigger>
          <AccordionContent>C</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    const item = container.querySelector('.custom-item');
    expect(item).toBeInTheDocument();
  });

  it('forwards className to AccordionTrigger', () => {
    render(
      <Accordion>
        <AccordionItem value="a">
          <AccordionTrigger className="custom-trigger">T</AccordionTrigger>
          <AccordionContent>C</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    const button = screen.getByRole('button');
    expect(button.className).toContain('custom-trigger');
  });

  it('forwards className to AccordionContent', () => {
    const { container } = render(
      <Accordion defaultValue={['a']}>
        <AccordionItem value="a">
          <AccordionTrigger>T</AccordionTrigger>
          <AccordionContent className="custom-content">C</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    const content = container.querySelector('.custom-content');
    expect(content).toBeInTheDocument();
  });

  it('passes axe accessibility checks', async () => {
    const { container } = renderAccordion(['item-1']);
    const results = await axe(container);
    expect(results.violations.length).toBe(0);
  });

  it('is keyboard accessible', async () => {
    const user = userEvent.setup();
    renderAccordion();
    const firstTrigger = screen.getByText('Section One').closest('button') as HTMLElement;
    firstTrigger.focus();
    expect(firstTrigger).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByText('Content One')).toBeInTheDocument();
  });
});
