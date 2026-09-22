import { Icon } from '@/components/ui/Icon';

export default function ProtectedLoading() {
  return (
    <div className="min-h-screen grid place-items-center bg-background">
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-4 rounded-lg border border-border bg-surface px-5 py-4 shadow-elev-1 animate-scale-in"
      >
        <div className="grid h-10 w-10 place-items-center rounded-md bg-primary text-primary-foreground shadow-sm">
          <Icon name="fire" aria-hidden={true} size={20} />
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-sm font-semibold text-foreground">RICER Ifrane</div>
          <div className="text-xs text-muted-foreground">Loading...</div>
        </div>
      </div>
    </div>
  );
}
