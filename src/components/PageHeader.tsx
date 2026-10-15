import type { ReactNode } from 'react';

/** Page hero, HUD style: mono eyebrow + display title + gradient accent line. */
export function PageHeader({
  eyebrow,
  title,
  help,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  help?: ReactNode;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-aura">
              <span className="text-muted-foreground/50">// </span>
              {eyebrow}
            </p>
          )}
          <h1 className="mt-2.5 flex items-center gap-2.5 font-display text-3xl font-extrabold leading-none tracking-tight sm:text-[2.6rem]">
            {title}
            {help}
          </h1>
          {subtitle && <p className="mt-3  text-muted-foreground">{subtitle}</p>}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      <div className="accent-line mt-6 h-px w-28 rounded-full" />
    </div>
  );
}
