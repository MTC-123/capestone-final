'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FormWizard, type WizardStep } from '@/components/forms/FormWizard';
import { DynamicTable, type ColumnDef } from '@/components/forms/DynamicTable';
import { OuiNonField } from '@/components/forms/OuiNonField';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

// ——————————————————————————————————————————
// Types
// ——————————————————————————————————————————

interface Participant {
  nom: string;
  poste: string;
}

interface DebriefingState {
  // Step 1
  date: string;
  superficieIncendiee: number | '';
  heureDeclenchement: string;
  typeEssence: string;
  // Step 2
  alertePrecoce: boolean | null;
  alertePrecoceDetail: string;
  premiereIntervention: string; // 'rapide' | 'lente' | ''
  premiereInterventionDetail: string;
  vegetationSecondaire: string; // 'faible' | 'moyenne' | 'dense' | ''
  topographie: string[];
  // Step 3
  pistesForestieres: boolean | null;
  pistesAmenagees: boolean | null;
  trancheesPF: boolean | null;
  trancheesPFAmenagees: boolean | null;
  pointsEau: boolean | null;
  pointsEauAccessible: boolean | null;
  pointsEauRempli: boolean | null;
  pointsEauUtilise: boolean | null;
  fonctionnaliteVPI: boolean | null;
  fonctionnaliteVPIDetail: string;
  // Step 4
  incidentLutte: string;
  quAvaitEtePlanifie: string;
  quEstCeQuiEstArrive: string;
  pourquoi: string;
  prochaineFois: string;
  observationsParticulieres: string;
  // Step 5
  animateurNom: string;
  animateurQualite: string;
  participants: Participant[];
}

interface DebriefingFormProps {
  fireRecordId: string;
  existingId?: string | null;
  defaultValues?: {
    superficieIncendiee?: number | null;
    heureDeclenchement?: string | null;
    typeEssence?: string | null;
  };
  readOnly?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// ——————————————————————————————————————————
// Constants
// ——————————————————————————————————————————

const TOPOGRAPHIE_OPTIONS = ['Crête', 'Bas-versant', 'Plaine', 'Versant', 'Dépression'];

const PARTICIPANT_COLUMNS: ColumnDef[] = [
  { key: 'nom', label: 'Nom et Prénom', type: 'text' },
  { key: 'poste', label: 'Poste', type: 'text' },
];

const STORAGE_KEY = 'ricer-debriefing-draft';

function emptyParticipants(): Participant[] {
  return Array.from({ length: 5 }, () => ({ nom: '', poste: '' }));
}

function buildInitialState(
  defaultValues?: DebriefingFormProps['defaultValues'],
): DebriefingState {
  return {
    date: new Date().toISOString().slice(0, 10),
    superficieIncendiee: defaultValues?.superficieIncendiee ?? '',
    heureDeclenchement: defaultValues?.heureDeclenchement ?? '',
    typeEssence: defaultValues?.typeEssence ?? '',
    alertePrecoce: null,
    alertePrecoceDetail: '',
    premiereIntervention: '',
    premiereInterventionDetail: '',
    vegetationSecondaire: '',
    topographie: [],
    pistesForestieres: null,
    pistesAmenagees: null,
    trancheesPF: null,
    trancheesPFAmenagees: null,
    pointsEau: null,
    pointsEauAccessible: null,
    pointsEauRempli: null,
    pointsEauUtilise: null,
    fonctionnaliteVPI: null,
    fonctionnaliteVPIDetail: '',
    incidentLutte: '',
    quAvaitEtePlanifie: '',
    quEstCeQuiEstArrive: '',
    pourquoi: '',
    prochaineFois: '',
    observationsParticulieres: '',
    animateurNom: '',
    animateurQualite: '',
    participants: emptyParticipants(),
  };
}

function loadDraft(): Partial<DebriefingState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<DebriefingState>;
  } catch {
    return null;
  }
}

function saveDraft(state: DebriefingState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* quota exceeded */ }
}

function clearDraft() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// ——————————————————————————————————————————
// Textarea helper (consistent styling)
// ——————————————————————————————————————————

function LabeledTextarea({
  id,
  label,
  subtitle,
  value,
  onChange,
  disabled,
  rows = 3,
}: {
  id: string;
  label: string;
  subtitle?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  rows?: number;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          'w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground outline-none transition',
          'placeholder:text-muted-foreground',
          'focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
          disabled && 'opacity-60',
        )}
      />
    </div>
  );
}

