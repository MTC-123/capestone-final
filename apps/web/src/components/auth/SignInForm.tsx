'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { PasswordField, TextField } from '@/components/ui/TextField';
import { getApiErrorUserMessage } from '@/lib/errors/sdk';

const CIN_PATTERN = /^[A-Za-z]{1,2}\d{3,7}$/;

/** Only same-origin, absolute-path redirects are honoured after sign-in. */
export function safeNext(next: string | undefined, fallback: string) {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/api') ? next : fallback;
}

export function SignInForm({ demoMode, next }: { demoMode: boolean; next?: string }) {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const { t } = useTranslation();
  const [cin, setCin] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [fieldErrors, setFieldErrors] = React.useState<{ cin?: string; password?: string }>({});
  const [loading, setLoading] = React.useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const errors: typeof fieldErrors = {};
    const cinValue = cin.trim().toUpperCase();
    if (!cinValue) errors.cin = t('requiredField');
    else if (!CIN_PATTERN.test(cinValue)) errors.cin = t('authCinInvalid');
    if (!password) errors.password = t('requiredField');
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setLoading(true);
    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cin: cinValue, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const code = (data as { error?: { code?: number } })?.error?.code;
        setError(code === 2004 ? t('authLocked') : getApiErrorUserMessage(data, t('loginError')));
        return;
      }
      setUser(data.user);
      import('@/lib/offline/sync').then((m) => m.resumeAfterAuth?.()).catch(() => undefined);
      const destination = safeNext(next, data.user?.role === 'OFFICIAL' ? '/map' : '/report');
      router.replace(destination);
      router.refresh();
    } catch {
      setError(t('connectionError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-[1.75rem] font-semibold tracking-tight">{t('authWelcomeBack')}</h1>
      <p className="mt-1.5 text-[15px] text-muted-foreground">{t('authSigninLead')}</p>

      {demoMode && (
        <section aria-labelledby="demo-title" className="mt-7 rounded-2xl border border-primary/25 bg-primary/[0.06] p-4">
          <div className="flex items-center gap-2">
            <Icon name="sparkles" size={16} className="text-primary" />
            <h2 id="demo-title" className="text-sm font-semibold">
              {t('authDemoTitle')}
            </h2>
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">{t('authDemoBody')}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <a
              href="/demo/map?as=official"
              className="group rounded-xl border border-border bg-surface p-3 transition hover:border-primary/40 hover:shadow-elev-1"
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Icon name="shieldCheck" size={16} className="text-primary" />
                {t('authDemoOfficial')}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{t('authDemoOfficialHint')}</span>
            </a>
            <a
              href="/demo/map?as=civilian"
              className="group rounded-xl border border-border bg-surface p-3 transition hover:border-accent-fire/40 hover:shadow-elev-1"
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Icon name="user" size={16} className="text-accent-fire" />
                {t('authDemoCivilian')}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{t('authDemoCivilianHint')}</span>
            </a>
          </div>
        </section>
      )}

      {demoMode && (
        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          {t('authOr')}
          <span className="h-px flex-1 bg-border" />
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className={demoMode ? 'space-y-4' : 'mt-8 space-y-4'}>
        {error && (
          <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger-muted px-3.5 py-3 text-sm text-danger-foreground">
            <Icon name="warning" size={16} className="mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <TextField
          id="signin-cin"
          label={t('cin')}
          leadingIcon="id"
          placeholder="AB123456"
          value={cin}
          onChange={(e) => {
            setCin(e.target.value);
            if (fieldErrors.cin) setFieldErrors((s) => ({ ...s, cin: undefined }));
          }}
          errorText={fieldErrors.cin}
          autoComplete="username"
          autoCapitalize="characters"
          spellCheck={false}
          dir="ltr"
          required
        />
        <PasswordField
          id="signin-password"
          label={t('password')}
          leadingIcon="key"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (fieldErrors.password) setFieldErrors((s) => ({ ...s, password: undefined }));
          }}
          errorText={fieldErrors.password}
          autoComplete="current-password"
          revealLabel={t('authShowPassword')}
          concealLabel={t('authHidePassword')}
          required
        />
        <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={loading}>
          {loading ? t('loggingIn') : t('signIn')}
          {!loading && <Icon name="arrowRight" size={16} className="rtl:rotate-180" />}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        {t('noAccount')}{' '}
        <Link href="/signup" className="font-semibold text-primary underline-offset-4 hover:underline">
          {t('createAccount')}
        </Link>
      </p>
    </div>
  );
}
