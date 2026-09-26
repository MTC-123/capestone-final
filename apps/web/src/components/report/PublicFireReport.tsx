'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useOfflineQueue } from '@/lib/offline/useOfflineQueue';
import { PhotoUpload } from '@/components/report/PhotoUpload';
import { registerServiceWorker } from '@/lib/offline/registerServiceWorker';

const LocationPicker = dynamic(() => import('@/components/map/LocationPicker'), {
  ssr: false,
  loading: () => <div className="grid h-64 place-items-center rounded-xl bg-muted">Loading map…</div>,
});

const copy = {
  en: {
    title: 'Report a possible fire', lead: 'A quick report helps local responders check what is happening. No account needed.',
    danger: 'If people are in immediate danger, call emergency services now. Move to safety before taking a photo.',
    seen: 'What do you see?', fire: 'Flames or fire', smoke: 'Smoke', unsure: 'Not sure',
    where: 'Where is it?', gps: 'Use my location', landmark: 'Place or nearby landmark',
    landmarkHelp: 'A village, road, forest, or other place responders can recognize.',
    gpsQuestion: 'Does this position mark the fire or where you are standing?',
    firePosition: 'The fire is here', observerPosition: 'I am observing it from here',
    approximate: 'Approximate fire area', adjust: 'Adjust fire location on map', hide: 'Hide map',
    detail: 'Anything else? (optional)', photo: 'Photo (optional)', contact: 'Phone for follow-up (optional)',
    send: 'Send report', sending: 'Saving…', locationRequired: 'Add a place or choose a position.',
    queued: 'Saved on this device', queuedHelp: 'The report is queued. Keep this browser data until it says received.',
    received: 'Report received', receivedHelp: 'An official will review it. Your report does not confirm an incident.',
    reference: 'Reference', retry: 'Try sending again', again: 'Report another observation',
    gpsFailed: 'Location was unavailable. Enter a place or adjust the map instead.',
  },
  fr: {
    title: 'Signaler un feu possible', lead: 'Un signalement rapide aide les équipes à vérifier la situation. Aucun compte nécessaire.',
    danger: 'Si des personnes sont en danger immédiat, appelez les secours. Mettez-vous à l’abri avant de prendre une photo.',
    seen: 'Que voyez-vous ?', fire: 'Flammes ou feu', smoke: 'Fumée', unsure: 'Je ne sais pas',
    where: 'Où est-ce ?', gps: 'Utiliser ma position', landmark: 'Lieu ou repère proche',
    landmarkHelp: 'Village, route, forêt ou autre repère reconnaissable.',
    gpsQuestion: 'Cette position est-elle celle du feu ou la vôtre ?',
    firePosition: 'Le feu est ici', observerPosition: 'Je l’observe depuis ici',
    approximate: 'Zone approximative du feu', adjust: 'Ajuster sur la carte', hide: 'Masquer la carte',
    detail: 'Autres détails ? (facultatif)', photo: 'Photo (facultative)', contact: 'Téléphone pour suivi (facultatif)',
    send: 'Envoyer', sending: 'Enregistrement…', locationRequired: 'Indiquez un lieu ou une position.',
    queued: 'Enregistré sur cet appareil', queuedHelp: 'En attente d’envoi. Conservez les données du navigateur jusqu’à la confirmation.',
    received: 'Signalement reçu', receivedHelp: 'Un agent vérifiera le signalement. Il ne confirme pas un incendie.',
    reference: 'Référence', retry: 'Réessayer', again: 'Faire un autre signalement',
    gpsFailed: 'Position indisponible. Indiquez un lieu ou utilisez la carte.',
  },
  ar: {
    title: 'الإبلاغ عن حريق محتمل', lead: 'يساعد بلاغك فرق الاستجابة على التحقق. لا تحتاج إلى حساب.',
    danger: 'إذا كان أشخاص في خطر مباشر، اتصل بالطوارئ وانتقل إلى مكان آمن قبل التقاط صورة.',
    seen: 'ماذا ترى؟', fire: 'لهب أو حريق', smoke: 'دخان', unsure: 'لست متأكداً',
    where: 'أين؟', gps: 'استخدم موقعي', landmark: 'مكان أو معلم قريب',
    landmarkHelp: 'قرية أو طريق أو غابة أو معلم معروف.',
    gpsQuestion: 'هل هذا موقع الحريق أم مكان وقوفك؟',
    firePosition: 'الحريق هنا', observerPosition: 'أراقبه من هنا',
    approximate: 'منطقة تقريبية', adjust: 'حدد الموقع على الخريطة', hide: 'إخفاء الخريطة',
    detail: 'تفاصيل إضافية (اختياري)', photo: 'صورة (اختياري)', contact: 'رقم هاتف للمتابعة (اختياري)',
    send: 'إرسال البلاغ', sending: 'جارٍ الحفظ…', locationRequired: 'أدخل مكاناً أو حدد موقعاً.',
    queued: 'تم الحفظ على هذا الجهاز', queuedHelp: 'البلاغ في قائمة الانتظار. احتفظ ببيانات المتصفح حتى يتم الاستلام.',
    received: 'تم استلام البلاغ', receivedHelp: 'سيراجعه مسؤول. البلاغ لا يؤكد وقوع حريق.',
    reference: 'المرجع', retry: 'إعادة المحاولة', again: 'بلاغ جديد',
    gpsFailed: 'تعذر تحديد موقعك. أدخل مكاناً أو استخدم الخريطة.',
  },
} as const;

