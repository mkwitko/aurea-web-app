import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

/** Section shell. Alternating surfaces are the only rhythm device on the page. */
export function Section({
  id,
  tone = 'base',
  className = '',
  children,
}: {
  id?: string;
  tone?: 'base' | 'raised';
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-16 border-t border-white/5 px-5 py-20 sm:py-28 ${
        tone === 'raised' ? 'bg-ink-2' : 'bg-ink'
      } ${className}`}
    >
      <div className="mx-auto max-w-5xl">{children}</div>
    </section>
  );
}

/** Eyebrow + heading + optional lead, in one place so every section matches. */
export function SectionHead({
  eyebrow,
  title,
  lead,
  leadHtml,
  align = 'left',
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  /** For copy that carries emphasis markup from the locale files. */
  leadHtml?: string;
  align?: 'left' | 'center';
}) {
  const centered = align === 'center';
  return (
    <header className={centered ? 'mx-auto max-w-2xl text-center' : ''}>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-aura/70">{eyebrow}</p>
      <h2
        className={`mt-3 font-display text-3xl font-bold leading-tight tracking-tight text-balance sm:text-[2.5rem] ${
          centered ? '' : 'max-w-2xl'
        }`}
      >
        {title}
      </h2>
      {lead ? (
        <p className={`mt-4 text-base leading-relaxed text-white/55 ${centered ? '' : 'max-w-2xl'}`}>{lead}</p>
      ) : null}
      {leadHtml ? (
        <p
          className={`mt-4 text-base leading-relaxed text-white/55 ${centered ? '' : 'max-w-2xl'}`}
          dangerouslySetInnerHTML={{ __html: leadHtml }}
        />
      ) : null}
    </header>
  );
}

/**
 * The page's single primary action. One component so the label, the target and
 * the styling cannot drift between the four places it appears.
 */
export function PrimaryCta({
  label,
  size = 'md',
  variant = 'brand',
  className = '',
}: {
  label: string;
  size?: 'md' | 'lg';
  variant?: 'brand' | 'light';
  className?: string;
}) {
  return (
    <Link
      to="/register"
      className={`group inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aura ${
        size === 'lg' ? 'px-8 py-4 text-sm' : 'px-7 py-3.5 text-sm'
      } ${
        variant === 'brand'
          ? 'bg-gradient-to-r from-brand to-brand-bright text-white shadow-[0_8px_40px_-8px_rgba(109,94,246,0.8)]'
          : 'bg-white text-ink'
      } ${className}`}
    >
      {label}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

/** Ambient brand glow. Decorative. */
export function Aura({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[min(90vw,720px)] -translate-x-1/2 -translate-y-1/2 aura-gradient aura-orb ${className}`}
    />
  );
}
