'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date' | 'textarea';
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  fields: FormField[];
  initialValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  showMapPicker?: boolean;
  onPickOnMap?: () => void;
  pickOnMapLabel?: string;
  saveLabel: string;
  cancelLabel: string;
  savingLabel: string;
}

export function ResourceFormDialog({
  open,
  onClose,
  title,
  fields,
  initialValues,
  onSubmit,
  showMapPicker,
  onPickOnMap,
  pickOnMapLabel,
  saveLabel,
  cancelLabel,
  savingLabel,
}: Props) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setValues(initialValues || {});
      setErrors({});
    }
  }, [open, initialValues]);

  const handleChange = (name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};
    for (const f of fields) {
      if (f.required && !values[f.name]) {
        newErrors[f.name] = `${f.label} is required`;
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(values);
      onClose();
    } catch (e: unknown) {
      setErrors({ _form: e instanceof Error ? e.message : 'Something went wrong' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-xl border border-border bg-surface pb-[env(safe-area-inset-bottom)] shadow-elev-3 sm:max-w-lg sm:rounded-xl sm:pb-0">
        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex justify-center sm:hidden" aria-hidden="true">
            <span className="h-1 w-10 rounded-full bg-muted-foreground/25" />
          </div>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={cancelLabel}
            >
              <Icon name="close" size={20} aria-hidden />
            </button>
          </div>

          {errors._form && (
            <div className="text-sm text-danger-foreground bg-danger-muted p-3 rounded-lg">
              {errors._form}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((field) => (
              <div
                key={field.name}
                className={field.type === 'textarea' ? 'md:col-span-2' : ''}
              >
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  {field.label} {field.required && <span className="text-danger-foreground">*</span>}
                </label>

                {field.type === 'select' ? (
                  <select
                    className="w-full px-3 py-2 border border-input bg-surface text-foreground rounded-lg text-sm"
                    value={(values[field.name] as string) ?? ''}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                  >
                    <option value="">—</option>
                    {field.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea
                    className="w-full px-3 py-2 border border-input bg-surface text-foreground rounded-lg text-sm"
                    rows={3}
                    placeholder={field.placeholder}
                    value={(values[field.name] as string) ?? ''}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                  />
                ) : field.type === 'date' ? (
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-input bg-surface text-foreground rounded-lg text-sm"
                    value={
                      values[field.name]
                        ? new Date(values[field.name] as string).toISOString().slice(0, 10)
                        : ''
                    }
                    onChange={(e) =>
                      handleChange(field.name, e.target.value || undefined)
                    }
                  />
                ) : (
                  <input
                    type={field.type}
                    className="w-full px-3 py-2 border border-input bg-surface text-foreground rounded-lg text-sm"
                    placeholder={field.placeholder}
                    value={(values[field.name] as string | number) ?? ''}
                    onChange={(e) =>
                      handleChange(
                        field.name,
                        field.type === 'number'
                          ? parseFloat(e.target.value) || ''
                          : e.target.value,
                      )
                    }
                  />
                )}

                {errors[field.name] && (
                  <p className="text-xs text-danger-foreground mt-1">{errors[field.name]}</p>
                )}
              </div>
            ))}
          </div>

          {showMapPicker && onPickOnMap && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                onPickOnMap();
                onClose();
              }}
            >
              <Icon name="mapPin" size={16} aria-hidden /> {pickOnMapLabel}
            </Button>
          )}

          <div className="grid grid-cols-2 gap-2 border-t border-border/40 pt-4 sm:flex sm:justify-end">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              {cancelLabel}
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? savingLabel : saveLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
