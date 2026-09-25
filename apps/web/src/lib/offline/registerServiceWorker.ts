/**
 * Registers public/sw.js. Runs in production, or in any environment when
 * NEXT_PUBLIC_ENABLE_SW=true (useful for testing the offline flow locally).
 */

export type UpdateAvailableCallback = (registration: ServiceWorkerRegistration) => void;

function shouldRegister(): boolean {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;
  if (process.env.NEXT_PUBLIC_ENABLE_SW === 'true') return true;
  return process.env.NODE_ENV === 'production';
}

let registrationPromise: Promise<ServiceWorkerRegistration | undefined> | null = null;

/**
 * Registers the service worker (idempotent — safe to call from multiple
 * components). When an update is found and finishes installing while an
 * existing controller is active, `onUpdateAvailable` is called so the app
 * can prompt the user before calling `activateUpdate()`.
 */
export function registerServiceWorker(onUpdateAvailable?: UpdateAvailableCallback): Promise<ServiceWorkerRegistration | undefined> {
  if (!shouldRegister()) return Promise.resolve(undefined);

  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              onUpdateAvailable?.(registration);
            }
          });
        });
        return registration;
      })
      .catch(() => undefined);
  }
  return registrationPromise;
}

/** Tells a waiting service worker to activate immediately, then reloads once it takes control. */
export function activateUpdate(registration: ServiceWorkerRegistration): void {
  const waiting = registration.waiting;
  if (!waiting) return;

  const onControllerChange = () => {
    navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    window.location.reload();
  };
  navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
  waiting.postMessage({ type: 'skipWaiting' });
}
