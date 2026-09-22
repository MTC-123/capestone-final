'use client';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

export interface ColumnDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

interface DynamicTableProps {
  columns: ColumnDef[];
  rows: Record<string, string | number>[];
  onChange: (rowIndex: number, key: string, value: string | number) => void;
  onAddRow: () => void;
  onRemoveRow: (rowIndex: number) => void;
  disabled?: boolean;
  addLabel?: string;
}

function CellInput({
  col,
  value,
  onChange,
  disabled,
}: {
  col: ColumnDef;
  value: string | number;
  onChange: (value: string | number) => void;
  disabled?: boolean;
}) {
  const baseClass =
    'w-full rounded-md border border-input bg-surface px-2 py-1.5 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-ring';

  if (col.type === 'select') {
    return (
      <select
        className={baseClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">{col.placeholder ?? '—'}</option>
        {col.options?.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type={col.type}
      className={baseClass}
      value={value}
      placeholder={col.placeholder}
      onChange={(e) =>
        onChange(col.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)
      }
      disabled={disabled}
    />
  );
}

export function DynamicTable({
  columns,
  rows,
  onChange,
  onAddRow,
  onRemoveRow,
  disabled,
  addLabel = 'Ajouter une ligne',
}: DynamicTableProps) {
  return (
    <div className="space-y-3">
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-input">
              {columns.map((col) => (
                <th key={col.key} className="px-2 py-2 text-left font-semibold text-foreground">
                  {col.label}
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-input/50">
                {columns.map((col) => (
                  <td key={col.key} className="px-2 py-1.5">
                    <CellInput
                      col={col}
                      value={row[col.key] ?? ''}
                      onChange={(v) => onChange(ri, col.key, v)}
                      disabled={disabled}
                    />
                  </td>
                ))}
                <td className="px-1 py-1.5">
                  <button
                    type="button"
                    onClick={() => onRemoveRow(ri)}
                    disabled={disabled}
                    className={cn(
                      'rounded p-1 text-muted-foreground transition hover:bg-danger/10 hover:text-danger',
                      'disabled:pointer-events-none disabled:opacity-50'
                    )}
                    aria-label="Supprimer la ligne"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className="flex flex-col gap-3 sm:hidden">
        {rows.map((row, ri) => (
          <div key={ri} className="rounded-lg border border-input bg-surface p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">#{ri + 1}</span>
              <button
                type="button"
                onClick={() => onRemoveRow(ri)}
                disabled={disabled}
                className="rounded p-1 text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
                aria-label="Supprimer la ligne"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {columns.map((col) => (
              <div key={col.key} className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">{col.label}</label>
                <CellInput
                  col={col}
                  value={row[col.key] ?? ''}
                  onChange={(v) => onChange(ri, col.key, v)}
                  disabled={disabled}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      {rows.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">Aucune ligne ajoutée.</p>
      )}

      <Button type="button" variant="secondary" size="sm" onClick={onAddRow} disabled={disabled}>
        + {addLabel}
      </Button>
    </div>
  );
}
