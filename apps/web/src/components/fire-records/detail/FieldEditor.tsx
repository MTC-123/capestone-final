'use client';

import { cn } from '@/lib/cn';

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  type?: 'text' | 'number' | 'datetime-local' | 'textarea';
  placeholder?: string;
}

const fieldClasses =
  'w-full rounded-[10px] border border-input bg-surface px-3 text-[15px] text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 hover:border-foreground/25 focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:opacity-60 disabled:hover:border-input sm:text-sm';

export function TextField({ label, value, onChange, disabled, type = 'text', placeholder }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-foreground">{label}</label>
      {type === 'textarea' ? (
        <textarea
          className={cn(fieldClasses, 'min-h-[5.5rem] py-2')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          rows={3}
        />
      ) : (
        <input
          type={type}
          className={cn(fieldClasses, 'h-11')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
  disabled?: boolean;
}

export function SelectField({ label, value, options, onChange, disabled }: SelectFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-foreground">{label}</label>
      <select
        className={cn(fieldClasses, 'h-11')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
