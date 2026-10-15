import { useEffect, useState } from 'react';
import { Repeat } from 'lucide-react';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';

export type LoopStep = { key: string; label: string };

const ADVANCE_MS = 2600;

/**
 * The AUREA loop drawn as a loop.
 *
 * The whole product claim is that growth is a cycle that keeps running, and a
 * row of arrows does not say that — a ring with one travelling active step
 * does. It is the page's signature element, so everything around it stays
 * quiet.
 *
 * Interaction: the active step advances on its own, and clicking a step pins
 * it (the auto-advance stops, because fighting a user's click is hostile).
 * Under `prefers-reduced-motion` nothing moves until the user clicks.
 */
export function GrowthLoopRing({
  steps,
  title,
  centerNote,
  className = '',
}: {
  steps: LoopStep[];
  title: string;
  centerNote: string;
  className?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (pinned || reducedMotion) return;
    const id = window.setInterval(() => {
      setActive((current) => (current + 1) % steps.length);
    }, ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [pinned, reducedMotion, steps.length]);

  const activeStep = steps[active] ?? steps[0];
  if (!activeStep) return null;

  return (
    <div className={className}>
      {/* Ring layout: only viable once there is room for seven labels around a
          circle. Below `sm` the same sequence renders as a wrapped strip. */}
      <div className="relative mx-auto hidden aspect-square w-full max-w-[28rem] sm:block">
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" className="text-white/10" strokeWidth="0.4" />
          <circle
            cx="50"
            cy="50"
            r="36"
            fill="none"
            stroke="url(#loop-arc)"
            strokeWidth="0.9"
            strokeLinecap="round"
            strokeDasharray="30 196"
            className={reducedMotion ? '' : 'orbit origin-center'}
          />
          <defs>
            <linearGradient id="loop-arc" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6d5ef6" stopOpacity="0" />
              <stop offset="50%" stopColor="#8b7cff" />
              <stop offset="100%" stopColor="#ffc46b" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center readout: which step the system is on right now. */}
        <div className="absolute left-1/2 top-1/2 w-40 -translate-x-1/2 -translate-y-1/2 text-center">
          <p className="font-mono text-[11px] tracking-[0.2em] text-white/35">
            {String(active + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}
          </p>
          <p className="mt-1.5 font-display text-xl font-bold text-white" aria-live="polite">
            {activeStep.label}
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-aura/70">
            <Repeat className="size-3" aria-hidden />
            {centerNote}
          </p>
        </div>

        <ul className="contents" aria-label={title}>
          {steps.map((step, index) => {
            const angle = (index / steps.length) * 2 * Math.PI - Math.PI / 2;
            // Percent coordinates are computed geometry, not styling: there is
            // no utility class for "36% of the box along a 51.4° bearing".
            const left = 50 + 36 * Math.cos(angle);
            const top = 50 + 36 * Math.sin(angle);
            const isActive = index === active;
            return (
              <li
                key={step.key}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${left}%`, top: `${top}%` }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActive(index);
                    setPinned(true);
                  }}
                  aria-pressed={isActive}
                  className={`rounded-full border px-3 py-1.5 font-mono text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aura ${
                    isActive
                      ? 'border-aura/50 bg-aura/15 text-aura shadow-[0_0_24px_-4px_rgba(255,196,107,0.6)]'
                      : 'border-white/10 bg-ink text-white/55 hover:border-white/25 hover:text-white'
                  }`}
                >
                  {step.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Mobile: the sequence, still in order, without the geometry. */}
      <ul className="flex flex-wrap items-center justify-center gap-2 sm:hidden" aria-label={title}>
        {steps.map((step) => (
          <li
            key={step.key}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-xs text-white/70"
          >
            {step.label}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5 font-mono text-xs text-aura/80">
          <Repeat className="size-3" aria-hidden />
          {centerNote}
        </li>
      </ul>
    </div>
  );
}
