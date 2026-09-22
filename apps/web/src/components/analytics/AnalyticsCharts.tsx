'use client';

import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface AnalyticsChartsProps {
  timelineData: { date: string; count: number }[];
  causesData: { cause: string; count: number }[];
  getCauseLabel: (cause: string) => string;
  language: string;
}

const COLORS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
];

export function AnalyticsCharts({
  timelineData,
  causesData,
  getCauseLabel,
  language,
}: AnalyticsChartsProps) {
  return (
    <>
      {/* Timeline Chart */}
      <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Incidents Timeline (14 days)
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={timelineData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(val: string) =>
                new Date(val).toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR', {
                  month: 'short',
                  day: 'numeric',
                })
              }
            />
            <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--surface))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="hsl(var(--primary))"
              strokeWidth={3}
              dot={{ fill: 'hsl(var(--primary))', r: 5 }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Causes Pie Chart */}
      <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Incidents by Cause
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={causesData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry) => getCauseLabel(entry.cause)}
              outerRadius={100}
              fill="#8884d8"
              dataKey="count"
            >
              {causesData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--surface))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {causesData.map((item, idx) => (
            <div key={item.cause} className="flex items-center gap-2 text-sm">
              <div
                className="h-3 w-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: COLORS[idx % COLORS.length] }}
              />
              <span className="truncate">
                {getCauseLabel(item.cause)}: {item.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
