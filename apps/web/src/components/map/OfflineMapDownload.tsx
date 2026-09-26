'use client';

import { useEffect, useState } from 'react';
import { registerServiceWorker } from '@/lib/offline/registerServiceWorker';

type SaveMessage = { type: 'saveIfraneStatus'; state: 'assets' | 'saved' | 'error'; completed?: number; total?: number; message?: string };

export function OfflineMapDownload() {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [progress, setProgress] = useState('');
  useEffect(() => {
    const onMessage = (event: MessageEvent<SaveMessage>) => {
      if (event.data?.type !== 'saveIfraneStatus') return;
      if (event.data.state === 'saved') { setState('saved'); setProgress('Ifrane map saved for offline use'); }
      else if (event.data.state === 'error') { setState('error'); setProgress(event.data.message || 'Download failed'); }
      else setProgress(`Saving map assets ${event.data.completed ?? 0}/${event.data.total ?? 0}`);
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage);
  }, []);
  const save = async () => {
    if (!('serviceWorker' in navigator)) { setState('error'); setProgress('Offline maps need service worker support'); return; }
    setState('saving'); setProgress('Downloading Ifrane map…');
    try {
      const registration = await registerServiceWorker();
      if (!registration) throw new Error('Offline maps are available in the production app');
      const ready = await navigator.serviceWorker.ready;
      if (!ready.active) throw new Error('Offline map worker is not ready');
      ready.active.postMessage({ type: 'saveIfrane' });
    } catch (error) { setState('error'); setProgress(error instanceof Error ? error.message : 'Could not start download'); }
  };
  return <div className="rounded-xl border border-border bg-surface/95 p-2 text-xs shadow-elev-1">
    <button type="button" onClick={save} disabled={state === 'saving'} className="font-semibold text-primary disabled:opacity-50">
      {state === 'saved' ? 'Refresh offline Ifrane map' : 'Save Ifrane for offline use (~14 MB)'}
    </button>
    {progress && <p role="status" className="mt-1 text-muted-foreground">{progress}</p>}
  </div>;
}
