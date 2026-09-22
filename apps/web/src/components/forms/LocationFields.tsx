'use client';

import { TextField } from '@/components/ui/TextField';

export interface LocationValues {
  dpeflcd: string;
  ccdrf: string;
  secteur: string;
  foret: string;
  canton: string;
  lieudit: string;
}

export const emptyLocationValues: LocationValues = {
  dpeflcd: '',
  ccdrf: '',
  secteur: '',
  foret: '',
  canton: '',
  lieudit: '',
};

interface LocationFieldsProps {
  values: LocationValues;
  onChange: (field: keyof LocationValues, value: string) => void;
  defaultValues?: Partial<LocationValues>;
  disabled?: boolean;
}

const fields: { key: keyof LocationValues; label: string }[] = [
  { key: 'dpeflcd', label: 'DPEFLCD' },
  { key: 'ccdrf', label: 'CCDRF' },
  { key: 'secteur', label: 'Secteur' },
  { key: 'foret', label: 'Forêt' },
  { key: 'canton', label: 'Canton' },
  { key: 'lieudit', label: 'Lieudit' },
];

export function LocationFields({ values, onChange, disabled }: LocationFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.map(({ key, label }) => (
        <TextField
          key={key}
          id={`location-${key}`}
          label={label}
          value={values[key]}
          onChange={(e) => onChange(key, e.target.value)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
