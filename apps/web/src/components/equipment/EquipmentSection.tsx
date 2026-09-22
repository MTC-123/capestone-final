'use client';

import { useEffect, useState } from 'react';
import { useEquipmentStore } from '@/store/useEquipmentStore';
import { useTranslation } from '@/hooks/useTranslation';
import { ResourceCard } from './ResourceCard';
import { ResourceFormDialog, type FormField } from './ResourceFormDialog';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { SkeletonCard } from '@/components/ui/Skeleton';
import type { Equipment } from '@/types/equipment';
import type { BadgeProps } from '@/components/ui/Badge';
import type { TranslationKey } from '@/i18n/translations';

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  OPERATIONNEL: 'success',
  EN_PANNE: 'danger',
  EN_MAINTENANCE: 'warning',
  DEGRADE: 'warning',
  HORS_SERVICE: 'danger',
};

const STATUS_LABEL_KEY: Record<string, string> = {
  OPERATIONNEL: 'statusOperationnel',
  EN_PANNE: 'statusEnPanne',
  EN_MAINTENANCE: 'statusEnMaintenance',
  DEGRADE: 'statusDegrade',
  HORS_SERVICE: 'statusHorsService',
};

const EQUIPMENT_TYPE_KEY: Record<string, string> = {
  VPI: 'typeVPI',
  CAMION_CITERNE: 'typeCamionCiterne',
  MOTOPOMPE: 'typeMotopompe',
  VEHICULE_LIAISON: 'typeVehiculeLiaison',
  AUTRE: 'typeAutre',
};

export function EquipmentSection() {
  const { t } = useTranslation();
  const {
    equipment,
    equipmentLoading,
    fetchEquipment,
    createEquipment,
    updateEquipment,
    deleteEquipment,
    startPicking,
  } = useEquipmentStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchEquipment();
  }, [fetchEquipment]);

  const fields: FormField[] = [
    { name: 'name', label: t('name'), type: 'text', required: true, placeholder: 'e.g. VPI-03' },
    {
      name: 'type',
      label: t('type'),
      type: 'select',
      required: true,
      options: [
        { value: 'VPI', label: t('typeVPI' as TranslationKey) },
        { value: 'CAMION_CITERNE', label: t('typeCamionCiterne' as TranslationKey) },
        { value: 'MOTOPOMPE', label: t('typeMotopompe' as TranslationKey) },
        { value: 'VEHICULE_LIAISON', label: t('typeVehiculeLiaison' as TranslationKey) },
        { value: 'AUTRE', label: t('typeAutre' as TranslationKey) },
      ],
    },
    {
      name: 'status',
      label: t('status'),
      type: 'select',
      options: [
        { value: 'OPERATIONNEL', label: t('statusOperationnel' as TranslationKey) },
        { value: 'EN_PANNE', label: t('statusEnPanne' as TranslationKey) },
        { value: 'EN_MAINTENANCE', label: t('statusEnMaintenance' as TranslationKey) },
      ],
    },
    { name: 'quantity', label: t('quantity'), type: 'number', placeholder: '1' },
    { name: 'department', label: t('department'), type: 'text' },
    { name: 'lastMaintenance', label: t('lastMaintenance'), type: 'date' },
    { name: 'notes', label: t('notesLabel'), type: 'textarea' },
  ];

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (editing?.id) {
      await updateEquipment(editing.id, values as Partial<Equipment>);
    } else {
      await createEquipment(values as Partial<Equipment>);
    }
  };

  const handleEdit = (item: Equipment) => {
    setEditing(item);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteEquipment(deleteId);
    } catch {
      // ignore
    }
    setDeleteId(null);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-bold text-foreground">{t('tabEquipment')}</h3>
        <Button
          size="sm"
          variant="primary"
          className="w-full sm:w-auto"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Icon name="plus" size={16} aria-hidden /> {t('createEquipment')}
        </Button>
      </div>

      {equipmentLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : equipment.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border border-border/40 rounded-lg bg-surface-2">
          <Icon name="truck" size={40} className="text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">{t('noEquipment')}</p>
          <Button
            variant="primary"
            size="sm"
            className="mt-3"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Icon name="plus" size={16} aria-hidden /> {t('createEquipment')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {equipment.map((item) => (
            <ResourceCard
              key={item.id}
              title={item.name}
              subtitle={t((EQUIPMENT_TYPE_KEY[item.type] ?? item.type) as TranslationKey)}
              status={t((STATUS_LABEL_KEY[item.status] ?? item.status) as TranslationKey)}
              statusTone={STATUS_TONE[item.status] ?? 'neutral'}
              details={[
                { label: t('department'), value: item.department || '—' },
                { label: t('quantity'), value: String(item.quantity) },
              ]}
              onEdit={() => handleEdit(item)}
              onDelete={() => setDeleteId(item.id)}
              onRelocate={() => startPicking('equipment', item.id)}
              editLabel={t('edit')}
              deleteLabel={t('deleteAction')}
              relocateLabel={t('relocate' as TranslationKey)}
            />
          ))}
        </div>
      )}

      <ResourceFormDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        title={editing ? t('editEquipment') : t('createEquipment')}
        fields={fields}
        initialValues={editing ? (editing as unknown as Record<string, unknown>) : { type: 'VPI', status: 'OPERATIONNEL', quantity: 1 }}
        onSubmit={handleSubmit}
        showMapPicker
        onPickOnMap={() => {
          if (editing?.id) startPicking('equipment', editing.id);
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
