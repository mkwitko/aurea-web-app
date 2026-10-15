import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const LANGUAGES = [
  { code: 'en', flag: '🇺🇸', name: 'English' },
  { code: 'pt', flag: '🇧🇷', name: 'Português' },
  { code: 'es', flag: '🇪🇸', name: 'Español' },
] as const;

export function LanguageSwitcher({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = (i18n.resolvedLanguage ?? 'en').slice(0, 2);
  const active = LANGUAGES.find((l) => l.code === current) ?? LANGUAGES[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Language"
        className={cn(
          'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          tone === 'dark'
            ? 'border-white/15 text-white/80 hover:bg-white/5'
            : 'border-border text-foreground hover:bg-accent',
        )}
      >
        <Globe className="size-4 opacity-70" />
        <span className="leading-none">{active.flag}</span>
        <span className="hidden sm:inline">{active.name}</span>
        <ChevronDown className={cn('size-3.5 opacity-60 transition-transform', open && 'rotate-180')} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-1">
        {LANGUAGES.map((lng) => {
          const isActive = lng.code === current;
          return (
            <button
              key={lng.code}
              type="button"
              onClick={() => {
                void i18n.changeLanguage(lng.code);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                isActive ? 'bg-accent font-medium text-accent-foreground' : 'hover:bg-accent',
              )}
            >
              <span className="text-base leading-none">{lng.flag}</span>
              <span className="flex-1 text-left">{lng.name}</span>
              {isActive && <Check className="size-4 text-primary" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
