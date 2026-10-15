import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  Compass,
  CreditCard,
  FlaskConical,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  PlugZap,
  Send,
  Target,
  Telescope,
  TrendingUp,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGetDashboard } from '@/api/generated/hooks/dashboardHooks/useGetDashboard';
import { useUiMode } from '@/lib/ui-mode';
import { Button } from '@/components/ui/button';
import { CreditBalanceChip } from '@/components/CreditBalanceChip';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UiModeToggle } from '@/components/UiModeToggle';
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher';
import { useAuth } from '../lib/auth';
import { useAgentRunEvents } from '../lib/run-events';

type NavItem = { to: string; key: string; icon: typeof LayoutDashboard; end: boolean };

// Simple mode (the default, for the non-technical founder this app is built
// for) shows exactly four items: home, who-I-am, how-I-grow, what-goes-out.
// The five loop stages live behind the one "Crescimento" item — see
// GrowthPage — instead of cluttering the rail with a stage each.
const simpleNavGroups: { key: string | null; items: NavItem[] }[] = [
  { key: null, items: [{ to: '/app', key: 'dashboard', icon: LayoutDashboard, end: true }] },
  { key: 'business', items: [{ to: '/app/business', key: 'business', icon: Building2, end: true }] },
  { key: 'growth', items: [{ to: '/app/growth', key: 'growth', icon: TrendingUp, end: false }] },
  { key: 'publish', items: [{ to: '/app/actions', key: 'actions', icon: Send, end: false }] },
];

// Advanced mode keeps every raw per-stage page reachable, plus the merged
// "Crescimento" overview at the top of its group — the same nav the app had
// before Fase 4, with one extra entry.
const advancedNavGroups: { key: string | null; items: NavItem[] }[] = [
  { key: null, items: [{ to: '/app', key: 'dashboard', icon: LayoutDashboard, end: true }] },
  {
    key: 'business',
    items: [
      { to: '/app/business', key: 'business', icon: Building2, end: true },
      { to: '/app/business/icps', key: 'icps', icon: Users, end: false },
    ],
  },
  {
    key: 'growth',
    items: [
      { to: '/app/growth', key: 'growth', icon: TrendingUp, end: false },
      { to: '/app/goals', key: 'goals', icon: Target, end: false },
      { to: '/app/research', key: 'research', icon: Telescope, end: false },
      { to: '/app/strategies', key: 'strategies', icon: Compass, end: false },
      { to: '/app/experiments', key: 'experiments', icon: FlaskConical, end: false },
      { to: '/app/learnings', key: 'learnings', icon: Lightbulb, end: false },
    ],
  },
  { key: 'publish', items: [{ to: '/app/actions', key: 'actions', icon: Send, end: false }] },
];

// Outside the growth loop: billing is a setting, not a stage — kept in its
// own array so Task 10's credit-balance chip has an obvious, isolated place
// to grow next to.
const secondaryNav = [
  { to: '/app/settings/billing', key: 'billing', icon: CreditCard },
  { to: '/app/settings/integrations', key: 'integrations', icon: PlugZap },
];

