'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from '@/hooks/useTranslation';
import { AuthShell } from '@/components/auth/AuthShell';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { getApiErrorUserMessage, getApiFieldErrors } from '@/lib/errors/sdk';

export default function SignInPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const { t, language } = useTranslation();

  // Prefetch the map page so navigation after signin is instant
  React.useEffect(() => { router.prefetch('/map'); }, [router]);
  const [formData, setFormData] = React.useState({
    cin: '',
    password: '',
  });
  const [error, setError] = React.useState('');
  const [fieldErrors, setFieldErrors] = React.useState<{ cin?: string; password?: string }>({});
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const nextErrors: { cin?: string; password?: string } = {};
    const cinValue = formData.cin.trim();
    const passwordValue = formData.password;
    const cinLooksValid = /^[A-Za-z]{1,2}\d{3,10}$/.test(cinValue);

    if (!cinValue) nextErrors.cin = t('requiredField');
    else if (!cinLooksValid) nextErrors.cin = t('invalidCin');

    if (!passwordValue) nextErrors.password = t('requiredField');

    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cin: cinValue, password: passwordValue }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(getApiErrorUserMessage(data, t('loginError')));
        const apiFields = getApiFieldErrors(data);
        if (apiFields.length) {
          const next: { cin?: string; password?: string } = {};
          for (const f of apiFields) {
            const msg =
              f.message ??
              (f.code === 'required' ? t('requiredField') : f.code === 'invalid' ? t('invalidCin') : t('errorValidationFailed'));
            if (f.field === 'cin') next.cin = msg;
            if (f.field === 'password') next.password = msg;
          }
          setFieldErrors(next);
        }
        return;
      }

      // Store user in zustand so AuthProvider skips the /api/auth/me check,
      // then navigate.  The cookie is already set by the response headers.
      setUser(data.user);
      router.replace('/map');

      // Fallback: if the soft navigation didn't leave the page within 2 s
      // (stale Router Cache, prefetch race, etc.), force a hard navigation
      // which will pick up the auth cookie and hydrate through AuthProvider.
      await new Promise((r) => setTimeout(r, 2000));
      if (typeof window !== 'undefined' && window.location.pathname !== '/map') {
        window.location.href = '/map';
      }
    } catch {
      setError(t('connectionError'));
    } finally {
      setLoading(false);
    }
  };

  const isRTL = language === 'ar';

  return (
    <AuthShell
      title={t('signIn')}
      subtitle={t('appSubtitle')}
      isRTL={isRTL}
      footer={
        <div className={isRTL ? 'text-right' : 'text-left'}>
          <span>{t('noAccount')} </span>
          <Link href="/signup" className="font-semibold text-primary underline-offset-4 hover:underline">
            {t('createAccount')}
          </Link>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error ? (
          <div role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        ) : null}

        <TextField
          id="signin-cin"
          label={t('cin')}
          leadingIcon="id"
          placeholder="AB123456"
          helperText={t('cinHelper')}
          errorText={fieldErrors.cin}
          value={formData.cin}
          onChange={(e) => {
            const v = e.target.value;
            setFormData((s) => ({ ...s, cin: v }));
            if (fieldErrors.cin) setFieldErrors((s) => ({ ...s, cin: undefined }));
          }}
          required
          dir="ltr"
          autoComplete="username"
          inputMode="text"
        />

        <TextField
          id="signin-password"
          label={t('password')}
          leadingIcon="key"
          type="password"
          placeholder="••••••••"
          helperText={t('passwordHelper')}
          errorText={fieldErrors.password}
          value={formData.password}
          onChange={(e) => {
            const v = e.target.value;
            setFormData((s) => ({ ...s, password: v }));
            if (fieldErrors.password) setFieldErrors((s) => ({ ...s, password: undefined }));
          }}
          required
          autoComplete="current-password"
        />

        <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={loading}>
          {loading ? t('loggingIn') : t('signIn')}
        </Button>
      </form>
    </AuthShell>
  );
}
