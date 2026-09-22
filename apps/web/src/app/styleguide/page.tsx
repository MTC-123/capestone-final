'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Separator } from '@/components/ui/Separator';

function Swatch({ label, className }: { label: string; className: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
      <div className="text-sm font-semibold">{label}</div>
      <div className={`h-7 w-20 rounded-md border border-border ${className}`} />
    </div>
  );
}

export default function StyleguidePage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 p-6">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-primary text-primary-foreground shadow-elev-1">
            <Icon name="fire" aria-hidden={true} size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">RICER UI Style Guide</h1>
            <p className="text-sm text-muted-foreground">
              Design tokens + reusable components for the wildfire command center.
            </p>
          </div>
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-extrabold tracking-tight">Tokens</h2>
          <Badge tone="primary">2026-ready</Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Swatch label="Background" className="bg-background" />
          <Swatch label="Surface" className="bg-surface" />
          <Swatch label="Surface 2" className="bg-surface-2" />
          <Swatch label="Muted" className="bg-muted" />
          <Swatch label="Border" className="bg-border" />
          <Swatch label="Primary" className="bg-primary" />
          <Swatch label="Success" className="bg-success" />
          <Swatch label="Warning" className="bg-warning" />
          <Swatch label="Danger" className="bg-danger" />
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-lg font-extrabold tracking-tight">Typography</h2>
        <Card className="p-5">
          <div className="space-y-3">
            <div className="text-3xl font-extrabold tracking-tight">Command Center</div>
            <div className="text-lg font-bold">Operational Overview</div>
            <div className="text-sm text-muted-foreground">
              Use restrained color, strong hierarchy, and calm motion for real-time updates.
            </div>
            <div className="font-mono text-sm text-muted-foreground">Monospace • 00:14:20</div>
          </div>
        </Card>
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-lg font-extrabold tracking-tight">Components</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-4 p-5">
            <div className="text-sm font-bold text-muted-foreground">Buttons</div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary">
                <Icon name="campaign" aria-hidden={true} size={20} />
                Primary
              </Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="text-sm font-bold text-muted-foreground">Badges</div>
            <div className="flex flex-wrap gap-2">
              <Badge>Neutral</Badge>
              <Badge tone="primary">Primary</Badge>
              <Badge tone="success">Success</Badge>
              <Badge tone="warning">Warning</Badge>
              <Badge tone="danger">Danger</Badge>
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="text-sm font-bold text-muted-foreground">Icons</div>
            <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
              <Icon name="map" aria-hidden={true} size={22} />
              <Icon name="analytics" aria-hidden={true} size={22} />
              <Icon name="warning" aria-hidden={true} size={22} />
              <Icon name="truck" aria-hidden={true} size={22} />
              <Icon name="notifications" aria-hidden={true} size={22} />
              <Icon name="refresh" aria-hidden={true} size={22} />
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="text-sm font-bold text-muted-foreground">Cards</div>
            <div className="grid gap-3">
              <Card className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Risk Index
                    </div>
                    <div className="mt-2 text-2xl font-extrabold text-danger">High</div>
                  </div>
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-surface-2">
                    <Icon name="warning" aria-hidden={true} size={22} />
                  </div>
                </div>
              </Card>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
