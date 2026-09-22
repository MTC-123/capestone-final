'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useAnalyticsStore, computeDateRange } from '@/store/useAnalyticsStore';
import { useTranslation } from '@/hooks/useTranslation';
import { Card } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { Icon } from '@/components/ui/Icon';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import type { ResponseData, RexData } from '@/types/analytics';

const PHASE_COLORS = [
  'hsl(var(--warning))',
  'hsl(var(--primary))',
  'hsl(var(--danger))',
  'hsl(38 92% 50%)',
  'hsl(142 71% 45%)',
];

export function ResponsePanel() {
  const { t, language } = useTranslation();
  const dateRange = useAnalyticsStore((s) => s.dateRange);
  const customFrom = useAnalyticsStore((s) => s.customFrom);
  const customTo = useAnalyticsStore((s) => s.customTo);
  const [responseData, setResponseData] = useState<ResponseData | null>(null);
  const [rexData, setRexData] = useState<RexData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchResponse = useCallback(async () => {
    setLoading(true);
    try {
      const range = computeDateRange(dateRange, customFrom, customTo);
      const params = new URLSearchParams({ from: range.from, to: range.to });
      const [resResp, rexResp] = await Promise.all([
        fetchWithAuth(`/api/analytics/response?${params.toString()}`),
        fetchWithAuth(`/api/analytics/rex?${params.toString()}`),
      ]);
      if (resResp.ok) setResponseData(await resResp.json() as ResponseData);
      if (rexResp.ok) setRexData(await rexResp.json() as RexData);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [dateRange, customFrom, customTo]);

  useEffect(() => {
    fetchResponse();
  }, [fetchResponse]);

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--surface))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    color: 'hsl(var(--foreground))',
  };

  const minLabel = language === 'ar' ? 'دقيقة' : 'min';

  if (loading) {
    return (
      <div className="space-y-8" aria-busy="true">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-xl border border-border bg-muted p-6">
            <div className="h-[250px] rounded-xl bg-muted-foreground/10" />
          </div>
        ))}
      </div>
    );
  }

  const hasResponseData = responseData && responseData.phases.length > 0;
  const hasRexData = rexData && rexData.recordCount > 0;

  if (!hasResponseData && !hasRexData) {
    return (
      <Card tone="subtle" className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <Icon name="fire" size={32} className="text-muted-foreground" aria-hidden />
        <h3 className="text-lg font-bold text-foreground">{t('insufficientData')}</h3>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Response Time KPIs */}
      {hasResponseData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {responseData.phases.slice(0, 3).map((phase, i) => (
              <KpiCard
                key={phase.name}
                label={t(phase.name as Parameters<typeof t>[0])}
                value={`${phase.avgMinutes.toFixed(0)} ${minLabel}`}
                tone={i === 0 ? 'warning' : i === 1 ? 'primary' : 'danger'}
                icon={<Icon name="fire" aria-hidden size={24} className={i === 2 ? 'text-danger' : 'text-primary'} />}
              />
            ))}
          </div>

          {/* Waterfall Chart */}
          <Card tone="elevated" className="p-6">
            <h2 className="text-xl font-bold mb-4">{t('responseWaterfall')}</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={responseData.phases} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v) => `${v} ${minLabel}`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  width={160}
                  tickFormatter={(v) => t(v as Parameters<typeof t>[0])}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [`${Number(v).toFixed(1)} ${minLabel}`, '']}
                />
                <Bar dataKey="avgMinutes" radius={[0, 4, 4, 0]}>
                  {responseData.phases.map((_phase, i) => (
                    <Cell key={i} fill={PHASE_COLORS[i % PHASE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('totalResponseTime')}: {responseData.avgTotalMinutes.toFixed(0)} {minLabel}
            </p>
          </Card>
        </>
      )}

      {/* REX Section */}
      {hasRexData && (
        <Card tone="elevated" className="p-6">
          <h2 className="text-xl font-bold mb-6">{t('rexDashboard')}</h2>

          {/* Resources */}
          <h3 className="text-lg font-semibold mb-3">{t('resourcesUsed')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <KpiCard label={t('totalVehiclesDeployed')} value={rexData.totalVehicles} tone="primary" />
            <KpiCard label={t('totalAircraftUsed')} value={rexData.totalAircraft} tone="primary" />
            <KpiCard label={t('totalPersonnelEngaged')} value={rexData.totalPersonnel} tone="primary" />
            <KpiCard label={t('totalWaterUsed')} value={`${(rexData.totalWaterLiters / 1000).toFixed(0)}k L`} tone="primary" />
            <KpiCard label={t('totalRetardantUsed')} value={`${(rexData.totalRetardantLiters / 1000).toFixed(0)}k L`} tone="warning" />
          </div>

          {/* Economic Impact */}
          <h3 className="text-lg font-semibold mb-3">{t('economicImpact')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KpiCard label={t('forestAreaLost')} value={`${rexData.economicLoss.forest.toLocaleString()} MAD`} tone="danger" />
            <KpiCard label={t('infrastructureDamage')} value={`${rexData.economicLoss.infrastructure.toLocaleString()} MAD`} tone="danger" />
            <KpiCard label={t('agricultureDamage')} value={`${rexData.economicLoss.agriculture.toLocaleString()} MAD`} tone="warning" />
            <KpiCard label={t('totalEstimatedLoss')} value={`${rexData.economicLoss.total.toLocaleString()} MAD`} tone="danger" />
          </div>

          {/* Burn Area Stats */}
          <div className="grid grid-cols-3 gap-4">
            <KpiCard label={t('avgBurnArea')} value={`${rexData.burnAreaStats.avg.toFixed(1)} ha`} tone="warning" />
            <KpiCard label={t('maxBurnArea')} value={`${rexData.burnAreaStats.max.toFixed(1)} ha`} tone="danger" />
            <KpiCard label={t('totalBurnArea')} value={`${rexData.burnAreaStats.total.toFixed(1)} ha`} tone="danger" />
          </div>
        </Card>
      )}
    </div>
  );
}
