import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';
type Resolved = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  resolved: Resolved;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const KEY = 'aurea.theme';

function systemPref(): Resolved {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem(KEY) as Theme) || 'dark');
  const [resolved, setResolved] = useState<Resolved>(() => {
    const stored = (localStorage.getItem(KEY) as Theme) || 'dark';
    return stored === 'system' ? systemPref() : (stored as Resolved);
  });

  useEffect(() => {
    const apply = () => {
      const r: Resolved = theme === 'system' ? systemPref() : theme;
      setResolved(r);
      document.documentElement.classList.toggle('dark', r === 'dark');
    };
    apply();
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [theme]);

  const setTheme = (t: Theme) => {
    localStorage.setItem(KEY, t);
    setThemeState(t);
  };

  const toggle = () => setTheme(resolved === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, toggle }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
