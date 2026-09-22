'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FormWizard, type WizardStep } from '@/components/forms/FormWizard';
import { LocationFields, type LocationValues, emptyLocationValues } from '@/components/forms/LocationFields';
import { DynamicTable, type ColumnDef } from '@/components/forms/DynamicTable';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/Accordion';
import { TextField } from '@/components/ui/TextField';
import { SelectField } from '@/components/ui/SelectField';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

// ——————————————————————————————————————————
// Types
// ——————————————————————————————————————————

type AuditType = 'general' | 'vpi';

interface GeneralItem {
  category: string;
  name: string;
  quantiteEngagee: number | '';
  quantiteRendue: number | '';
  quantitePerdue: number | '';
  fonctionnel: string; // 'oui' | 'non' | ''
  aEntretenir: boolean;
  aRemplacer: boolean;
}

interface VpiItem {
  category: string;
  name: string;
  quantiteNecessaire: number | '';
  quantitePresente: number | '';
  fonctionnel: string; // 'oui' | 'non' | ''
  quantiteAEntretenir: number | '';
}

interface FormState {
  auditType: AuditType | '';
  vpiMatricule: string;
  location: LocationValues;
  generalItems: GeneralItem[];
  vpiItems: VpiItem[];
  signedBy: string;
  signedByRole: string;
  donateur: string;
  recepteur: string;
}

interface EquipmentAuditFormProps {
  fireRecordId: string;
  defaultLocation?: Partial<LocationValues>;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// ——————————————————————————————————————————
// Default equipment catalogs
// ——————————————————————————————————————————

const GENERAL_CATEGORIES: { category: string; items: string[] }[] = [
  {
    category: 'Matériels de lutte',
    items: [
      'Batte à feu', 'Pompe dorsale flexible 18L', 'Hache', 'Hachette',
      'Pelle', 'Tronçonneuse', 'Débroussailleuse', 'Pioche', 'Torche',
    ],
  },
  {
    category: 'Matériels de sécurité personnelle',
    items: [
      'Casques de sécurité', 'Paires de bottes en cuir type forestier',
      'Paires de gants type forestier', 'Tenues de protection', 'Masques à gaz',
    ],
  },
  {
    category: 'Autres',
    items: [
      'Motopompe', 'Tentes', 'Table pliante', 'Lits de champ', 'Chaises',
      'Groupe électrogène', "Citerne d'eau potable", 'Sacs à dos', 'Gourdes',
      'Sacs de couchage',
    ],
  },
];

const VPI_CATEGORIES: { category: string; items: string[] }[] = [
  {
    category: 'Outillage du véhicule',
    items: [
      'Clé de barrage', 'Commande sacoche', 'Cric avec levier', 'Démonte roues',
      'Division 45/2*25mm', 'Echelle', 'Echelle à crochets de 4m', 'Grande pince',
      'Grappin', 'Haut-parleur', 'Poste Radio E/R VHF', 'Roue de secours', 'Treuil',
    ],
  },
  {
    category: 'Matériel de protection et de lutte',
    items: [
      'Batte à feu', 'Casque de sécurité', 'Extincteur de 9 kg', 'Hache',
      'Hachette', 'Pelle', 'Pioche', 'Pompe dorsale flexible 18L',
    ],
  },
  {
    category: "Circuit d'utilisation d'eau",
    items: [
      'Crépine avec filtre', 'Crépine Viper (CE)', 'Lance de 25mm (CE)',
      'Lance HUGJET de 25mm (CE)', 'Lance HUGJET de 45mm (CE)',
    ],
  },
];

function buildDefaultGeneralItems(): GeneralItem[] {
  return GENERAL_CATEGORIES.flatMap(({ category, items }) =>
    items.map((name) => ({
      category,
      name,
      quantiteEngagee: '' as const,
      quantiteRendue: '' as const,
      quantitePerdue: '' as const,
      fonctionnel: '',
      aEntretenir: false,
      aRemplacer: false,
    }))
  );
}

function buildDefaultVpiItems(): VpiItem[] {
  return VPI_CATEGORIES.flatMap(({ category, items }) =>
    items.map((name) => ({
      category,
      name,
      quantiteNecessaire: '' as const,
      quantitePresente: '' as const,
      fonctionnel: '',
      quantiteAEntretenir: '' as const,
    }))
  );
}

const STORAGE_KEY = 'ricer-equipment-audit-draft';

function loadDraft(): Partial<FormState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<FormState>;
  } catch {
    return null;
  }
}

