import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-ink text-white lg:block">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 aura-orb"
          style={{
            width: '640px',
            height: '640px',
            background:
              'radial-gradient(circle at 50% 45%, rgba(255,196,107,0.5), rgba(139,124,255,0.34) 40%, rgba(56,224,208,0.12) 62%, transparent 74%)',
            filter: 'blur(52px)',
          }}
        />
        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight">
            <span className="grid size-6 place-items-center rounded-full bg-gradient-to-br from-aura to-aura-deep shadow-[0_0_18px_rgba(255,196,107,0.6)]" />
            AUREA
          </Link>
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-aura">
              <Sparkles className="size-3" /> {t('auth.panelBadge')}
            </p>
            <p className="max-w-sm font-display text-2xl font-bold leading-snug">{t('auth.panelTitle')}</p>
            <p className="mt-3 max-w-sm text-sm text-white/60">{t('auth.panelSub')}</p>
          </div>
          <div className="font-mono text-xs text-white/40">Goal → Research → Strategy → Experiment → Learn</div>
        </div>
      </div>

      {/* Form side */}
      <div className="flex flex-col bg-background px-5 py-8">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight lg:invisible">
            <span className="grid size-6 place-items-center rounded-full bg-gradient-to-br from-aura to-aura-deep" />
            AUREA
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm py-8">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            <div className="mt-7">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
