'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { Icon } from '@/components/ui/Icon';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuthRefresh } from '@/hooks/useAuthRefresh';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, isLoading, setUser, setLoading } = useAuthStore();
  useAuthRefresh();

  useEffect(() => {
    // If user is already in the store (e.g. just signed up/in), skip the API call
    if (user) {
      setLoading(false);
      return;
    }

    // AbortController ensures StrictMode's double-mount doesn't race two
    // checkAuth calls — the first is aborted before the second starts.
    const controller = new AbortController();

    const checkAuth = async () => {
      try {
        const response = await fetchWithAuth('/api/auth/me');
        if (controller.signal.aborted) return;

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          router.replace('/signin');
        }
      } catch {
        if (controller.signal.aborted) return;
        router.replace('/signin');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    checkAuth();

    return () => controller.abort();
  }, [router, user, setUser, setLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-4 rounded-lg border border-border bg-surface px-5 py-4 shadow-elev-1"
        >
          <div className="grid h-10 w-10 place-items-center rounded-md bg-primary text-primary-foreground shadow-sm">
            <Icon name="fire" aria-hidden={true} size={20} />
          </div>
          <div className="text-sm font-semibold text-muted-foreground">{t('loading')}</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
