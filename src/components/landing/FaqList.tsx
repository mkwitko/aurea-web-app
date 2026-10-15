import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type FaqEntry = { q: string; a: string };

/**
 * Disclosure list. The collapsed answer is `hidden`, not merely clipped to zero
 * height: a max-height trick leaves the text in the accessibility tree, so a
 * screen reader reads all eight answers at once and the tab order walks
 * through invisible content.
 */
export function FaqList({ items }: { items: FaqEntry[] }) {
  const baseId = useId();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <ul className="divide-y divide-white/10 border-y border-white/10">
      {items.map((item, index) => {
        const isOpen = open === index;
        const panelId = `${baseId}-panel-${index}`;
        const buttonId = `${baseId}-button-${index}`;
        return (
          <li key={item.q}>
            <h3 className="m-0">
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-4 py-5 text-left text-sm font-medium text-white/85 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aura"
              >
                {item.q}
                <ChevronDown
                  aria-hidden
                  className={`size-4 shrink-0 text-white/40 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>
            </h3>
            <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!isOpen}>
              <p className="pb-5 pr-8 text-sm leading-relaxed text-white/55">{item.a}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
