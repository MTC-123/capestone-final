'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from '@/hooks/useTranslation';
import { DEPARTMENTS, getDepartmentName } from '@/config/constants';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { SelectField } from '@/components/ui/SelectField';
import { PasswordField, TextField } from '@/components/ui/TextField';
import { getApiErrorCode, getApiErrorUserMessage, getApiFieldErrors } from '@/lib/errors/sdk';

type Fields = 'cin' | 'phone' | 'password' | 'fullName' | 'email' | 'department';

const CIN_PATTERN = /^[A-Za-z]{1,2}\d{3,7}$/;
const PHONE_PATTERN = /^(\+212|0)[5-7]\d{8}$/;

export function SignUpForm() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const { t, language } = useTranslation();
  const [form, setForm] = React.useState({
    fullName: '',
    cin: '',
    phone: '',
    email: '',
    password: '',
    agency: false,
    department: '',
    position: '',
    justification: '',
  });
  const [errors, setErrors] = React.useState<Partial<Record<Fields, string>>>({});
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const next: Partial<Record<Fields, string>> = {};
    if (!form.cin.trim()) next.cin = t('requiredField');
    else if (!CIN_PATTERN.test(form.cin.trim())) next.cin = t('authCinInvalid');
    const phone = form.phone.replace(/[\s.-]/g, '');
    if (!phone) next.phone = t('requiredField');
    else if (!PHONE_PATTERN.test(phone)) next.phone = t('authPhoneInvalid');
    if (form.password.length < 8) next.password = t('authPasswordTooShort');
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = t('authEmailInvalid');
    if (form.agency && !form.department) next.department = t('selectDepartmentError');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cin: form.cin.trim(),
          phone: form.phone,
          password: form.password,
          fullName: form.fullName.trim() || undefined,
          email: form.email.trim() || undefined,
          requestOfficial: form.agency
            ? {
                department: form.department,
                position: form.position.trim() || undefined,
                justification: form.justification.trim() || undefined,
              }
            : undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (getApiErrorCode(data) === 3001) {
          setErrors({ cin: t('authCinTaken') });
          return;
        }
        const fieldMap: Partial<Record<Fields, string>> = {};
        for (const f of getApiFieldErrors(data)) {
          const key = f.field.split('.').pop() as Fields;
          fieldMap[key] =
            f.code === 'invalid_cin'
              ? t('authCinInvalid')
              : f.code === 'invalid_phone'
                ? t('authPhoneInvalid')
                : f.code === 'too_short'
                  ? t('authPasswordTooShort')
                  : f.code === 'invalid_email'
                    ? t('authEmailInvalid')
                    : t('errorValidationFailed');
        }
        setErrors(fieldMap);
        setError(getApiErrorUserMessage(data, t('signupError')));
        return;
      }
      setUser(data.user);
      router.replace(data.officialRequest ? '/report?request=pending' : '/report');
      router.refresh();
    } catch {
      setError(t('connectionError'));
    } finally {
      setLoading(false);
    }
  };

  const departmentOptions = [
    { value: '', label: t('selectDepartment'), disabled: true },
    ...Object.keys(DEPARTMENTS).map((code) => ({
      value: code,
      label: `${getDepartmentName(code as keyof typeof DEPARTMENTS, language)} (${code})`,
    })),
  ];

  return (
    <div>
      <h1 className="text-[1.75rem] font-semibold tracking-tight">{t('authCreateTitle')}</h1>
      <p className="mt-1.5 text-[15px] text-muted-foreground">{t('authCreateLead')}</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
        {error && (
          <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger-muted px-3.5 py-3 text-sm text-danger-foreground">
            <Icon name="warning" size={16} className="mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <TextField id="signup-name" label={t('authFullName')} leadingIcon="user" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} autoComplete="name" errorText={errors.fullName} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="signup-cin"
            label={t('cin')}
            leadingIcon="id"
            placeholder="AB123456"
            value={form.cin}
            onChange={(e) => set('cin', e.target.value)}
            errorText={errors.cin}
            autoCapitalize="characters"
            spellCheck={false}
            dir="ltr"
            required
          />
          <TextField
            id="signup-phone"
            label={t('phone')}
            leadingIcon="phone"
            placeholder="06 12 34 56 78"
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            errorText={errors.phone}
            autoComplete="tel"
            dir="ltr"
            required
          />
        </div>
        <TextField
          id="signup-email"
          label={t('authEmailOptional')}
          type="email"
          inputMode="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          helperText={t('authEmailHelp')}
          errorText={errors.email}
          autoComplete="email"
          dir="ltr"
        />
        <PasswordField
          id="signup-password"
          label={t('password')}
          leadingIcon="key"
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
          helperText={t('authPasswordRule')}
          errorText={errors.password}
          autoComplete="new-password"
          revealLabel={t('authShowPassword')}
          concealLabel={t('authHidePassword')}
          required
        />

        <div className="rounded-xl border border-border bg-surface-2/60 p-3.5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={form.agency}
              onChange={(e) => set('agency', e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-[hsl(var(--primary))]"
            />
            <span className="text-sm">
              <span className="font-medium">{t('authAgencyToggle')}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{t('authAgencyExplain')}</span>
            </span>
          </label>
          {form.agency && (
            <div className="mt-4 space-y-3 border-t border-border pt-4 animate-slide-down">
              <SelectField
                id="signup-department"
                label={t('department')}
                leadingIcon="building"
                options={departmentOptions}
                value={form.department}
                onChange={(e) => set('department', e.target.value)}
                errorText={errors.department}
                required
              />
              <TextField id="signup-position" label={t('position')} value={form.position} onChange={(e) => set('position', e.target.value)} />
              <TextField
                id="signup-justification"
                label={t('authAgencyJustification')}
                value={form.justification}
                onChange={(e) => set('justification', e.target.value)}
              />
            </div>
          )}
        </div>

        <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={loading}>
          {loading ? t('creatingAccount') : t('authCreateTitle')}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        {t('authHaveAccount')}{' '}
        <Link href="/signin" className="font-semibold text-primary underline-offset-4 hover:underline">
          {t('signIn')}
        </Link>
      </p>
    </div>
  );
}
