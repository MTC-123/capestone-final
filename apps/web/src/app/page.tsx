import { cookies } from 'next/headers';
import { LandingPage } from '@/components/landing/LandingPage';

export default async function Home() {
  const jar = await cookies();
  const role = jar.get('ricer-role')?.value;
  const signedIn = Boolean(jar.get('refresh-token')?.value);
  const signedInHref = signedIn ? (role === 'OFFICIAL' ? '/map' : '/report') : null;
  return <LandingPage signedInHref={signedInHref} />;
}
