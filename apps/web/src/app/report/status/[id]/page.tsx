import Link from 'next/link';
import { ReceiptStatus } from '@/components/report/ReceiptStatus';

export default async function ReportStatusPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ receipt?: string }>;
}) {
  const [{ id }, { receipt }] = await Promise.all([params, searchParams]);
  return <main className="min-h-dvh bg-background px-4 py-8"><div className="mx-auto max-w-lg space-y-5">
    <Link href="/" className="text-lg font-bold">RICER Ifrane</Link>
    <ReceiptStatus id={id} receipt={receipt ?? ''} />
  </div></main>;
}
