import { notFound } from 'next/navigation';
import StyleguideView from './StyleguideView';

const isDemoMode = process.env.DEMO_MODE === 'true';

export default function StyleguidePage() {
  if (process.env.NODE_ENV === 'production' && !isDemoMode) {
    notFound();
  }

  return <StyleguideView />;
}