function saveDraft(state: FormState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota exceeded — ignore
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ——————————————————————————————————————————
// Columns
// ——————————————————————————————————————————

const GENERAL_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Désignation', type: 'text' },
  { key: 'quantiteEngagee', label: 'Engagé', type: 'number' },
  { key: 'quantiteRendue', label: 'Rendu', type: 'number' },
  { key: 'quantitePerdue', label: 'Perdu', type: 'number' },
  { key: 'fonctionnel', label: 'Fonctionnel', type: 'select', options: [{ value: 'oui', label: 'Oui' }, { value: 'non', label: 'Non' }] },
  { key: 'aEntretenir', label: 'À entretenir', type: 'select', options: [{ value: 'true', label: 'Oui' }, { value: 'false', label: 'Non' }] },
  { key: 'aRemplacer', label: 'À remplacer', type: 'select', options: [{ value: 'true', label: 'Oui' }, { value: 'false', label: 'Non' }] },
];

const VPI_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Désignation', type: 'text' },
  { key: 'quantiteNecessaire', label: 'Qté nécessaire', type: 'number' },
  { key: 'quantitePresente', label: 'Qté présente', type: 'number' },
  { key: 'fonctionnel', label: 'Fonctionnel', type: 'select', options: [{ value: 'oui', label: 'Oui' }, { value: 'non', label: 'Non' }] },
  { key: 'quantiteAEntretenir', label: 'Qté à entretenir', type: 'number' },
];

const ROLE_OPTIONS = [
  { value: '', label: '— Sélectionner —' },
  { value: 'Chef de secteur', label: 'Chef de secteur' },
  { value: 'CCDRF', label: 'CCDRF' },
  { value: 'Chauffeur VPI', label: 'Chauffeur VPI' },
  { value: 'Autre', label: 'Autre' },
];

// ——————————————————————————————————————————
// Component
// ——————————————————————————————————————————

