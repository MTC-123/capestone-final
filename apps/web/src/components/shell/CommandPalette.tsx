'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useTranslation } from '@/hooks/useTranslation';
import { Icon, type IconName } from '@/components/ui/Icon';
import { navFor } from '@/components/shell/nav';
import { cn } from '@/lib/cn';

type Command = { id: string; label: string; group: string; icon: IconName; run: () => void; keywords?: string };

function normalize(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** ⌘K / Ctrl+K launcher for pages and quick actions. Mounted fresh on every open. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <PaletteDialog onClose={onClose} /> : null;
}

function PaletteDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => {
      router.push(href);
      onClose();
    };
    const pages = navFor(role).map((item) => ({
      id: `nav:${item.href}:${item.labelKey}`,
      label: t(item.labelKey),
      group: t('paletteNavigate'),
      icon: item.icon,
      run: go(item.href),
      keywords: item.href,
    }));
    const actions: Command[] = [
      {
        id: 'theme',
        label: t('paletteToggleTheme'),
        group: t('paletteActions'),
        icon: 'moon',
        run: () => {
          const dark = !document.documentElement.classList.contains('dark');
          document.documentElement.classList.toggle('dark', dark);
          document.cookie = `ricer-theme=${dark ? 'dark' : 'light'}; Path=/; Max-Age=31536000; SameSite=Lax`;
          onClose();
        },
        keywords: 'dark light theme sombre clair',
      },
      ...(['ar', 'fr', 'en'] as const).map((lang) => ({
        id: `lang:${lang}`,
        label: `${t('paletteLanguage')} — ${lang === 'ar' ? 'العربية' : lang === 'fr' ? 'Français' : 'English'}`,
        group: t('paletteActions'),
        icon: 'globe' as IconName,
        run: () => {
          setLanguage(lang);
          onClose();
        },
        keywords: `language langue ${lang}`,
      })),
    ];
    return [...pages, ...actions];
  }, [role, t, router, onClose, setLanguage]);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return commands;
    return commands.filter((c) => normalize(`${c.label} ${c.keywords ?? ''}`).includes(q));
  }, [commands, query]);

  useEffect(() => {
    restoreFocus.current = document.activeElement as HTMLElement | null;
    const previous = restoreFocus;
    inputRef.current?.focus();
    return () => previous.current?.focus?.();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      results[cursor]?.run();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let lastGroup = '';

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[12vh]">
      {/* Backdrop: a plain button so pointer users can dismiss; Esc is handled on the input. */}
      <button
        type="button"
        tabIndex={-1}
        aria-label={t('closePanel')}
        className="absolute inset-0 cursor-default bg-background/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('paletteOpen')}
        className="relative w-full max-w-xl animate-scale-in overflow-hidden rounded-2xl border border-border bg-surface shadow-elev-3"
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Icon name="search" size={18} className="text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={t('palettePlaceholder')}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-results"
            aria-activedescendant={results[cursor] ? `cmd-${cursor}` : undefined}
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">Esc</kbd>
        </div>
        <ul id="command-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted-foreground">{t('paletteNoResults')}</li>}
          {results.map((command, index) => {
            const header = command.group !== lastGroup ? command.group : null;
            lastGroup = command.group;
            return (
              <li key={command.id} role="presentation">
                {header && (
                  <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{header}</p>
                )}
                <div
                  id={`cmd-${index}`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={index === cursor}
                  onMouseEnter={() => setCursor(index)}
                  onClick={command.run}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') command.run();
                  }}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm',
                    index === cursor ? 'bg-primary/10 text-foreground' : 'text-foreground/90'
                  )}
                >
                  <Icon name={command.icon} size={16} className={index === cursor ? 'text-primary' : 'text-muted-foreground'} />
                  <span className="flex-1 truncate">{command.label}</span>
                  {index === cursor && <Icon name="arrowRight" size={14} className="text-muted-foreground rtl:rotate-180" />}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
