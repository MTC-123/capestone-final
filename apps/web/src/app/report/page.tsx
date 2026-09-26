import Link from 'next/link';
import { PublicFireReport } from '@/components/report/PublicFireReport';

export default function ReportPage() {
  return (
    <main className="min-h-dvh bg-background px-4 py-5 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <Link href="/" className="text-lg font-bold text-foreground">RICER Ifrane</Link>
          <Link href="/signin" className="text-sm text-muted-foreground underline">Sign in / Connexion / دخول</Link>
        </header>
        <PublicFireReport />
      </div>
    </main>
  );
}
