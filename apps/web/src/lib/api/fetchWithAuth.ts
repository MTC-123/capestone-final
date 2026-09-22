/**
 * Authenticated fetch wrapper with automatic token refresh.
 * Detects 401 responses, refreshes the access token, and retries.
 * Deduplicates concurrent refresh attempts via a shared promise.
 *
 * NOTE: This function never performs hard redirects.  Callers (e.g.
 * AuthProvider) are responsible for navigating to /signin when a 401
 * cannot be recovered.  Doing `window.location.href` here used to cause
 * a race where the hard reload wiped the zustand store before the
 * AuthProvider had a chance to read the freshly-set user.
 */

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/token', { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

function getRefreshPromise(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);

  if (response.status === 401) {
    const refreshed = await getRefreshPromise();

    if (refreshed) {
      // Retry the original request with fresh token
      return fetch(input, init);
    }

    // Refresh failed — return the 401 so the caller can decide what to do.
    // The AuthProvider detects the missing user and redirects to /signin.
  }

  return response;
}
