import { useState, type ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

/**
 * In-app explanation for a domain term.
 *
 * `title` is only used as the accessible name of the trigger — it is not
 * rendered inside the card, so the popover stays a short, single explanation.
 */
export function Help({ title, children }: { title?: string; children: ReactNode }) {
  // Controlled so the trigger can open the card on its own. Radix's hover card
  // only answers to mouse pointers and to focus: a tap on a phone gets nothing
  // (touch pointers are ignored by design), and a keyboard user who dismissed
  // the card with Escape still holds focus, so no second focus event is coming
  // to bring it back. Hover and focus keep working through `onOpenChange`.
  const [open, setOpen] = useState(false);

  return (
    <HoverCard open={open} onOpenChange={setOpen}>
      <HoverCardTrigger
        aria-label={title ? `Explain: ${title}` : 'Explain'}
        role="button"
        aria-expanded={open}
        tabIndex={0}
        onClick={(e) => {
          e.preventDefault();
          setOpen((current) => !current);
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          // Space on a role="button" would otherwise scroll the page.
          e.preventDefault();
          setOpen(true);
        }}
        className="ml-1 inline-flex align-middle text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full cursor-help"
      >
        <HelpCircle className="size-3.5" />
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-64 p-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </HoverCardContent>
    </HoverCard>
  );
}
