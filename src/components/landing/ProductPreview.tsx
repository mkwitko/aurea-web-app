import { Brain } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * A representation of the Growth Brain screen, not a screenshot — it is built
 * from the same tokens as the app, and the caption says it is a preview.
 */
export function ProductPreview() {
  const { t } = useTranslation();
  const steps = ['research', 'strategy', 'experiment', 'measure', 'learn'] as const;
  const chips = t('preview.chips', { returnObjects: true }) as unknown as string[];

  return (
    <figure className="m-0">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-1">
        {/* No fixed ratio on phones: at that width the panel's content is taller
            than 16/10 and a ratio box would clip the metric card. */}
        <div className="w-full rounded-xl border border-white/10 bg-gradient-to-br from-ink via-ink-2 to-brand/5 p-4 sm:aspect-[16/9] sm:p-8">
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <span className="flex items-center gap-2 font-mono text-xs text-aura">
                <Brain className="size-4" aria-hidden />
                {t('preview.panelTitle')}
              </span>
              <span className="ml-auto hidden items-center gap-2 sm:flex">
                {chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] text-white/50"
                  >
                    {chip}
                  </span>
                ))}
              </span>
            </div>

            <div className="mt-4 flex flex-1 gap-4">
              <div className="hidden w-44 shrink-0 space-y-2 sm:block">
                {steps.map((step) => (
                  <div
                    key={step}
                    className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
                  >
                    <span className="size-1.5 rounded-full bg-aura/60" aria-hidden />
                    <span className="font-mono text-xs text-white/40">{t(`loopSteps.${step}`)}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-1 flex-col gap-3">
                <div className="flex flex-col gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs text-white/50 sm:text-sm">{t('preview.goalLabel')}</span>
                  <span className="text-sm font-medium text-white/90">{t('preview.goalValue')}</span>
                </div>
                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-white/30">
                      {t('preview.hypothesisLabel')}
                    </span>
                    <p className="mt-1 text-xs text-white/60">{t('preview.hypothesisValue')}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-white/30">
                      {t('preview.metricLabel')}
                    </span>
                    <p className="mt-1 text-xs text-white/60">{t('preview.metricValue')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-white/35">{t('preview.caption')}</figcaption>
    </figure>
  );
}
