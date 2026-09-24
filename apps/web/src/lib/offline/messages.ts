/**
 * Translation strings for the offline queue UI.
 *
 * Deliberately NOT merged into src/i18n/translations.ts (that file is owned
 * by another agent). Consume via `useOfflineMessages()` below, which reads
 * the current language from the same useLanguageStore the rest of the app
 * uses, so it stays in sync with the app's language switcher.
 */
'use client';

import { useLanguageStore } from '@/store/useLanguageStore';

export const offlineMessages = {
  en: {
    online: 'Online',
    offline: 'Offline',
    pendingCount: '{count} pending',
    noPending: 'All synced',
    syncNow: 'Sync now',
    syncing: 'Syncing…',
    lastSynced: 'Last synced {time}',
    neverSynced: 'Not synced yet',
    queueTitle: 'Offline queue',
    queueEmpty: 'Nothing queued. New reports you submit offline will show up here.',
    stateSaved: 'Saved',
    statePending: 'Pending',
    stateSent: 'Sent',
    stateFailed: 'Failed',
    stateNeedsAttention: 'Needs attention',
    retry: 'Retry',
    edit: 'Edit',
    discard: 'Discard',
    discardConfirmTitle: 'Discard this report?',
    discardConfirmBody: 'This queued report and its photos will be permanently deleted from this device. This cannot be undone.',
    discardConfirmAction: 'Discard permanently',
    cancel: 'Cancel',
    close: 'Close',
    referenceNumber: 'Reference {number}',
    errorSignInAgain: 'Sign in again to send this report.',
    errorValidation: 'The server rejected this report — check the details and try again.',
    errorNetwork: 'Could not reach the server. It will retry automatically.',
    errorGeneric: 'Something went wrong sending this report.',
    photosUploading: '{done}/{total} photos uploaded',
    queuedAt: 'Queued {time}',
    sentAt: 'Sent {time}',
    ariaSyncStatus: 'Sync status: {status}',
    offlinePageTitle: "You're offline",
    offlinePageBody:
      'This page needs a connection you don\'t have right now. Reports you save are kept on this device and will send automatically once you\'re back online.',
    offlinePageRetry: 'Try again',
    offlinePageGoQueue: 'View offline queue',
  },
  fr: {
    online: 'En ligne',
    offline: 'Hors ligne',
    pendingCount: '{count} en attente',
    noPending: 'Tout est synchronisé',
    syncNow: 'Synchroniser',
    syncing: 'Synchronisation…',
    lastSynced: 'Dernière synchro {time}',
    neverSynced: 'Pas encore synchronisé',
    queueTitle: 'File hors ligne',
    queueEmpty: 'Aucun signalement en attente. Les signalements envoyés hors ligne apparaîtront ici.',
    stateSaved: 'Enregistré',
    statePending: 'En attente',
    stateSent: 'Envoyé',
    stateFailed: 'Échec',
    stateNeedsAttention: 'Action requise',
    retry: 'Réessayer',
    edit: 'Modifier',
    discard: 'Supprimer',
    discardConfirmTitle: 'Supprimer ce signalement ?',
    discardConfirmBody:
      'Ce signalement en attente et ses photos seront définitivement supprimés de cet appareil. Cette action est irréversible.',
    discardConfirmAction: 'Supprimer définitivement',
    cancel: 'Annuler',
    close: 'Fermer',
    referenceNumber: 'Référence {number}',
    errorSignInAgain: 'Reconnectez-vous pour envoyer ce signalement.',
    errorValidation: 'Le serveur a rejeté ce signalement — vérifiez les informations et réessayez.',
    errorNetwork: 'Impossible de joindre le serveur. Nouvelle tentative automatique.',
    errorGeneric: "Une erreur est survenue lors de l'envoi de ce signalement.",
    photosUploading: '{done}/{total} photos envoyées',
    queuedAt: 'Mis en attente {time}',
    sentAt: 'Envoyé {time}',
    ariaSyncStatus: 'État de synchronisation : {status}',
    offlinePageTitle: 'Vous êtes hors ligne',
    offlinePageBody:
      "Cette page nécessite une connexion indisponible pour le moment. Les signalements enregistrés restent sur cet appareil et seront envoyés automatiquement une fois la connexion rétablie.",
    offlinePageRetry: 'Réessayer',
    offlinePageGoQueue: 'Voir la file hors ligne',
  },
  ar: {
    online: 'متصل',
    offline: 'غير متصل',
    pendingCount: '{count} في الانتظار',
    noPending: 'تمت مزامنة الكل',
    syncNow: 'مزامنة الآن',
    syncing: 'جارٍ المزامنة…',
    lastSynced: 'آخر مزامنة {time}',
    neverSynced: 'لم تتم المزامنة بعد',
    queueTitle: 'قائمة الانتظار دون اتصال',
    queueEmpty: 'لا توجد بلاغات في الانتظار. ستظهر هنا البلاغات المرسلة دون اتصال.',
    stateSaved: 'محفوظ',
    statePending: 'قيد الانتظار',
    stateSent: 'أُرسل',
    stateFailed: 'فشل',
    stateNeedsAttention: 'يتطلب انتباه',
    retry: 'إعادة المحاولة',
    edit: 'تعديل',
    discard: 'حذف',
    discardConfirmTitle: 'هل تريد حذف هذا البلاغ؟',
    discardConfirmBody: 'سيتم حذف هذا البلاغ وصوره نهائياً من هذا الجهاز. لا يمكن التراجع عن هذا الإجراء.',
    discardConfirmAction: 'حذف نهائي',
    cancel: 'إلغاء',
    close: 'إغلاق',
    referenceNumber: 'الرقم المرجعي {number}',
    errorSignInAgain: 'يرجى تسجيل الدخول مجدداً لإرسال هذا البلاغ.',
    errorValidation: 'رفض الخادم هذا البلاغ — يرجى التحقق من البيانات والمحاولة مجدداً.',
    errorNetwork: 'تعذر الوصول إلى الخادم. ستتم إعادة المحاولة تلقائياً.',
    errorGeneric: 'حدث خطأ أثناء إرسال هذا البلاغ.',
    photosUploading: 'تم رفع {done}/{total} صور',
    queuedAt: 'أُضيف إلى الانتظار {time}',
    sentAt: 'أُرسل {time}',
    ariaSyncStatus: 'حالة المزامنة: {status}',
    offlinePageTitle: 'أنت غير متصل',
    offlinePageBody:
      'تحتاج هذه الصفحة إلى اتصال غير متوفر حالياً. تُحفظ البلاغات على هذا الجهاز وستُرسل تلقائياً عند عودة الاتصال.',
    offlinePageRetry: 'إعادة المحاولة',
    offlinePageGoQueue: 'عرض قائمة الانتظار',
  },
} as const;

export type OfflineMessageKey = keyof typeof offlineMessages.en;
type OfflineLocale = keyof typeof offlineMessages;

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = vars[key];
    return value === undefined ? match : String(value);
  });
}

export function translateOffline(
  locale: OfflineLocale,
  key: OfflineMessageKey,
  vars?: Record<string, string | number>
): string {
  const bucket = offlineMessages[locale] ?? offlineMessages.fr;
  const template = (bucket as Record<string, string>)[key] ?? offlineMessages.en[key] ?? key;
  return interpolate(template, vars);
}

/** Same locale source as useTranslation() (useLanguageStore), scoped to the offline queue's own strings. */
export function useOfflineMessages() {
  const language = useLanguageStore((s) => s.language) as OfflineLocale;
  const t = (key: OfflineMessageKey, vars?: Record<string, string | number>) => translateOffline(language, key, vars);
  return { t, language };
}
