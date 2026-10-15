import { createContext, useContext, useState, type ReactNode } from 'react';

export type UiMode = 'simple' | 'advanced';

interface UiModeContextValue {
  mode: UiMode;
  setMode: (mode: UiMode) => void;
  toggle: () => void;
}

const UiModeContext = createContext<UiModeContextValue | null>(null);
const KEY = 'aurea.uiMode';

function readStored(): UiMode {
  return localStorage.getItem(KEY) === 'advanced' ? 'advanced' : 'simple';
}

/**
 * Simple vs. advanced app mode. Simple (the default, for the non-technical
 * founder this app is built for) merges the five growth-loop stages into one
 * `GrowthPage`; advanced keeps the raw per-stage pages reachable too. The only
 * thing that reads this outside `AppLayout`'s toggle is `<ListRoute>` in
 * App.tsx, which decides what a `/app/goals`-style route renders.
 */
export function UiModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<UiMode>(readStored);

  const setMode = (next: UiMode) => {
    localStorage.setItem(KEY, next);
    setModeState(next);
  };

  const toggle = () => setMode(mode === 'simple' ? 'advanced' : 'simple');

  return <UiModeContext.Provider value={{ mode, setMode, toggle }}>{children}</UiModeContext.Provider>;
}

export function useUiMode(): UiModeContextValue {
  const ctx = useContext(UiModeContext);
  if (!ctx) throw new Error('useUiMode must be used within UiModeProvider');
  return ctx;
}
