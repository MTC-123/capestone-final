'use client';

import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

interface AccordionProps {
  children: ReactNode;
  defaultValue?: string[];
  className?: string;
}

export function Accordion({ children, defaultValue, className }: AccordionProps) {
  return (
    <AccordionPrimitive.Root
      type="multiple"
      defaultValue={defaultValue}
      className={cn('space-y-3', className)}
    >
      {children}
    </AccordionPrimitive.Root>
  );
}

interface AccordionItemProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function AccordionItem({ value, children, className }: AccordionItemProps) {
  return (
    <AccordionPrimitive.Item value={value} className={className}>
      {children}
    </AccordionPrimitive.Item>
  );
}

interface AccordionTriggerProps {
  children: ReactNode;
  className?: string;
}

export function AccordionTrigger({ children, className }: AccordionTriggerProps) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          'flex w-full items-center justify-between text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70 px-0.5 hover:text-muted-foreground transition-colors group',
          className
        )}
      >
        <span>{children}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="transition-transform duration-200 group-data-[state=open]:rotate-0 -rotate-90"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

interface AccordionContentProps {
  children: ReactNode;
  className?: string;
}

export function AccordionContent({ children, className }: AccordionContentProps) {
  return (
    <AccordionPrimitive.Content
      className={cn(
        'overflow-hidden transition-all data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up',
        className
      )}
    >
      <div className="pt-1.5">{children}</div>
    </AccordionPrimitive.Content>
  );
}
