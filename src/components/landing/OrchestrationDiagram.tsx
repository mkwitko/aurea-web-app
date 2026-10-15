import { ArrowDown, Brain } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * The differentiation argument as a picture: one decision layer on top, the
 * tools the visitor already pays for underneath. Says "above your stack"
 * faster than the paragraph next to it, and never names a competitor.
 */
export function OrchestrationDiagram() {
  const { t } = useTranslation();
  const stackItems = t('contrast.stackItems', { returnObjects: true }) as unknown as string[];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-7">
      <div className="rounded-xl border border-aura/25 bg-gradient-to-br from-brand/15 via-brand/5 to-aura/10 p-5">
        <p className="flex items-center gap-2 font-display text-base font-semibold text-white">
          <Brain className="size-4 text-aura" aria-hidden />
          {t('contrast.layerTitle')}
        </p>
        <p className="mt-2 font-mono text-xs leading-relaxed text-white/60">{t('contrast.layerBody')}</p>
      </div>

      <div className="flex items-center justify-center gap-2 py-4 font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">
        <ArrowDown className="size-3.5" aria-hidden />
        {t('contrast.stackLabel')}
      </div>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {stackItems.map((item) => (
          <li
            key={item}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-center font-mono text-xs text-white/50"
          >
            {item}
          </li>
        ))}
      </ul>

      <p className="mt-5 text-sm leading-relaxed text-white/45">{t('contrast.stackNote')}</p>
    </div>
  );
}
