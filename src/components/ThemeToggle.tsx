import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/theme';

export function ThemeToggle({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { resolved, toggle } = useTheme();
  const isDark = resolved === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        tone === 'dark'
          ? 'border-white/15 text-white/80 hover:bg-white/5'
          : 'border-border text-foreground hover:bg-accent',
      )}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
