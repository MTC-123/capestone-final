'use client';

import { Card } from '@/components/ui/Card';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

interface ResourceCardProps {
  title: string;
  subtitle?: string;
  status: string;
  statusTone: BadgeProps['tone'];
  details: { label: string; value: string }[];
  onEdit: () => void;
  onDelete: () => void;
  onRelocate?: () => void;
  editLabel: string;
  deleteLabel: string;
  relocateLabel?: string;
}

export function ResourceCard({
  title,
  subtitle,
  status,
  statusTone,
  details,
  onEdit,
  onDelete,
  onRelocate,
  editLabel,
  deleteLabel,
  relocateLabel,
}: ResourceCardProps) {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <h4 className="font-semibold text-sm text-foreground truncate">{title}</h4>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
        <Badge tone={statusTone} className="ml-2 shrink-0">{status}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {details.map((d) => (
          <div key={d.label}>
            <span className="text-muted-foreground">{d.label}:</span>{' '}
            <span className="font-medium text-foreground">{d.value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border/40 pt-2">
        <Button size="sm" variant="secondary" onClick={onEdit} className="min-w-24 flex-1 sm:flex-none">
          <Icon name="pencil" size={12} aria-hidden /> {editLabel}
        </Button>
        {onRelocate && (
          <Button size="sm" variant="secondary" onClick={onRelocate} className="min-w-24 flex-1 sm:flex-none">
            <Icon name="mapPin" size={12} aria-hidden /> {relocateLabel}
          </Button>
        )}
        <Button size="sm" variant="danger" onClick={onDelete} className="min-w-24 flex-1 sm:flex-none">
          <Icon name="trash" size={12} aria-hidden /> {deleteLabel}
        </Button>
      </div>
    </Card>
  );
}
