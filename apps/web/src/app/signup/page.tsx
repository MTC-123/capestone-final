'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from '@/hooks/useTranslation';
import { DEPARTMENTS, getDepartmentName } from '@/config/constants';
import { AuthShell } from '@/components/auth/AuthShell';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { getApiErrorCode, getApiErrorUserMessage, getApiFieldErrors } from '@/lib/errors/sdk';

export default function SignUpPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const { t, language } = useTranslation();

  // Prefetch the map page so navigation after signup is instant
  React.useEffect(() => { router.prefetch('/map'); }, [router]);
  const [formData, setFormData] = React.useState({
    cin: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'CIVILIAN' as 'CIVILIAN' | 'OFFICIAL',
    department: '',
    position: '',
  });
  const [error, setError] = React.useState('');
  const [fieldErrors, setFieldErrors] = React.useState<{
    cin?: string;
    phone?: string;
    password?: string;
    confirmPassword?: string;
    department?: string;
  }>({});
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const nextErrors: typeof fieldErrors = {};
    const cinValue = formData.cin.trim();
    const phoneValue = formData.phone.trim();
    const passwordValue = formData.password;
    const confirmPasswordValue = formData.confirmPassword;

    const cinLooksValid = /^[A-Za-z]{1,2}\d{3,10}$/.test(cinValue);
    const phoneLooksValid = /^\+\d{10,15}$/.test(phoneValue);

    if (!cinValue) nextErrors.cin = t('requiredField');
    else if (!cinLooksValid) nextErrors.cin = t('invalidCin');

    if (!phoneValue) nextErrors.phone = t('requiredField');
    else if (!phoneLooksValid) nextErrors.phone = t('invalidPhone');

    if (!passwordValue) nextErrors.password = t('requiredField');
    else if (passwordValue.length < 8) nextErrors.password = t('passwordHelper');

    if (!confirmPasswordValue) nextErrors.confirmPassword = t('requiredField');
    else if (passwordValue !== confirmPasswordValue) nextErrors.confirmPassword = t('passwordsDontMatch');

    if (formData.role === 'OFFICIAL' && !formData.department) nextErrors.department = t('selectDepartmentError');

    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cin: cinValue,
          phone: phoneValue,
          password: passwordValue,
          role: formData.role,
          department: formData.department || undefined,
          position: formData.position || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorCode = getApiErrorCode(data);
        if (errorCode === 3001) {
          setError(t('errorUserExists'));
          setFieldErrors({ cin: t('errorUserExists') });
          return;
        }
        setError(getApiErrorUserMessage(data, t('signupError')));
        const apiFields = getApiFieldErrors(data);
        if (apiFields.length) {
          const next: typeof fieldErrors = {};
          for (const f of apiFields) {
            const msg =
              f.message ??
              (f.code === 'required'
                ? t('requiredField')
                : f.code === 'invalid'
                  ? t('errorValidationFailed')
                  : t('errorValidationFailed'));
            if (f.field === 'department') next.department = msg;
            if (f.field === 'cin') next.cin = msg;
            if (f.field === 'phone') next.phone = msg;
            if (f.field === 'password') next.password = msg;
            if (f.field === 'confirmPassword') next.confirmPassword = msg;
          }
          setFieldErrors(next);
        }
        return;
      }

      // Auto sign-in: store user in zustand so AuthProvider skips /api/auth/me,
      // then navigate.  The cookie is already set by the response headers.
      setUser(data.user);
      router.replace('/map');

      // Fallback: if the soft navigation didn't leave the page within 2 s
      // (stale Router Cache, prefetch race, etc.), force a hard navigation.
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
  const departmentOptions = React.useMemo(
    () => [
      { value: '', label: t('selectDepartment'), disabled: true },
      ...Object.keys(DEPARTMENTS).map((code) => ({
        value: code,
        label: `${getDepartmentName(code as keyof typeof DEPARTMENTS, language)} (${code})`,
      })),
    ],
    [language, t]
  );

  return (
    <AuthShell
      title={t('createNewAccount')}
      subtitle={t('joinSystem')}
      isRTL={isRTL}
      footer={
        <div className={isRTL ? 'text-right' : 'text-left'}>
          <span>{t('haveAccount')} </span>
          <Link href="/signin" className="font-semibold text-primary underline-offset-4 hover:underline">
            {t('signIn')}
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
          id="signup-cin"
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
          id="signup-phone"
          label={t('phone')}
          leadingIcon="phone"
          type="tel"
          placeholder="+212612345678"
          helperText={t('phoneHelper')}
          errorText={fieldErrors.phone}
          value={formData.phone}
          onChange={(e) => {
            const v = e.target.value;
            setFormData((s) => ({ ...s, phone: v }));
            if (fieldErrors.phone) setFieldErrors((s) => ({ ...s, phone: undefined }));
          }}
          required
          dir="ltr"
          autoComplete="tel"
          inputMode="tel"
        />

        <TextField
          id="signup-password"
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
          autoComplete="new-password"
        />

        <TextField
          id="signup-confirm-password"
          label={t('confirmPassword')}
          leadingIcon="key"
          type="password"
          placeholder="••••••••"
          errorText={fieldErrors.confirmPassword}
          value={formData.confirmPassword}
          onChange={(e) => {
            const v = e.target.value;
            setFormData((s) => ({ ...s, confirmPassword: v }));
            if (fieldErrors.confirmPassword) setFieldErrors((s) => ({ ...s, confirmPassword: undefined }));
          }}
          required
          autoComplete="new-password"
        />

        <SelectField
          id="signup-role"
          label={t('accountType')}
          leadingIcon="list"
          value={formData.role}
          onChange={(e) => {
            const nextRole = e.target.value as 'CIVILIAN' | 'OFFICIAL';
            setFormData((v) => ({
              ...v,
              role: nextRole,
              department: nextRole === 'OFFICIAL' ? v.department : '',
              position: nextRole === 'OFFICIAL' ? v.position : '',
            }));
            if (fieldErrors.department && nextRole !== 'OFFICIAL') {
              setFieldErrors((s) => ({ ...s, department: undefined }));
            }
          }}
          options={[
            { value: 'CIVILIAN', label: t('civilian') },
            { value: 'OFFICIAL', label: t('official') },
          ]}
        />

        {formData.role === 'OFFICIAL' ? (
          <>
            <SelectField
              id="signup-department"
              label={t('department')}
              leadingIcon="list"
              value={formData.department}
              errorText={fieldErrors.department}
              onChange={(e) => {
                const v = e.target.value;
                setFormData((s) => ({ ...s, department: v }));
                if (fieldErrors.department) setFieldErrors((s) => ({ ...s, department: undefined }));
              }}
              options={departmentOptions}
              required
            />

            <TextField
              id="signup-position"
              label={t('positionOptional')}
              placeholder={t('positionPlaceholder')}
              value={formData.position}
              onChange={(e) => setFormData((v) => ({ ...v, position: e.target.value }))}
              autoComplete="organization-title"
            />
          </>
        ) : null}

        <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={loading}>
          {loading ? t('creatingAccount') : t('createAccount')}
        </Button>
      </form>
    </AuthShell>
  );
}
