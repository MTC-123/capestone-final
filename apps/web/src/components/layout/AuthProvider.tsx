'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useAuthRefresh } from '@/hooks/useAuthRefresh';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import type { User } from '@/types';

function FrameSkeleton() {
  return (
    <div className="min-h-dvh bg-background" role="status" aria-live="polite" aria-busy="true">
      <div className="h-14 border-b border-border bg-surface/60" />
      <div className="mx-auto max-w-6xl space-y-4 p-6">
        <div className="h-7 w-56 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted/70" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-xl bg-muted/60" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export default function AuthProvider({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  initialUser?: User | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const seeded = useRef(false);
  // Seed the store on the client only: on the server the store module is
  // shared between requests, so the user is read from props there instead.
  if (!seeded.current && typeof window !== 'undefined') {
    seeded.current = true;
    if (initialUser && !useAuthStore.getState().user) {
      useAuthStore.setState({ user: initialUser, isLoading: false });
    }
  }
  const user = useAuthStore((s) => s.user) ?? initialUser;
  const isLoading = useAuthStore((s) => s.isLoading) && !user;
  const { setUser, setLoading } = useAuthStore.getState();
  useAuthRefresh();

  useEffect(() => {
    if (user) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetchWithAuth('/api/auth/me');
        if (controller.signal.aborted) return;
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          router.replace(`/signin?next=${encodeURIComponent(pathname)}`);
        }
      } catch {
        if (!controller.signal.aborted) router.replace(`/signin?next=${encodeURIComponent(pathname)}`);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [router, pathname, user, setUser, setLoading]);

  if (isLoading || !user) return <FrameSkeleton />;
  return <>{children}</>;
}
