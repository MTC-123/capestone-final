import { notFound } from 'next/navigation';
import ErrorCodesView from './ErrorCodesView';

const isDemoMode = process.env.DEMO_MODE === 'true';

export default function ErrorCodesPage() {
  if (process.env.NODE_ENV === 'production' && !isDemoMode) {
    notFound();
  }

  return <ErrorCodesView />;
}