function Brand() {
  return (
    <NavLink to="/app" end className="flex items-center gap-2 font-display text-xl font-extrabold tracking-tight">
      <span className="grid size-5 place-items-center rounded-full bg-gradient-to-br from-aura to-aura-deep shadow-[0_0_16px_rgba(255,196,107,0.5)]" />
      AUREA
    </NavLink>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  // Every authenticated screen renders through here, so this is the one place
  // that opens the run-completion stream instead of each screen doing its own.
  useAgentRunEvents();
  // O mesmo dado do card do dashboard, e a mesma query: o React Query dedupe as
  // duas chamadas. O badge existe para o fundador que entra direto em outra
  // tela — que é justamente quem não veria a cobrança.
  const dashboard = useGetDashboard();
  const pendingMeasurement = dashboard.data?.pendingMeasurement.count ?? 0;
  const { pathname } = useLocation();
  const { mode } = useUiMode();

  // Simple mode's 4 items vs. advanced's full set of raw stage pages — see
  // Fase 4. Recomputed per render (mode rarely changes, and the arrays are
  // tiny), so the nav always reflects the toggle in the footer below.
  const navGroups = mode === 'simple' ? simpleNavGroups : advancedNavGroups;
  const flatNav = navGroups.flatMap((g) => g.items);

  // "Negócio" e "Clientes ideais" vivem sob o mesmo prefixo de rota
  // (/app/business e /app/business/icps): o NavLink sozinho acenderia os dois
  // ao mesmo tempo na aba de ICPs, então o dono do prefixo cede quando a rota
  // é da aba de clientes.
  const businessActive =
    pathname === '/app/business' ||
    (pathname.startsWith('/app/business/') && !pathname.startsWith('/app/business/icps'));

  const navItem = (active: boolean) =>
    cn(
      'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
      active
        ? 'bg-primary/10 text-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-gradient-to-b before:from-brand before:to-aura'
        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
    );

  const badge =
    pendingMeasurement > 0 ? (
      <span
        className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[10px] text-foreground"
        title={t('app.dashboard.pendingMeasurement.badge', { count: pendingMeasurement })}
      >
        {pendingMeasurement}
      </span>
    ) : null;

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Blueprint grid + ambient aura */}
      <div aria-hidden className="tech-grid pointer-events-none fixed inset-0 -z-0 text-foreground opacity-[0.06] dark:opacity-[0.1]" />
      <div
        aria-hidden
        className="pointer-events-none fixed -top-52 left-1/2 -z-0 aura-drift opacity-70 dark:opacity-100"
        style={{
          width: '820px',
          height: '820px',
          transform: 'translateX(-50%)',
          background:
            'radial-gradient(circle at 50% 40%, rgba(139,124,255,0.20), rgba(255,196,107,0.12) 45%, transparent 70%)',
          filter: 'blur(70px)',
        }}
      />

      <div className="relative z-10 md:grid md:grid-cols-[256px_1fr]">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen flex-col border-r border-border/70 bg-background/40 p-3 backdrop-blur-xl md:flex">
          <div className="px-3 pb-6 pt-2">
            <Brand />
          </div>
          <nav className="flex flex-col gap-0.5">
            {navGroups.map(({ key: groupKey, items }) => (
              <div key={groupKey ?? 'home'} className="flex flex-col gap-0.5">
                {groupKey && (
                  <p className="px-3 pb-1 pt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">
                    {t(`app.nav.groups.${groupKey}`)}
                  </p>
                )}
                {items.map(({ to, key, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) => navItem(key === 'business' ? businessActive : isActive)}
                  >
                    <Icon className="size-4" />
                    {t(`app.nav.${key}`)}
                    {key === 'growth' && badge}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          <nav className="mt-4 flex flex-col gap-0.5 border-t border-border/70 pt-3">
            {secondaryNav.map(({ to, key, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => navItem(isActive)}>
                <Icon className="size-4" />
                {t(`app.nav.${key}`)}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-3 border-t border-border/70 pt-3">
            <CreditBalanceChip />
            <WorkspaceSwitcher />
            <UiModeToggle />
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="truncate px-1 text-sm text-foreground/90">{user?.name}</div>
                <div className="flex items-center gap-1.5 px-1 font-mono text-[10px] text-muted-foreground/70">
                  <span className="size-1.5 rounded-full bg-emerald-400 glow-pulse" /> aurea · v0.1
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => void logout()} aria-label={t('app.signout')}>
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
        </aside>

        {/* Mobile top bar + nav */}
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/70 backdrop-blur-xl md:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Brand />
            <div className="flex items-center gap-1.5">
              <CreditBalanceChip />
              <WorkspaceSwitcher />
              <ThemeToggle />
              <LanguageSwitcher />
              <Button variant="ghost" size="icon" onClick={() => void logout()} aria-label={t('app.signout')}>
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
            {flatNav.map(({ to, key, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                    (key === 'business' ? businessActive : isActive)
                      ? 'bg-primary/15 text-foreground shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-primary)_35%,transparent)]'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                <Icon className="size-3.5" />
                {t(`app.nav.${key}`)}
              </NavLink>
            ))}
            {secondaryNav.map(({ to, key, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-primary/15 text-foreground shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-primary)_35%,transparent)]'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                <Icon className="size-3.5" />
                {t(`app.nav.${key}`)}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-[1600px] px-5 py-8 md:px-10 md:py-12">{children}</main>
      </div>
    </div>
  );
}
