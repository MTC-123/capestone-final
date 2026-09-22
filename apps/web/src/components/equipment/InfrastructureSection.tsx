'use client';

import { useEffect, useState } from 'react';
import { useEquipmentStore } from '@/store/useEquipmentStore';
import { useTranslation } from '@/hooks/useTranslation';
import { ResourceCard } from './ResourceCard';
import { ResourceFormDialog, type FormField } from './ResourceFormDialog';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { SkeletonCard } from '@/components/ui/Skeleton';
import type { Infrastructure } from '@/types/equipment';
import type { BadgeProps } from '@/components/ui/Badge';
import type { TranslationKey } from '@/i18n/translations';

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  OPERATIONNEL: 'success',
  DEGRADE: 'warning',
  HORS_SERVICE: 'danger',
};

const STATUS_LABEL_KEY: Record<string, string> = {
  OPERATIONNEL: 'statusOperationnel',
  DEGRADE: 'statusDegrade',
  HORS_SERVICE: 'statusHorsService',
};

const INFRA_TYPE_KEY: Record<string, string> = {
  WATCHTOWER: 'infraTypeWatchtower',
  WATER_POINT: 'infraTypeWaterPoint',
  FIREBREAK: 'infraTypeFirebreak',
  STATION: 'infraTypeStation',
  FOREST_ROAD: 'infraTypeForestRoad',
  HELIPAD: 'infraTypeHelipad',
};

const INFRA_TYPE_ICON: Record<string, string> = {
  WATCHTOWER: 'eye',
  WATER_POINT: 'droplet',
  FIREBREAK: 'shield',
  STATION: 'truck',
  FOREST_ROAD: 'route',
  HELIPAD: 'navigation',
};

export function InfrastructureSection() {
  const { t, language } = useTranslation();
  const locale = language === 'ar' ? 'ar-MA' : language === 'fr' ? 'fr-FR' : 'en-US';

  const {
    infrastructure,
    infrastructureLoading,
    fetchInfrastructure,
    createInfrastructure,
    updateInfrastructure,
    deleteInfrastructure,
    startPicking,
  } = useEquipmentStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Infrastructure | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchInfrastructure();
  }, [fetchInfrastructure]);

  const fields: FormField[] = [
    { name: 'name', label: t('name'), type: 'text', required: true },
    {
      name: 'type',
      label: t('type'),
      type: 'select',
      required: true,
      options: [
        { value: 'WATCHTOWER', label: t('infraTypeWatchtower' as TranslationKey) },
        { value: 'WATER_POINT', label: t('infraTypeWaterPoint' as TranslationKey) },
        { value: 'FIREBREAK', label: t('infraTypeFirebreak' as TranslationKey) },
        { value: 'STATION', label: t('infraTypeStation' as TranslationKey) },
        { value: 'FOREST_ROAD', label: t('infraTypeForestRoad' as TranslationKey) },
        { value: 'HELIPAD', label: t('infraTypeHelipad' as TranslationKey) },
      ],
    },
    {
      name: 'status',
      label: t('status'),
      type: 'select',
      options: [
        { value: 'OPERATIONNEL', label: t('statusOperationnel' as TranslationKey) },
        { value: 'DEGRADE', label: t('statusDegrade' as TranslationKey) },
        { value: 'HORS_SERVICE', label: t('statusHorsService' as TranslationKey) },
      ],
    },
    { name: 'capacity', label: t('capacityLabel'), type: 'number' },
    {
      name: 'capacityUnit',
      label: t('unit'),
      type: 'select',
      options: [
        { value: 'L', label: 'L' },
        { value: 'km', label: 'km' },
        { value: 'm', label: 'm' },
      ],
    },
    { name: 'lastInspectionDate', label: t('lastInspection'), type: 'date' },
    { name: 'notes', label: t('notesLabel'), type: 'textarea' },
  ];

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (editing?.id) {
      await updateInfrastructure(editing.id, values as Partial<Infrastructure>);
    } else {
      await createInfrastructure(values as Partial<Infrastructure>);
    }
  };

  const handleEdit = (item: Infrastructure) => {
    setEditing(item);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteInfrastructure(deleteId);
    } catch {
      // ignore
    }
    setDeleteId(null);
  };

  // Group infrastructure by type for visual organization
  const groupedByType = infrastructure.reduce<Record<string, Infrastructure[]>>((acc, item) => {
    const key = item.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-bold text-foreground">{t('tabInfrastructure')}</h3>
        <Button
          size="sm"
          variant="primary"
          className="w-full sm:w-auto"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Icon name="plus" size={16} aria-hidden /> {t('createInfrastructure')}
        </Button>
      </div>

      {infrastructureLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : infrastructure.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border border-border/40 rounded-lg bg-surface-2">
          <Icon name="shield" size={40} className="text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">{t('noInfrastructure')}</p>
          <Button
            variant="primary"
            size="sm"
            className="mt-3"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Icon name="plus" size={16} aria-hidden /> {t('createInfrastructure')}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByType).map(([type, items]) => (
            <div key={type}>
              <div className="flex items-center gap-2 mb-3">
                <Icon
                  name={(INFRA_TYPE_ICON[type] ?? 'shield') as import('@/components/ui/Icon').IconName}
                  size={16}
                  className="text-muted-foreground"
                  aria-hidden
                />
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {t((INFRA_TYPE_KEY[type] ?? type) as TranslationKey)}
                </h4>
                <span className="text-xs text-muted-foreground">({items.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item) => (
                  <ResourceCard
                    key={item.id}
                    title={item.name}
                    subtitle={
                      item.capacity != null
                        ? `${item.capacity} ${item.capacityUnit ?? ''}`
                        : undefined
                    }
                    status={t((STATUS_LABEL_KEY[item.status] ?? item.status) as TranslationKey)}
                    statusTone={STATUS_TONE[item.status] ?? 'neutral'}
                    details={[
                      {
                        label: t('lastInspection'),
                        value: item.lastInspectionDate
                          ? new Date(item.lastInspectionDate).toLocaleDateString(locale)
                          : '—',
                      },
                      {
                        label: t('locationLabel'),
                        value:
                          item.latitude && item.longitude
                            ? `${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`
                            : '—',
                      },
                    ]}
                    onEdit={() => handleEdit(item)}
                    onDelete={() => setDeleteId(item.id)}
                    onRelocate={() => startPicking('infrastructure', item.id)}
                    editLabel={t('edit')}
                    deleteLabel={t('deleteAction')}
                    relocateLabel={t('relocate' as TranslationKey)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <ResourceFormDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        title={editing ? t('editInfrastructure') : t('createInfrastructure')}
        fields={fields}
        initialValues={
          editing
            ? (editing as unknown as Record<string, unknown>)
            : { type: 'WATCHTOWER', status: 'OPERATIONNEL' }
        }
        onSubmit={handleSubmit}
        showMapPicker
        onPickOnMap={() => {
          if (editing?.id) startPicking('infrastructure', editing.id);
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
