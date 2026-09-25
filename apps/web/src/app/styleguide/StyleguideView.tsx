'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Separator } from '@/components/ui/Separator';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageContainer, PageHeader } from '@/components/ui/PageHeader';
import { SkeletonBox, SkeletonText, SkeletonCard } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { SelectField } from '@/components/ui/SelectField';
import { cn } from '@/lib/cn';

function Swatch({ label, className }: { label: string; className: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[10px] border border-border bg-surface px-3 py-2">
      <div className="text-sm font-semibold">{label}</div>
      <div className={`h-7 w-20 rounded-[10px] border border-border ${className}`} />
    </div>
  );
}

function Section({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
        {badge}
      </div>
      {children}
    </section>
  );
}

function SegmentedTabsDemo() {
  const [active, setActive] = React.useState<'overview' | 'temporal' | 'causes'>('overview');
  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'temporal' as const, label: 'Temporal' },
    { id: 'causes' as const, label: 'Causes' },
  ];
  return (
    <div
      role="tablist"
      className="inline-flex gap-1 rounded-[10px] border border-border bg-surface-2 p-1"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => setActive(tab.id)}
          className={cn(
            'rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors',
            active === tab.id
              ? 'bg-primary text-primary-foreground shadow-elev-1'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default function StyleguideView() {
  return (
    <PageContainer wide className="pb-16">
      <PageHeader
        eyebrow="Design system"
        title="RICER UI style guide"
        description="Design tokens and reusable components for the wildfire command center. Demo-only reference — not part of the operational product."
        actions={<Badge tone="primary">2026-ready</Badge>}
      />

      <div className="space-y-10">
        <Section title="Color tokens">
          <div className="grid gap-3 md:grid-cols-3">
            <Swatch label="Background" className="bg-background" />
            <Swatch label="Surface" className="bg-surface" />
            <Swatch label="Surface 2" className="bg-surface-2" />
            <Swatch label="Muted" className="bg-muted" />
            <Swatch label="Border" className="bg-border" />
            <Swatch label="Primary" className="bg-primary" />
            <Swatch label="Success" className="bg-success" />
            <Swatch label="Warning" className="bg-warning" />
            <Swatch label="Danger" className="bg-danger" />
            <Swatch label="Info" className="bg-info" />
            <Swatch label="Accent fire" className="bg-accent-fire" />
          </div>
        </Section>

        <Separator />

        <Section title="Typography">
          <Card className="p-5">
            <div className="space-y-3">
              <div className="text-3xl font-extrabold tracking-tight">Command Center</div>
              <div className="text-lg font-bold">Operational Overview</div>
              <div className="text-sm text-muted-foreground">
                Use restrained color, strong hierarchy, and calm motion for real-time updates.
              </div>
              <div className="font-mono text-sm text-muted-foreground tabular">Monospace • 00:14:20</div>
            </div>
          </Card>
        </Section>

        <Separator />

        <Section title="Buttons">
          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap gap-2">
              <Button variant="primary">
                <Icon name="campaign" aria-hidden={true} size={18} />
                Primary
              </Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="fire">
                <Icon name="fire" aria-hidden={true} size={18} />
                Fire
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" size="sm">Small</Button>
              <Button variant="primary" size="md">Medium</Button>
              <Button variant="primary" size="lg">Large</Button>
              <Button variant="primary" isLoading>Loading</Button>
            </div>
          </Card>
        </Section>

        <Separator />

        <Section title="Badges">
          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap gap-2">
              <Badge>Neutral</Badge>
              <Badge tone="primary">Primary</Badge>
              <Badge tone="success">Success</Badge>
              <Badge tone="warning">Warning</Badge>
              <Badge tone="danger">Danger</Badge>
            </div>
          </Card>
        </Section>

        <Separator />

        <Section title="KPI cards">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Active fires" value={7} tone="danger" icon={<Icon name="fire" size={20} aria-hidden />} />
            <KpiCard label="Days without rain" value={14} tone="warning" icon={<Icon name="droplet" size={20} aria-hidden />} />
            <KpiCard label="Units available" value={23} tone="success" icon={<Icon name="truck" size={20} aria-hidden />} />
            <KpiCard label="Avg. response" value="9 min" tone="primary" icon={<Icon name="timer" size={20} aria-hidden />} />
          </div>
        </Section>

        <Separator />

        <Section title="Tabs (segmented)">
          <Card className="p-5">
            <SegmentedTabsDemo />
          </Card>
        </Section>

        <Separator />

        <Section title="Form controls">
          <Card className="grid gap-4 p-5 sm:grid-cols-2">
            <TextField id="sg-text" label="Location name" placeholder="e.g. Azrou forest" leadingIcon="mapPin" />
            <SelectField
              id="sg-select"
              label="Status"
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'active', label: 'Active' },
              ]}
              defaultValue="pending"
            />
          </Card>
        </Section>

        <Separator />

        <Section title="Skeletons">
          <Card className="space-y-4 p-5">
            <SkeletonBox className="h-10 w-full" />
            <SkeletonText lines={2} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </Card>
        </Section>

        <Separator />

        <Section title="Icons">
          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
              <Icon name="map" aria-hidden={true} size={22} />
              <Icon name="analytics" aria-hidden={true} size={22} />
              <Icon name="warning" aria-hidden={true} size={22} />
              <Icon name="truck" aria-hidden={true} size={22} />
              <Icon name="notifications" aria-hidden={true} size={22} />
              <Icon name="refresh" aria-hidden={true} size={22} />
              <Icon name="fire" aria-hidden={true} size={22} />
              <Icon name="shield" aria-hidden={true} size={22} />
            </div>
          </Card>
        </Section>

        <Separator />

        <Section title="Cards">
          <Card className="space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Risk index
                    </div>
                    <div className="mt-2 text-2xl font-extrabold text-danger">High</div>
                  </div>
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-danger-muted text-danger">
                    <Icon name="warning" aria-hidden={true} size={22} />
                  </div>
                </div>
              </Card>
              <Card tone="elevated" className="p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Elevated card
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Used for chart panels and dialogs.</p>
              </Card>
            </div>
          </Card>
        </Section>
      </div>
    </PageContainer>
  );
}