// ——————————————————————————————————————————
// Radio group helper
// ——————————————————————————————————————————

function RadioGroup({
  name,
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-semibold text-foreground">{label}</legend>
      <div className="flex flex-wrap items-center gap-4">
        {options.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-sm text-foreground">{opt.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// ——————————————————————————————————————————
// Checkbox group helper
// ——————————————————————————————————————————

function CheckboxGroup({
  label,
  options,
  values,
  onChange,
  disabled,
}: {
  label: string;
  options: string[];
  values: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-semibold text-foreground">{label}</legend>
      <div className="flex flex-wrap items-center gap-4">
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={values.includes(opt)}
              onChange={() => {
                onChange(
                  values.includes(opt)
                    ? values.filter((v) => v !== opt)
                    : [...values, opt],
                );
              }}
              className="h-4 w-4 accent-primary rounded"
            />
            <span className="text-sm text-foreground">{opt}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// ——————————————————————————————————————————
// Main Component
// ——————————————————————————————————————————

export function DebriefingForm({
  fireRecordId,
  existingId,
  defaultValues,
  readOnly = false,
  onSuccess,
  onCancel,
}: DebriefingFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState(!!existingId);

  const [form, setForm] = useState<DebriefingState>(() => {
    if (existingId) return buildInitialState(defaultValues);
    const draft = loadDraft();
    if (draft) return { ...buildInitialState(defaultValues), ...draft };
    return buildInitialState(defaultValues);
  });

  // Load existing debriefing data
  useEffect(() => {
    if (!existingId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/debriefings/${existingId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setForm({
          date: data.date ? new Date(data.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
          superficieIncendiee: data.superficieIncendiee ?? '',
          heureDeclenchement: data.heureDeclenchement ?? '',
          typeEssence: data.typeEssence ?? '',
          alertePrecoce: data.alertePrecoce ?? null,
          alertePrecoceDetail: data.alertePrecoceDetail ?? '',
          premiereIntervention: data.premiereIntervention ?? '',
          premiereInterventionDetail: data.premiereInterventionDetail ?? '',
          vegetationSecondaire: data.vegetationSecondaire ?? '',
          topographie: data.topographie ?? [],
          pistesForestieres: data.pistesForestieres ?? null,
          pistesAmenagees: data.pistesAmenagees ?? null,
          trancheesPF: data.trancheesPF ?? null,
          trancheesPFAmenagees: data.trancheesPFAmenagees ?? null,
          pointsEau: data.pointsEau ?? null,
          pointsEauAccessible: data.pointsEauAccessible ?? null,
          pointsEauRempli: data.pointsEauRempli ?? null,
          pointsEauUtilise: data.pointsEauUtilise ?? null,
          fonctionnaliteVPI: data.fonctionnaliteVPI ?? null,
          fonctionnaliteVPIDetail: data.fonctionnaliteVPIDetail ?? '',
          incidentLutte: data.incidentLutte ?? '',
          quAvaitEtePlanifie: data.quAvaitEtePlanifie ?? '',
          quEstCeQuiEstArrive: data.quEstCeQuiEstArrive ?? '',
          pourquoi: data.pourquoi ?? '',
          prochaineFois: data.prochaineFois ?? '',
          observationsParticulieres: data.observationsParticulieres ?? '',
          animateurNom: data.animateurNom ?? '',
          animateurQualite: data.animateurQualite ?? '',
          participants: Array.isArray(data.participants) && data.participants.length > 0
            ? data.participants
            : emptyParticipants(),
        });
      } finally {
        if (!cancelled) setIsLoadingExisting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [existingId]);

  // Auto-save every 30s (only for new debriefings)
  const formRef = useRef(form);
  formRef.current = form;
  useEffect(() => {
    if (existingId || readOnly) return;
    const interval = setInterval(() => saveDraft(formRef.current), 30_000);
    return () => clearInterval(interval);
  }, [existingId, readOnly]);

  const update = useCallback(<K extends keyof DebriefingState>(key: K, value: DebriefingState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  // ——————————————————————————————
  // Step 1 — Fire Info
  // ——————————————————————————————

  const step1 = (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Informations générales sur l&apos;incendie évalué.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          id="debrief-date"
          label="Date du débriefing"
          type="date"
          value={form.date}
          onChange={(e) => update('date', e.target.value)}
          disabled={readOnly}
        />
        <TextField
          id="debrief-superficie"
          label="Superficie incendiée (ha)"
          type="number"
          value={form.superficieIncendiee}
          onChange={(e) => update('superficieIncendiee', e.target.value === '' ? '' : Number(e.target.value))}
          disabled={readOnly}
        />
        <TextField
          id="debrief-heure"
          label="Heure de déclenchement"
          type="time"
          value={form.heureDeclenchement}
          onChange={(e) => update('heureDeclenchement', e.target.value)}
          disabled={readOnly}
        />
        <TextField
          id="debrief-essence"
          label="Type d'essence / peuplement"
          value={form.typeEssence}
          onChange={(e) => update('typeEssence', e.target.value)}
          disabled={readOnly}
        />
      </div>
    </div>
  );

  // ——————————————————————————————
  // Step 2 — Evaluation
  // ——————————————————————————————

  const step2 = (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">Évaluation de l&apos;alerte et des conditions.</p>

      <OuiNonField
        label="Alerte précoce"
        id="debrief-alerte-precoce"
        value={form.alertePrecoce}
        onChange={(v) => update('alertePrecoce', v)}
        withExplanation
        explanationValue={form.alertePrecoceDetail}
        onExplanationChange={(v) => update('alertePrecoceDetail', v)}
        explanationPlaceholder="Qui a donné l'alerte ?"
        disabled={readOnly}
      />

      <div className="space-y-2">
        <RadioGroup
          name="debrief-premiere-intervention"
          label="Première intervention"
          options={[
            { value: 'rapide', label: 'Rapide' },
            { value: 'lente', label: 'Lente' },
          ]}
          value={form.premiereIntervention}
          onChange={(v) => update('premiereIntervention', v)}
          disabled={readOnly}
        />
        {form.premiereIntervention && (
          <textarea
            className={cn(
              'w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground outline-none transition',
              'placeholder:text-muted-foreground focus:ring-2 focus:ring-ring',
              readOnly && 'opacity-60',
            )}
            rows={2}
            placeholder="Le premier arrivé sur les lieux ? La population participe ou non ?"
            value={form.premiereInterventionDetail}
            onChange={(e) => update('premiereInterventionDetail', e.target.value)}
            disabled={readOnly}
          />
        )}
      </div>

      <RadioGroup
        name="debrief-vegetation"
        label="Végétation secondaire"
        options={[
          { value: 'faible', label: 'Faible' },
          { value: 'moyenne', label: 'Moyennement développée' },
          { value: 'dense', label: 'Dense' },
        ]}
        value={form.vegetationSecondaire}
        onChange={(v) => update('vegetationSecondaire', v)}
        disabled={readOnly}
      />

      <CheckboxGroup
        label="Topographie"
        options={TOPOGRAPHIE_OPTIONS}
        values={form.topographie}
        onChange={(v) => update('topographie', v)}
        disabled={readOnly}
      />
    </div>
  );

  // ——————————————————————————————
  // Step 3 — Infrastructure
  // ——————————————————————————————

  const step3 = (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">État de l&apos;infrastructure forestière à proximité.</p>

      {/* Pistes forestières */}
      <OuiNonField
        label="Pistes forestières"
        id="debrief-pistes"
        value={form.pistesForestieres}
        onChange={(v) => update('pistesForestieres', v)}
        disabled={readOnly}
      />
      {form.pistesForestieres === true && (
        <div className="ml-6 border-l-2 border-primary/20 pl-4">
          <OuiNonField
            label="Aménagées"
            id="debrief-pistes-amenagees"
            value={form.pistesAmenagees}
            onChange={(v) => update('pistesAmenagees', v)}
            disabled={readOnly}
          />
        </div>
      )}

      {/* Tranchées pare-feu */}
      <OuiNonField
        label="Tranchées pare-feu"
        id="debrief-tranchees"
        value={form.trancheesPF}
        onChange={(v) => update('trancheesPF', v)}
        disabled={readOnly}
      />
      {form.trancheesPF === true && (
        <div className="ml-6 border-l-2 border-primary/20 pl-4">
          <OuiNonField
            label="Aménagées"
            id="debrief-tranchees-amenagees"
            value={form.trancheesPFAmenagees}
            onChange={(v) => update('trancheesPFAmenagees', v)}
            disabled={readOnly}
          />
        </div>
      )}

      {/* Points d'eau */}
      <OuiNonField
        label="Points d'eau à proximité"
        id="debrief-points-eau"
        value={form.pointsEau}
        onChange={(v) => update('pointsEau', v)}
        disabled={readOnly}
      />
      {form.pointsEau === true && (
        <div className="ml-6 space-y-3 border-l-2 border-primary/20 pl-4">
          <OuiNonField
            label="Accessible"
            id="debrief-points-eau-accessible"
            value={form.pointsEauAccessible}
            onChange={(v) => update('pointsEauAccessible', v)}
            disabled={readOnly}
          />
          <OuiNonField
            label="Rempli"
            id="debrief-points-eau-rempli"
            value={form.pointsEauRempli}
            onChange={(v) => update('pointsEauRempli', v)}
            disabled={readOnly}
          />
          <OuiNonField
            label="Utilisé"
            id="debrief-points-eau-utilise"
            value={form.pointsEauUtilise}
            onChange={(v) => update('pointsEauUtilise', v)}
            disabled={readOnly}
          />
        </div>
      )}

      {/* VPI */}
      <OuiNonField
        label="Fonctionnalité du VPI"
        id="debrief-vpi"
        value={form.fonctionnaliteVPI}
        onChange={(v) => update('fonctionnaliteVPI', v)}
        withExplanation
        explanationValue={form.fonctionnaliteVPIDetail}
        onExplanationChange={(v) => update('fonctionnaliteVPIDetail', v)}
        explanationPlaceholder="Soulever les problèmes rencontrés ? Propositions d'améliorations ?"
        disabled={readOnly}
      />
    </div>
  );

  // ——————————————————————————————
  // Step 4 — REX
  // ——————————————————————————————

  const step4 = (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">Retour d&apos;expérience structuré.</p>

      <LabeledTextarea
        id="debrief-incident-lutte"
        label="Incident au cours de la lutte"
        subtitle="Y a-t-il des imprévus ? des accidents ? des conflits ?"
        value={form.incidentLutte}
        onChange={(v) => update('incidentLutte', v)}
        disabled={readOnly}
      />

      <div className="border-t border-input pt-4 space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Questions REX
        </h4>

        <LabeledTextarea
          id="debrief-rex-planifie"
          label="Qu'est-ce qui avait été planifié ?"
          value={form.quAvaitEtePlanifie}
          onChange={(v) => update('quAvaitEtePlanifie', v)}
          disabled={readOnly}
        />
        <LabeledTextarea
          id="debrief-rex-arrive"
          label="Qu'est-ce qui est arrivé ?"
          value={form.quEstCeQuiEstArrive}
          onChange={(v) => update('quEstCeQuiEstArrive', v)}
          disabled={readOnly}
        />
        <LabeledTextarea
          id="debrief-rex-pourquoi"
          label="Pourquoi cela est arrivé ?"
          value={form.pourquoi}
          onChange={(v) => update('pourquoi', v)}
          disabled={readOnly}
        />
        <LabeledTextarea
          id="debrief-rex-prochaine"
          label="Que peut-on faire la prochaine fois ?"
          subtitle="Corriger les points faibles, conserver les points forts."
          value={form.prochaineFois}
          onChange={(v) => update('prochaineFois', v)}
          disabled={readOnly}
        />
      </div>

      <LabeledTextarea
        id="debrief-observations"
        label="Observations particulières"
        value={form.observationsParticulieres}
        onChange={(v) => update('observationsParticulieres', v)}
        disabled={readOnly}
      />
    </div>
  );

  // ——————————————————————————————
  // Step 5 — Participants + Review
  // ——————————————————————————————

  const filledParticipants = form.participants.filter((p) => p.nom.trim());

  const step5 = (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">Animateur, participants et résumé final.</p>

      {/* Animateur */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          id="debrief-animateur-nom"
          label="Nom et Prénom de l'animateur"
          value={form.animateurNom}
          onChange={(e) => update('animateurNom', e.target.value)}
          disabled={readOnly}
        />
        <TextField
          id="debrief-animateur-qualite"
          label="Qualité"
          value={form.animateurQualite}
          onChange={(e) => update('animateurQualite', e.target.value)}
          disabled={readOnly}
        />
      </div>

      {/* Participants */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Participants ({filledParticipants.length})
        </h4>
        <DynamicTable
          columns={PARTICIPANT_COLUMNS}
          rows={form.participants as unknown as Record<string, string | number>[]}
          onChange={(ri, key, value) => {
            setForm((prev) => {
              const participants = [...prev.participants];
              participants[ri] = { ...participants[ri], [key]: String(value) };
              return { ...prev, participants };
            });
          }}
          onAddRow={() => {
            setForm((prev) => ({
              ...prev,
              participants: [...prev.participants, { nom: '', poste: '' }],
            }));
          }}
          onRemoveRow={(ri) => {
            setForm((prev) => ({
              ...prev,
              participants: prev.participants.filter((_, i) => i !== ri),
            }));
          }}
          disabled={readOnly}
          addLabel="Ajouter un participant"
        />
      </div>

      {/* Summary */}
      <div className="border-t border-input pt-4 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Résumé
        </h4>
        <div className="rounded-lg border border-input bg-surface p-4 text-sm space-y-2">
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span><span className="font-semibold text-muted-foreground">Date:</span> {form.date}</span>
            {form.superficieIncendiee !== '' && (
              <span><span className="font-semibold text-muted-foreground">Superficie:</span> {form.superficieIncendiee} ha</span>
            )}
            {form.heureDeclenchement && (
              <span><span className="font-semibold text-muted-foreground">Heure:</span> {form.heureDeclenchement}</span>
            )}
            {form.typeEssence && (
              <span><span className="font-semibold text-muted-foreground">Essence:</span> {form.typeEssence}</span>
            )}
          </div>
          {form.topographie.length > 0 && (
            <div><span className="font-semibold text-muted-foreground">Topographie:</span> {form.topographie.join(', ')}</div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {form.pistesForestieres != null && <span>Pistes: {form.pistesForestieres ? 'Oui' : 'Non'}</span>}
            {form.trancheesPF != null && <span>Tranchées PF: {form.trancheesPF ? 'Oui' : 'Non'}</span>}
            {form.pointsEau != null && <span>Points d&apos;eau: {form.pointsEau ? 'Oui' : 'Non'}</span>}
            {form.fonctionnaliteVPI != null && <span>VPI fonctionnel: {form.fonctionnaliteVPI ? 'Oui' : 'Non'}</span>}
          </div>
          {form.prochaineFois && (
            <div>
              <span className="font-semibold text-muted-foreground">Prochaine fois:</span>{' '}
              <span className="line-clamp-2">{form.prochaineFois}</span>
            </div>
          )}
          {form.animateurNom && (
            <div><span className="font-semibold text-muted-foreground">Animateur:</span> {form.animateurNom}{form.animateurQualite ? ` (${form.animateurQualite})` : ''}</div>
          )}
        </div>
      </div>

      {submitError && (
        <div role="alert" className="text-sm font-semibold text-danger">{submitError}</div>
      )}
    </div>
  );

  // ——————————————————————————————
  // Submit
  // ——————————————————————————————

  async function handleSubmit() {
    setSubmitError(null);
    setIsSubmitting(true);

    const payload = {
      fireRecordId,
      ...form,
      superficieIncendiee: form.superficieIncendiee === '' ? null : form.superficieIncendiee,
      participants: form.participants.filter((p) => p.nom.trim()),
      status: 'draft',
    };

    try {
      const isUpdate = !!existingId;
      const url = isUpdate ? `/api/debriefings/${existingId}` : '/api/debriefings';
      const method = isUpdate ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
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

  // ——————————————————————————————
  // Wizard
  // ——————————————————————————————

  const steps: WizardStep[] = [
    {
      title: 'Incendie',
      component: step1,
      validate: () => {
        if (!form.date) return 'La date du débriefing est requise.';
        return true;
      },
    },
    { title: 'Évaluation', component: step2 },
    { title: 'Infrastructure', component: step3 },
    { title: 'REX', component: step4 },
    {
      title: 'Participants',
      component: step5,
      validate: () => {
        if (!form.animateurNom.trim()) return "Le nom de l'animateur est requis.";
        return true;
      },
    },
  ];

  if (isLoadingExisting) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        <div className="h-32 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {readOnly && (
        <div className="mb-4 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground">
          Mode lecture seule
        </div>
      )}

      <FormWizard
        steps={steps}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        submitLabel={existingId ? 'Mettre à jour' : 'Enregistrer le débriefing'}
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