async function toBlob(dataUrl: string): Promise<Blob> {
  const [header, data] = dataUrl.split(',');
  const binary = atob(data);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: /data:([^;]+)/.exec(header)?.[1] ?? 'image/jpeg' });
}

export function PublicFireReport() {
  useEffect(() => { void registerServiceWorker(); }, []);
  const { language } = useTranslation();
  const c = copy[language as keyof typeof copy] ?? copy.en;
  const { enqueueReport, items, online, retry } = useOfflineQueue();
  const [observation, setObservation] = useState<'FIRE' | 'SMOKE' | 'UNSURE' | ''>('');
  const [locationText, setLocationText] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number; accuracyMeters?: number } | null>(null);
  const [locationBasis, setLocationBasis] = useState<'FIRE' | 'OBSERVER' | 'APPROXIMATE' | 'LANDMARK'>('LANDMARK');
  const [mapOpen, setMapOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [queuedId, setQueuedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const queued = items.find((item) => item.clientSubmissionId === queuedId);

  const getGps = () => {
    if (!navigator.geolocation) { setError(c.gpsFailed); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({ lat: position.coords.latitude, lng: position.coords.longitude, accuracyMeters: Math.max(1, position.coords.accuracy) });
        setLocationBasis('OBSERVER');
        setError('');
      },
      () => setError(c.gpsFailed),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const submit = async () => {
    if (!observation) return;
    if (!coordinates && !locationText.trim()) { setError(c.locationRequired); return; }
    setSubmitting(true);
    setError('');
    try {
      const id = await enqueueReport({
        source: 'GUEST', observation, locationBasis: coordinates ? locationBasis : 'LANDMARK',
        locationText: locationText.trim() || undefined,
        latitude: coordinates?.lat, longitude: coordinates?.lng,
        accuracyMeters: coordinates?.accuracyMeters,
        description: description.trim(), contactPhone: contactPhone.trim() || undefined,
        capturedAt: new Date().toISOString(),
      }, await Promise.all(photos.map(toBlob)));
      setQueuedId(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save report');
    } finally {
      setSubmitting(false);
    }
  };

  if (queuedId) return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-elev-1" role="status" aria-live="polite">
      <h1 className="text-2xl font-bold">{queued?.state === 'sent' ? c.received : c.queued}</h1>
      <p className="mt-2 text-muted-foreground">{queued?.state === 'sent' ? c.receivedHelp : c.queuedHelp}</p>
      {queued?.referenceNumber && <p className="mt-4 font-mono text-lg">{c.reference}: {queued.referenceNumber}</p>}
      {queued?.state === 'sent' && queued.serverReportId && queued.receipt && <Link
        href={`/report/status/${queued.serverReportId}?receipt=${encodeURIComponent(queued.receipt)}`}
        className="mt-3 inline-block text-sm font-semibold text-primary underline"
      >Check report status · Save this link</Link>}
      {queued?.state !== 'sent' && <p className="mt-2 text-sm">{online ? queued?.lastError?.message ?? 'Sending…' : 'Offline'}</p>}
      <div className="mt-5 flex flex-wrap gap-3">
        {(queued?.state === 'failed' || queued?.state === 'needs_attention') && (
          <button className="rounded-lg bg-primary px-4 py-2 text-white" onClick={() => retry(queuedId)}>{c.retry}</button>
        )}
        <button className="rounded-lg border border-border px-4 py-2" onClick={() => { setQueuedId(null); setObservation(''); setCoordinates(null); setLocationText(''); setDescription(''); setPhotos([]); }}>{c.again}</button>
      </div>
    </section>
  );

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-elev-1 sm:p-8">
      <h1 className="text-2xl font-bold sm:text-3xl">{c.title}</h1>
      <p className="mt-2 text-muted-foreground">{c.lead}</p>
      <p className="mt-5 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{c.danger}</p>
      <div className="mt-6 space-y-6">
        <fieldset>
          <legend className="mb-3 font-semibold">1. {c.seen}</legend>
          <div className="grid grid-cols-3 gap-2">
            {([['FIRE', c.fire], ['SMOKE', c.smoke], ['UNSURE', c.unsure]] as const).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={observation === value} onClick={() => setObservation(value)}
                className={`min-h-14 rounded-xl border px-2 text-sm font-semibold ${observation === value ? 'border-primary bg-primary-muted text-primary' : 'border-border'}`}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-3 font-semibold">2. {c.where}</legend>
          <button type="button" onClick={getGps} className="rounded-xl border border-border px-4 py-3 text-sm font-semibold">{c.gps}</button>
          {coordinates && <div className="mt-3 rounded-xl bg-muted p-3 text-sm">
            <p>{coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}{coordinates.accuracyMeters && ` · ±${Math.round(coordinates.accuracyMeters)} m`}</p>
            <p className="mt-2 font-medium">{c.gpsQuestion}</p>
            <label className="mt-2 block"><input type="radio" checked={locationBasis === 'FIRE'} onChange={() => setLocationBasis('FIRE')} /> {c.firePosition}</label>
            <label className="mt-2 block"><input type="radio" checked={locationBasis === 'OBSERVER'} onChange={() => setLocationBasis('OBSERVER')} /> {c.observerPosition}</label>
            <label className="mt-2 block"><input type="radio" checked={locationBasis === 'APPROXIMATE'} onChange={() => setLocationBasis('APPROXIMATE')} /> {c.approximate}</label>
          </div>}
          <label className="mt-4 block text-sm font-medium" htmlFor="report-landmark">{c.landmark}</label>
          <input id="report-landmark" value={locationText} onChange={(event) => setLocationText(event.target.value)} maxLength={300}
            className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3" />
          <p className="mt-1 text-xs text-muted-foreground">{c.landmarkHelp}</p>
          <button type="button" className="mt-3 text-sm font-semibold text-primary underline" onClick={() => setMapOpen(!mapOpen)}>{mapOpen ? c.hide : c.adjust}</button>
          {mapOpen && <div className="mt-3 overflow-hidden rounded-xl"><LocationPicker expanded selectedLocation={coordinates ?? undefined}
            onLocationSelect={(lat, lng) => { setCoordinates({ lat, lng }); setLocationBasis('FIRE'); }} /></div>}
        </fieldset>
        <div>
          <label htmlFor="report-detail" className="block font-semibold">{c.detail}</label>
          <textarea id="report-detail" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={3}
            className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3" />
        </div>
        <div><p className="mb-2 font-semibold">{c.photo}</p><PhotoUpload images={photos} onChange={setPhotos} /></div>
        <div><label htmlFor="report-contact" className="block font-semibold">{c.contact}</label>
          <input id="report-contact" type="tel" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} maxLength={40}
            className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3" /></div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button type="button" disabled={!observation || submitting} onClick={submit}
          className="min-h-14 w-full rounded-xl bg-primary px-5 py-3 font-semibold text-white disabled:opacity-50">
          {submitting ? c.sending : c.send}
        </button>
      </div>
    </section>
  );
}
