import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/lib/cn';

export function BrandMark({
  href = '/',
  subtitle,
  compact = false,
  className,
}: {
  href?: string;
  subtitle?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} className={cn('group flex min-w-0 items-center gap-2.5', className)} aria-label="RICER Ifrane">
      <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-primary/10 ring-1 ring-primary/20">
        <Logo variant="badge" size="sm" priority className="h-8 w-8 transition-transform duration-300 group-hover:scale-105" />
      </span>
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[15px] font-semibold tracking-tight">
            RICER <span className="text-muted-foreground font-normal">Ifrane</span>
          </span>
          {subtitle && <span className="block truncate text-[11px] text-muted-foreground">{subtitle}</span>}
        </span>
      )}
    </Link>
  );
}
