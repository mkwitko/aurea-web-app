import { useTranslation } from 'react-i18next';
import { SlidersHorizontal } from 'lucide-react';
import { useUiMode } from '@/lib/ui-mode';
import { cn } from '@/lib/utils';

/**
 * Discreet simple/advanced switch for the sidebar footer. Simple (the
 * default) is the one screen for the whole growth loop (`GrowthPage`);
 * advanced brings back every raw per-stage page in the nav. See
 * `<ListRoute>` in App.tsx for the routing side of this.
 */
export function UiModeToggle() {
  const { t } = useTranslation();
  const { mode, toggle } = useUiMode();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t('app.uiMode.label')}
      className={cn(
        'inline-flex items-center gap-1.5 self-start rounded-full border border-border/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
      )}
    >
      <SlidersHorizontal className="size-3" />
      {t('app.uiMode.label')}: {t(`app.uiMode.${mode}`)}
    </button>
  );
}
