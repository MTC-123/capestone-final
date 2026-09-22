'use client';

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  type?: 'text' | 'number' | 'datetime-local' | 'textarea';
  placeholder?: string;
}

export function TextField({ label, value, onChange, disabled, type = 'text', placeholder }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {type === 'textarea' ? (
        <textarea
          className="rounded border border-border bg-surface px-2 py-1.5 text-sm disabled:opacity-50"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          rows={3}
        />
      ) : (
        <input
          type={type}
          className="rounded border border-border bg-surface px-2 py-1.5 text-sm disabled:opacity-50"
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
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <select
        className="rounded border border-border bg-surface px-2 py-1.5 text-sm disabled:opacity-50"
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