export function EquipmentAuditForm({
  fireRecordId,
  defaultLocation,
  onSuccess,
  onCancel,
}: EquipmentAuditFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(() => {
    const draft = loadDraft();
    return {
      auditType: (draft?.auditType as AuditType) || '',
      vpiMatricule: draft?.vpiMatricule ?? '',
      location: {
        ...emptyLocationValues,
        ...defaultLocation,
        ...(draft?.location ?? {}),
      },
      generalItems: draft?.generalItems ?? buildDefaultGeneralItems(),
      vpiItems: draft?.vpiItems ?? buildDefaultVpiItems(),
      signedBy: draft?.signedBy ?? '',
      signedByRole: draft?.signedByRole ?? '',
      donateur: draft?.donateur ?? '',
      recepteur: draft?.recepteur ?? '',
    };
  });

  // Auto-save every 30s
  const formRef = useRef(form);
  formRef.current = form;

  useEffect(() => {
    const interval = setInterval(() => {
      saveDraft(formRef.current);
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Helpers
  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateGeneralItem = useCallback((index: number, key: string, value: string | number) => {
    setForm((prev) => {
      const items = [...prev.generalItems];
      items[index] = { ...items[index], [key]: value };
      return { ...prev, generalItems: items };
    });
  }, []);

  const updateVpiItem = useCallback((index: number, key: string, value: string | number) => {
    setForm((prev) => {
      const items = [...prev.vpiItems];
      items[index] = { ...items[index], [key]: value };
      return { ...prev, vpiItems: items };
    });
  }, []);

  // ——————————————————————————————————————————
  // Step 1 — Audit Type
  // ——————————————————————————————————————————

  const step1 = (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Sélectionnez le type d&apos;audit à effectuer.
      </p>

      <div className="flex flex-col gap-3">
        <label
          aria-label="Inventaire général du matériel (Annexe 2)"
          className={cn(
            'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition',
            form.auditType === 'general'
              ? 'border-primary bg-primary/5'
              : 'border-input hover:border-muted-foreground'
          )}
        >
          <input
            type="radio"
            name="auditType"
            value="general"
            checked={form.auditType === 'general'}
            onChange={() => updateField('auditType', 'general')}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <div>
            <div className="text-sm font-semibold text-foreground">
              Inventaire général du matériel (Annexe 2)
            </div>
            <div className="text-xs text-muted-foreground">
              Vérification post-incendie de tout le matériel engagé, rendu et perdu.
            </div>
          </div>
        </label>

        <label
          aria-label="Évaluation VPI (Annexe 5)"
          className={cn(
            'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition',
            form.auditType === 'vpi'
              ? 'border-primary bg-primary/5'
              : 'border-input hover:border-muted-foreground'
          )}
        >
          <input
            type="radio"
            name="auditType"
            value="vpi"
            checked={form.auditType === 'vpi'}
            onChange={() => updateField('auditType', 'vpi')}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <div>
            <div className="text-sm font-semibold text-foreground">
              Évaluation VPI (Annexe 5)
            </div>
            <div className="text-xs text-muted-foreground">
              Inventaire de l&apos;équipement d&apos;un véhicule de première intervention spécifique.
            </div>
          </div>
        </label>
      </div>

      {form.auditType === 'vpi' && (
        <TextField
          id="vpiMatricule"
          label="Matricule du VPI"
          value={form.vpiMatricule}
          onChange={(e) => updateField('vpiMatricule', e.target.value)}
          required
        />
      )}
    </div>
  );

  // ——————————————————————————————————————————
  // Step 2 — Location
  // ——————————————————————————————————————————

  const step2 = (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Localisation de l&apos;intervention.
      </p>
      <LocationFields
        values={form.location}
        onChange={(field, value) =>
          updateField('location', { ...form.location, [field]: value })
        }
      />
    </div>
  );

  // ——————————————————————————————————————————
  // Step 3 — Equipment Checklist
  // ——————————————————————————————————————————

  const isGeneral = form.auditType === 'general';
  const categories = isGeneral ? GENERAL_CATEGORIES : VPI_CATEGORIES;
  const items = isGeneral ? form.generalItems : form.vpiItems;
  const columns = isGeneral ? GENERAL_COLUMNS : VPI_COLUMNS;

  const step3 = (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {isGeneral
          ? 'Inventaire du matériel engagé lors de l\'intervention.'
          : 'Inventaire de l\'équipement du VPI.'}
      </p>

      <Accordion defaultValue={categories.map((c) => c.category)}>
        {categories.map(({ category }) => {
          const categoryItems = items.filter((it) => it.category === category);
          const startIndex = items.findIndex((it) => it.category === category);

          return (
            <AccordionItem key={category} value={category} className="rounded-lg border border-input">
              <div className="px-3 py-2">
                <AccordionTrigger className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                  {category} ({categoryItems.length})
                </AccordionTrigger>
              </div>
              <AccordionContent className="px-3 pb-3">
                <DynamicTable
                  columns={columns}
                  rows={categoryItems as unknown as Record<string, string | number>[]}
                  onChange={(rowIdx, key, value) => {
                    const globalIdx = startIndex + rowIdx;
                    if (isGeneral) {
                      updateGeneralItem(globalIdx, key, value);
                    } else {
                      updateVpiItem(globalIdx, key, value);
                    }
                  }}
                  onAddRow={() => {
                    if (isGeneral) {
                      setForm((prev) => ({
                        ...prev,
                        generalItems: [
                          ...prev.generalItems,
                          {
                            category,
                            name: '',
                            quantiteEngagee: '',
                            quantiteRendue: '',
                            quantitePerdue: '',
                            fonctionnel: '',
                            aEntretenir: false,
                            aRemplacer: false,
                          },
                        ],
                      }));
                    } else {
                      setForm((prev) => ({
                        ...prev,
                        vpiItems: [
                          ...prev.vpiItems,
                          {
                            category,
                            name: '',
                            quantiteNecessaire: '',
                            quantitePresente: '',
                            fonctionnel: '',
                            quantiteAEntretenir: '',
                          },
                        ],
                      }));
                    }
                  }}
                  onRemoveRow={(rowIdx) => {
                    const globalIdx = startIndex + rowIdx;
                    if (isGeneral) {
                      setForm((prev) => ({
                        ...prev,
                        generalItems: prev.generalItems.filter((_, i) => i !== globalIdx),
                      }));
                    } else {
                      setForm((prev) => ({
                        ...prev,
                        vpiItems: prev.vpiItems.filter((_, i) => i !== globalIdx),
                      }));
                    }
                  }}
                  addLabel="Ajouter un article"
                />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );

  // ——————————————————————————————————————————
  // Step 4 — Signatures
  // ——————————————————————————————————————————

  const step4 = (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Informations du signataire et transfert éventuel de matériel.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          id="signedBy"
          label="Signé par"
          value={form.signedBy}
          onChange={(e) => updateField('signedBy', e.target.value)}
        />
        <SelectField
          id="signedByRole"
          label="Fonction"
          options={ROLE_OPTIONS}
          value={form.signedByRole}
          onChange={(e) => updateField('signedByRole', e.target.value)}
        />
      </div>

      <div className="border-t border-input pt-4">
        <p className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Transfert de matériel (optionnel)
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            id="donateur"
            label="Donateur"
            value={form.donateur}
            onChange={(e) => updateField('donateur', e.target.value)}
          />
          <TextField
            id="recepteur"
            label="Récepteur"
            value={form.recepteur}
            onChange={(e) => updateField('recepteur', e.target.value)}
          />
        </div>
      </div>
    </div>
  );

  // ——————————————————————————————————————————
  // Step 5 — Review
  // ——————————————————————————————————————————

  const activeItems = isGeneral
    ? form.generalItems.filter(
        (it) =>
          it.quantiteEngagee !== '' ||
          it.quantiteRendue !== '' ||
          it.quantitePerdue !== '' ||
          it.fonctionnel !== ''
      )
    : form.vpiItems.filter(
        (it) =>
          it.quantiteNecessaire !== '' ||
          it.quantitePresente !== '' ||
          it.fonctionnel !== ''
      );

  const step5 = (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Vérifiez les informations avant de soumettre.
      </p>

      {/* Summary cards */}
      <div className="rounded-lg border border-input bg-surface p-4 space-y-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            <span className="font-semibold text-muted-foreground">Type:</span>{' '}
            {form.auditType === 'general' ? 'Inventaire général (Annexe 2)' : 'Évaluation VPI (Annexe 5)'}
          </span>
          {form.auditType === 'vpi' && form.vpiMatricule && (
            <span>
              <span className="font-semibold text-muted-foreground">Matricule:</span>{' '}
              {form.vpiMatricule}
            </span>
          )}
        </div>

        {/* Location summary */}
        {Object.values(form.location).some(Boolean) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {form.location.dpeflcd && <span><span className="font-semibold text-muted-foreground">DPEFLCD:</span> {form.location.dpeflcd}</span>}
            {form.location.ccdrf && <span><span className="font-semibold text-muted-foreground">CCDRF:</span> {form.location.ccdrf}</span>}
            {form.location.foret && <span><span className="font-semibold text-muted-foreground">Forêt:</span> {form.location.foret}</span>}
            {form.location.secteur && <span><span className="font-semibold text-muted-foreground">Secteur:</span> {form.location.secteur}</span>}
            {form.location.canton && <span><span className="font-semibold text-muted-foreground">Canton:</span> {form.location.canton}</span>}
            {form.location.lieudit && <span><span className="font-semibold text-muted-foreground">Lieudit:</span> {form.location.lieudit}</span>}
          </div>
        )}

        {/* Signature */}
        {form.signedBy && (
          <div className="text-sm">
            <span className="font-semibold text-muted-foreground">Signé par:</span>{' '}
            {form.signedBy}
            {form.signedByRole && ` (${form.signedByRole})`}
          </div>
        )}
      </div>

      {/* Items summary */}
      <div className="rounded-lg border border-input bg-surface p-4">
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Articles renseignés ({activeItems.length})
        </h4>

        {activeItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun article renseigné.</p>
        ) : (
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-input text-left">
                  <th className="py-1 pr-2 font-semibold">Catégorie</th>
                  <th className="py-1 pr-2 font-semibold">Désignation</th>
                  {isGeneral ? (
                    <>
                      <th className="py-1 pr-2 font-semibold">Eng.</th>
                      <th className="py-1 pr-2 font-semibold">Rendu</th>
                      <th className="py-1 font-semibold">Perdu</th>
                    </>
                  ) : (
                    <>
                      <th className="py-1 pr-2 font-semibold">Néc.</th>
                      <th className="py-1 font-semibold">Prés.</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {activeItems.map((it, i) => (
                  <tr key={i} className="border-b border-input/50">
                    <td className="py-1 pr-2 text-muted-foreground">{it.category}</td>
                    <td className="py-1 pr-2">{it.name}</td>
                    {isGeneral ? (
                      <>
                        <td className="py-1 pr-2">{(it as GeneralItem).quantiteEngagee}</td>
                        <td className="py-1 pr-2">{(it as GeneralItem).quantiteRendue}</td>
                        <td className="py-1">{(it as GeneralItem).quantitePerdue}</td>
                      </>
                    ) : (
                      <>
                        <td className="py-1 pr-2">{(it as VpiItem).quantiteNecessaire}</td>
                        <td className="py-1">{(it as VpiItem).quantitePresente}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {submitError && (
        <div role="alert" className="text-sm font-semibold text-danger">
          {submitError}
        </div>
      )}
    </div>
  );

  // ——————————————————————————————————————————
  // Submit
  // ——————————————————————————————————————————

  async function handleSubmit() {
    setSubmitError(null);
    setIsSubmitting(true);

    const payload = {
      fireRecordId,
      auditType: form.auditType,
      vpiMatricule: form.auditType === 'vpi' ? form.vpiMatricule : undefined,
      ...form.location,
      items: isGeneral ? form.generalItems : form.vpiItems,
      signedBy: form.signedBy || undefined,
      signedByRole: form.signedByRole || undefined,
      donateur: form.donateur || undefined,
      recepteur: form.recepteur || undefined,
      status: 'draft',
    };

    try {
      const res = await fetch('/api/equipment-audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message ?? `Erreur ${res.status}`);
      }

      clearDraft();
      onSuccess?.();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erreur lors de la soumission.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // ——————————————————————————————————————————
  // Wizard steps
  // ——————————————————————————————————————————

  const steps: WizardStep[] = [
    {
      title: 'Type',
      component: step1,
      validate: () => {
        if (!form.auditType) return 'Veuillez sélectionner un type d\'audit.';
        if (form.auditType === 'vpi' && !form.vpiMatricule.trim()) {
          return 'Le matricule du VPI est requis.';
        }
        return true;
      },
    },
    {
      title: 'Localisation',
      component: step2,
    },
    {
      title: 'Équipement',
      component: step3,
      validate: () => {
        if (activeItems.length === 0) {
          return 'Veuillez renseigner au moins un article.';
        }
        return true;
      },
    },
    {
      title: 'Signatures',
      component: step4,
    },
    {
      title: 'Résumé',
      component: step5,
    },
  ];

  return (
    <div className="p-4 sm:p-6">
      <FormWizard
        steps={steps}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        submitLabel="Enregistrer l'audit"
      />

      {onCancel && (
        <div className="mt-4 border-t border-input pt-4 text-center">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting}>
            Annuler
          </Button>
        </div>
      )}
    </div>
  );
}
