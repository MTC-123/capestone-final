'use client';

import { useEffect, useState } from 'react';
import { useEquipmentStore } from '@/store/useEquipmentStore';
import { useTranslation } from '@/hooks/useTranslation';
import { ResourceCard } from './ResourceCard';
import { ResourceFormDialog, type FormField } from './ResourceFormDialog';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { SkeletonCard } from '@/components/ui/Skeleton';
import type { RetardantProduct } from '@/types/equipment';
import type { BadgeProps } from '@/components/ui/Badge';
import type { TranslationKey } from '@/i18n/translations';

const RETARDANT_TYPE_KEY: Record<string, string> = {
  MOUSSE: 'typeMousse',
  RETARDANT: 'typeRetardant',
  GEL: 'typeGel',
};

function quantityTone(qty: number): BadgeProps['tone'] {
  if (qty > 500) return 'success';
  if (qty >= 100) return 'warning';
  return 'danger';
}

export function RetardantSection() {
  const { t, language } = useTranslation();
  const locale = language === 'ar' ? 'ar-MA' : language === 'fr' ? 'fr-FR' : 'en-US';

  const {
    retardant,
    retardantLoading,
    fetchRetardant,
    createRetardant,
    updateRetardant,
    deleteRetardant,
    startPicking,
  } = useEquipmentStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RetardantProduct | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchRetardant();
  }, [fetchRetardant]);

  const fields: FormField[] = [
    { name: 'name', label: t('name'), type: 'text', required: true },
    {
      name: 'type',
      label: t('type'),
      type: 'select',
      required: true,
      options: [
        { value: 'MOUSSE', label: t('typeMousse' as TranslationKey) },
        { value: 'RETARDANT', label: t('typeRetardant' as TranslationKey) },
        { value: 'GEL', label: t('typeGel' as TranslationKey) },
      ],
    },
    { name: 'quantity', label: t('quantity'), type: 'number', required: true },
    {
      name: 'unit',
      label: t('unit'),
      type: 'select',
      options: [
        { value: 'L', label: 'L' },
        { value: 'KG', label: 'KG' },
      ],
    },
    { name: 'storageLocation', label: t('storageLocation'), type: 'text', required: true },
    { name: 'acquisitionDate', label: t('acquisitionDate'), type: 'date', required: true },
    { name: 'expiryDate', label: t('expiryDate'), type: 'date' },
    { name: 'notes', label: t('notesLabel'), type: 'textarea' },
  ];

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (editing?.id) {
      await updateRetardant(editing.id, values as Partial<RetardantProduct>);
    } else {
      await createRetardant(values as Partial<RetardantProduct>);
    }
  };

  const handleEdit = (item: RetardantProduct) => {
    setEditing(item);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteRetardant(deleteId);
    } catch {
      // ignore
    }
    setDeleteId(null);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-bold text-foreground">{t('tabRetardant')}</h3>
        <Button
          size="sm"
          variant="primary"
          className="w-full sm:w-auto"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Icon name="plus" size={16} aria-hidden /> {t('createRetardant')}
        </Button>
      </div>

      {retardantLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : retardant.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border border-border/40 rounded-lg bg-surface-2">
          <Icon name="droplet" size={40} className="text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">{t('noRetardantProducts')}</p>
          <Button
            variant="primary"
            size="sm"
            className="mt-3"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Icon name="plus" size={16} aria-hidden /> {t('createRetardant')}
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {retardant.map((item) => (
              <ResourceCard
                key={item.id}
                title={item.name}
                subtitle={t((RETARDANT_TYPE_KEY[item.type] ?? item.type) as TranslationKey)}
                status={`${item.quantity.toLocaleString(locale)} ${item.unit}`}
                statusTone={quantityTone(item.quantity)}
                details={[
                  { label: t('storageLocation'), value: item.storageLocation },
                  {
                    label: t('expiryDate'),
                    value: item.expiryDate
                      ? new Date(item.expiryDate).toLocaleDateString(locale)
                      : '—',
                  },
                ]}
                onEdit={() => handleEdit(item)}
                onDelete={() => setDeleteId(item.id)}
                onRelocate={() => startPicking('retardant', item.id)}
                editLabel={t('edit')}
                deleteLabel={t('deleteAction')}
                relocateLabel={t('relocate' as TranslationKey)}
              />
            ))}
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/10 p-4">
            <div className="font-bold text-primary">
              {t('totalAmount')}:{' '}
              {retardant.reduce((sum, p) => sum + p.quantity, 0).toLocaleString(locale)}{' '}
              {t('liters')}
            </div>
          </div>
        </>
      )}

      <ResourceFormDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        title={editing ? t('editRetardant') : t('createRetardant')}
        fields={fields}
        initialValues={
          editing
            ? (editing as unknown as Record<string, unknown>)
            : { type: 'MOUSSE', unit: 'L', quantity: 0 }
        }
        onSubmit={handleSubmit}
        showMapPicker
        onPickOnMap={() => {
          if (editing?.id) startPicking('retardant', editing.id);
        }}
        pickOnMapLabel={t('pickOnMap' as TranslationKey)}
        saveLabel={t('save')}
        cancelLabel={t('cancel')}
        savingLabel={t('saving')}
      />

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-sm space-y-4 rounded-t-xl border border-border bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-elev-3 sm:rounded-xl sm:p-6">
            <p className="text-foreground font-medium">{t('confirmDelete')}</p>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <Button variant="secondary" onClick={() => setDeleteId(null)}>
                {t('cancel')}
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                {t('deleteAction')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
