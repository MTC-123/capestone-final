'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Receipt = { referenceNumber: string; status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'; receivedAt: string };

export function ReceiptStatus({ id, receipt }: { id: string; receipt: string }) {
  const [data, setData] = useState<Receipt | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!receipt || !/^[a-f0-9]{24}$/.test(id)) return;
    const controller = new AbortController();
    void fetch(`/api/public/fire-reports/${id}?receipt=${encodeURIComponent(receipt)}`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error('This receipt is unavailable. Check the link and try again.'); return response.json() as Promise<Receipt>; })
      .then(setData)
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not check status'); });
    return () => controller.abort();
  }, [id, receipt]);

  return <section className="rounded-2xl border border-border bg-surface p-6 shadow-elev-1">
    <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary">Private report receipt</p>
    <h1 className="mt-2 text-2xl font-bold">Report status</h1>
    {!receipt && <p role="alert" className="mt-4 text-sm text-danger">The receipt link is incomplete.</p>}
    {!data && !error && receipt && <p role="status" className="mt-4 text-sm text-muted-foreground">Checking the report…</p>}
    {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
    {data && <div className="mt-5 space-y-3">
      <p className="font-mono text-lg">{data.referenceNumber}</p>
      <p className="rounded-xl border border-primary/25 bg-primary/10 p-3 font-semibold">{data.status === 'PENDING' ? 'Received · awaiting official review' : data.status === 'IN_PROGRESS' ? 'Under official review' : 'Review completed'}</p>
      <p className="text-sm text-muted-foreground">Received {new Date(data.receivedAt).toLocaleString()}. A public report alone does not confirm an incident.</p>
    </div>}
    <Link href="/report" className="mt-6 inline-block text-sm font-semibold text-primary underline">Send another observation</Link>
  </section>;
}
