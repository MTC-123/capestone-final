import { cookies } from 'next/headers';
import { LandingPage } from '@/components/landing/LandingPage';

export default function Home() {
  const role = cookies().get('ricer-role')?.value;
  const signedIn = Boolean(cookies().get('refresh-token')?.value);
  const signedInHref = signedIn ? (role === 'OFFICIAL' ? '/map' : '/report') : null;
  return <LandingPage signedInHref={signedInHref} />;
}
