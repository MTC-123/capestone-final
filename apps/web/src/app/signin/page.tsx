import type { Metadata } from 'next';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { SignInForm } from '@/components/auth/SignInForm';
import { isDemoMode } from '@/lib/demo';

export const metadata: Metadata = { title: 'Sign in' };

export default function SignInPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <AuthLayout>
      <SignInForm demoMode={isDemoMode()} next={searchParams.next} />
    </AuthLayout>
  );
}
