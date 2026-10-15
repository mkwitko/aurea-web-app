import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  BarChart3,
  Brain,
  Check,
  CheckCircle2,
  FlaskConical,
  GitBranch,
  Layers,
  Lightbulb,
  MessageCircle,
  Minus,
  Radio,
  Repeat,
  Rocket,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { GrowthLoopRing, type LoopStep } from '@/components/landing/GrowthLoopRing';
import { ProductPreview } from '@/components/landing/ProductPreview';
import { OrchestrationDiagram } from '@/components/landing/OrchestrationDiagram';
import { FaqList, type FaqEntry } from '@/components/landing/FaqList';
import { Aura, PrimaryCta, Section, SectionHead } from '@/components/landing/primitives';

const LOOP_KEYS = ['goal', 'research', 'strategy', 'experiment', 'execute', 'measure', 'learn'] as const;

const PILLAR_ICONS = [Brain, GitBranch, Repeat];
const SYMPTOM_ICONS = [Zap, Lightbulb, Layers, Target];
const AGENT_ICONS = [Search, GitBranch, FlaskConical, BarChart3];
const CASE_ICONS = [Rocket, Users, TrendingUp];
const TAG_ICONS = [Target, Radio, FlaskConical, Brain];

type Pillar = { title: string; body: string; result: string };
type Numbered = { n: string; title: string; body: string };
type Titled = { title: string; body: string };
type Plan = { name: string; price: string; credits: string; workspaces: string; note: string };

export function LandingPage() {
  const { t } = useTranslation();

  // The locale files hold the page's content as arrays of objects; this keeps
  // the cast to the shape each section expects in one readable place.
  const list = <T,>(key: string): T[] => t(key, { returnObjects: true }) as unknown as T[];

  const assurances = list<string>('hero.assurances');
  const proofItems = list<Titled>('proof.items');
  const symptoms = list<string>('problem.symptoms');
  const pillars = list<Pillar>('what.pillars');
  const loopItems = list<Numbered>('loop.items');
  const agents = list<Titled>('agents.items');
  const comparison = t('contrast.comparison', { returnObjects: true }) as unknown as {
    others: string[];
    aurea: string[];
  };
  const tags = list<string>('contrast.tags');
  const cases = list<Titled>('useCases.items');
  const notFor = list<string>('useCases.notFor');
  const startSteps = list<Numbered>('start.steps');
  const plans = list<Plan>('pricing.plans');
  const faqItems = list<FaqEntry>('faq.items');

  const loopSteps: LoopStep[] = LOOP_KEYS.map((key) => ({ key, label: t(`loopSteps.${key}`) }));

  return (
    <div className="min-h-screen bg-ink text-white antialiased">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
      >
        {t('nav.skip')}
      </a>

      {/* ─── NAV ─── */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-ink/80 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight">
            <span
              aria-hidden
              className="grid size-6 place-items-center rounded-full bg-gradient-to-br from-aura to-aura-deep shadow-[0_0_18px_rgba(255,196,107,0.6)]"
            />
            AUREA
          </Link>

          <div className="hidden items-center gap-6 lg:flex">
            {[
              { href: '#what', label: t('nav.how') },
              { href: '#loop', label: t('nav.loop') },
              { href: '#pricing', label: t('nav.pricing') },
              { href: '#faq', label: t('nav.faq') },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm text-white/60 transition-colors hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <LanguageSwitcher tone="dark" />
            <Link
              to="/login"
              className="hidden text-sm font-medium text-white/70 transition-colors hover:text-white sm:block"
            >
              {t('nav.signin')}
            </Link>
            <Link
              to="/register"
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink transition-transform hover:scale-[1.03]"
            >
              {t('nav.start')}
            </Link>
          </div>
        </nav>
      </header>

      <main id="content">
        {/* ─── HERO ─── */}
        <section className="relative overflow-hidden px-5 pb-16 pt-14 sm:pb-24 sm:pt-20">
          <Aura className="-z-0" />
          <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
            <div className="text-center lg:text-left">
              <p className="rise-in mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-aura">
                <Sparkles className="size-3" aria-hidden /> {t('hero.badge')}
              </p>

              <h1 className="rise-in font-display text-[clamp(2rem,4.2vw,3.15rem)] font-extrabold leading-[1.05] tracking-tight text-balance [animation-delay:60ms]">
                {t('hero.titleMain')}{' '}
                <span className="bg-gradient-to-r from-aura via-aura-deep to-brand-bright bg-clip-text text-transparent">
                  {t('hero.titleAccent')}
                </span>
              </h1>

              <p className="rise-in mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg lg:mx-0 [animation-delay:120ms]">
                {t('hero.subtitle')}
              </p>

              <div className="rise-in mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start [animation-delay:180ms]">
                <PrimaryCta label={t('hero.start')} className="w-full sm:w-auto" />
                <a
                  href="#loop"
                  className="inline-flex w-full items-center justify-center rounded-full border border-white/15 px-7 py-3.5 text-sm font-semibold text-white/75 transition-colors hover:bg-white/5 sm:w-auto"
                >
                  {t('hero.how')}
                </a>
              </div>

              <ul className="rise-in mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start [animation-delay:240ms]">
                {assurances.map((item) => (
                  <li key={item} className="flex items-center gap-1.5 text-xs text-white/45">
                    <CheckCircle2 className="size-3.5 text-spark/70" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <GrowthLoopRing
              steps={loopSteps}
              title={t('hero.ringTitle')}
              centerNote={t('hero.ringNote')}
              className="rise-in [animation-delay:300ms]"
            />
          </div>
        </section>

        {/* ─── CREDIBILITY: only what is true today ─── */}
        <Section tone="raised" className="py-14 sm:py-16">
          <h2 className="font-mono text-xs font-normal uppercase tracking-[0.2em] text-white/35">
            {t('proof.eyebrow')}
          </h2>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {proofItems.map((item) => (
              <li key={item.title}>
                <h3 className="font-display text-sm font-semibold text-white">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/45">{item.body}</p>
              </li>
            ))}
          </ul>
        </Section>

        {/* ─── PROBLEM ─── */}
        <Section id="problem">
          <SectionHead eyebrow={t('problem.eyebrow')} title={t('problem.title')} leadHtml={t('problem.body')} />
          <ul className="mt-10 grid gap-3 sm:grid-cols-2">
            {symptoms.map((symptom, index) => {
              const Icon = SYMPTOM_ICONS[index] ?? Zap;
              return (
                <li
                  key={symptom}
                  className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-aura/70" aria-hidden />
                  <span className="text-sm leading-relaxed text-white/65">{symptom}</span>
                </li>
              );
            })}
          </ul>
          <p
            className="mt-8 max-w-2xl text-sm font-medium text-white/50"
            dangerouslySetInnerHTML={{ __html: t('problem.stakes') }}
          />
        </Section>

        {/* ─── WHAT AUREA IS ─── */}
        <Section id="what" tone="raised">
          <SectionHead eyebrow={t('what.eyebrow')} title={t('what.title')} lead={t('what.lead')} />

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {pillars.map((pillar, index) => {
              const Icon = PILLAR_ICONS[index] ?? Brain;
              return (
                <div
                  key={pillar.title}
                  className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-white/20"
                >
                  <div className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-brand/30 to-aura/20 text-aura">
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <h3 className="mt-5 font-display text-lg font-semibold">{pillar.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/50">{pillar.body}</p>
                  {/* Feature, then what it changes for the business. */}
                  <p className="mt-4 border-t border-white/10 pt-4 text-sm font-medium leading-relaxed text-aura/85">
                    {pillar.result}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-16">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/35">{t('preview.eyebrow')}</p>
            <h3 className="mt-3 max-w-2xl font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {t('preview.title')}
            </h3>
            <div className="mt-8">
              <ProductPreview />
            </div>
          </div>
        </Section>

        {/* ─── THE LOOP ─── */}
        <Section id="loop">
          <SectionHead eyebrow={t('loop.eyebrow')} title={t('loop.title')} lead={t('loop.lead')} />
          {/* An ordered list because the order is the product. */}
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {loopItems.map((item) => (
              <li
                key={item.n}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-colors hover:border-white/20"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/20 font-mono text-xs text-brand-bright">
                    {item.n}
                  </span>
                  <h3 className="font-display text-base font-semibold">{item.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-white/50">{item.body}</p>
              </li>
            ))}
            <li className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-aura/25 bg-aura/[0.04] p-5 text-center font-mono text-xs uppercase tracking-[0.16em] text-aura/80">
              <Repeat className="size-3.5" aria-hidden />
              {t('hero.repeat')}
            </li>
          </ol>
        </Section>

        {/* ─── AGENTS ─── */}
        <Section tone="raised">
          <SectionHead eyebrow={t('agents.eyebrow')} title={t('agents.title')} lead={t('agents.body')} />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2">
            {agents.map((agent, index) => {
              const Icon = AGENT_ICONS[index] ?? Brain;
              return (
                <li
                  key={agent.title}
                  className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5"
                >
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand/25 to-aura/15 text-aura">
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-semibold">{agent.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-white/50">{agent.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>

        {/* ─── DIFFERENTIATION ─── */}
        <Section id="difference">
          <SectionHead eyebrow={t('contrast.eyebrow')} title={t('contrast.title')} lead={t('contrast.body')} />

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <OrchestrationDiagram />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:content-start">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-white/35">
                  {t('contrast.othersLabel')}
                </h3>
                <ul className="mt-4 space-y-3">
                  {comparison.others.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-white/45">
                      <Minus className="mt-0.5 size-4 shrink-0 text-white/20" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-aura/25 bg-aura/[0.04] p-6">
                <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-aura">AUREA</h3>
                <ul className="mt-4 space-y-3">
                  {comparison.aurea.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-white/85">
                      <Check className="mt-0.5 size-4 shrink-0 text-aura" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tags.map((label, index) => {
              const Icon = TAG_ICONS[index] ?? Target;
              return (
                <li
                  key={label}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <Icon className="size-4 shrink-0 text-aura" aria-hidden />
                  <span className="text-sm font-medium text-white/70">{label}</span>
                </li>
              );
            })}
          </ul>
        </Section>

        {/* ─── WHO IT'S FOR ─── */}
        <Section tone="raised">
          <SectionHead eyebrow={t('useCases.eyebrow')} title={t('useCases.title')} />
          <ul className="mt-12 grid gap-5 md:grid-cols-3">
            {cases.map((useCase, index) => {
              const Icon = CASE_ICONS[index] ?? Rocket;
              return (
                <li
                  key={useCase.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-white/20"
                >
                  <Icon className="size-6 text-aura" aria-hidden />
                  <h3 className="mt-4 font-display text-base font-semibold">{useCase.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/50">{useCase.body}</p>
                </li>
              );
            })}
          </ul>

          {/* Qualifying people out is the cheapest way to earn the trust of the
              ones who stay. */}
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-white/40">
              {t('useCases.notForTitle')}
            </h3>
            <ul className="mt-4 grid gap-3 sm:grid-cols-3">
              {notFor.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-white/45">
                  <Minus className="mt-0.5 size-4 shrink-0 text-white/20" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {/* ─── MID-PAGE CTA ─── */}
        <section className="border-t border-white/5 bg-ink px-5 py-16">
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 rounded-2xl border border-brand/25 bg-gradient-to-br from-brand/12 via-ink-2 to-aura/8 p-8 text-center sm:p-10">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{t('ctaMid.title')}</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/55">{t('ctaMid.subtitle')}</p>
            </div>
            <PrimaryCta label={t('ctaMid.button')} />
            <p className="font-mono text-xs text-white/35">{t('ctaMid.assurance')}</p>
          </div>
        </section>

        {/* ─── HOW TO START ─── */}
        <Section id="start" tone="raised">
          <SectionHead eyebrow={t('start.eyebrow')} title={t('start.title')} />
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {startSteps.map((step) => (
              <li key={step.n} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <span className="grid size-8 place-items-center rounded-full bg-aura/15 font-mono text-xs text-aura">
                  {step.n}
                </span>
                <h3 className="mt-4 font-display text-base font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/50">{step.body}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* ─── PRICING ─── */}
        <Section id="pricing">
          <SectionHead eyebrow={t('pricing.eyebrow')} title={t('pricing.title')} lead={t('pricing.lead')} />

          <div className="mt-10 flex flex-col gap-4 rounded-2xl border border-aura/25 bg-aura/[0.05] p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold text-white">{t('pricing.freeName')}</h3>
              <p className="mt-1 font-mono text-xs text-white/50">{t('pricing.freeNote')}</p>
            </div>
            <div className="flex items-center gap-6">
              <span className="font-display text-3xl font-extrabold text-aura">{t('pricing.freePrice')}</span>
              <PrimaryCta label={t('pricing.freeCta')} />
            </div>
          </div>

          <ul className="mt-6 grid gap-5 md:grid-cols-3">
            {plans.map((plan, index) => {
              const highlighted = index === 1;
              return (
                <li
                  key={plan.name}
                  className={`relative flex flex-col rounded-2xl border p-6 ${highlighted ? 'border-brand/40 bg-brand/[0.06]' : 'border-white/10 bg-white/[0.02]'
                    }`}
                >
                  {highlighted ? (
                    <span className="absolute -top-3 left-6 rounded-full bg-brand px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white">
                      {t('pricing.popular')}
                    </span>
                  ) : null}
                  <h3 className="font-display text-base font-semibold">{plan.name}</h3>
                  <p className="mt-3 font-display text-3xl font-extrabold tracking-tight">
                    {plan.price}
                    <span className="font-sans text-sm font-medium text-white/40">{t('pricing.perMonth')}</span>
                  </p>
                  <ul className="mt-5 space-y-2 text-sm text-white/60">
                    <li className="flex items-center gap-2">
                      <Check className="size-4 shrink-0 text-aura" aria-hidden />
                      {plan.credits} {t('pricing.creditsUnit')}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 shrink-0 text-aura" aria-hidden />
                      {plan.workspaces}{' '}
                      {plan.workspaces === '1' ? t('pricing.workspacesUnit') : t('pricing.workspacesUnitPlural')}
                    </li>
                  </ul>
                  <p className="mt-4 text-sm leading-relaxed text-white/40">{plan.note}</p>
                </li>
              );
            })}
          </ul>

          <div className="mt-8 flex flex-col items-start gap-4">
            <PrimaryCta label={t('pricing.cta')} variant="light" />
            <p className="max-w-2xl text-xs leading-relaxed text-white/35">{t('pricing.footnote')}</p>
          </div>
        </Section>

        {/* ─── FAQ ─── */}
        <Section id="faq" tone="raised">
          <div className="mx-auto max-w-3xl">
            <SectionHead eyebrow={t('faq.eyebrow')} title={t('faq.title')} />
            <div className="mt-10">
              <FaqList items={faqItems} />
            </div>
          </div>
        </Section>

        {/* ─── FOUNDER ─── */}
        <Section id="founder">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-aura/70">{t('trust.eyebrow')}</p>
            <h2 className="mx-auto mt-4 max-w-2xl font-display text-2xl font-bold tracking-tight text-balance sm:text-3xl">
              {t('trust.title')}
            </h2>
            <figure className="relative mx-auto mt-8 max-w-xl">
              <MessageCircle className="absolute -left-2 -top-3 size-6 text-aura/20" aria-hidden />
              <blockquote className="text-base leading-relaxed text-white/60">
                &ldquo;{t('trust.body')}&rdquo;
              </blockquote>
              <figcaption className="mt-5 text-sm font-medium text-white/40">{t('trust.label')}</figcaption>
            </figure>
            <p className="mx-auto mt-8 inline-flex items-center gap-2 rounded-full border border-aura/20 bg-aura/5 px-4 py-2">
              <Sparkles className="size-3.5 text-aura" aria-hidden />
              <span className="text-sm text-aura/80">{t('trust.status')}</span>
            </p>
          </div>
        </Section>

        {/* ─── FINAL CTA ─── */}
        <section className="relative overflow-hidden border-t border-white/5 px-5 py-28 text-center">
          <Aura className="-z-0 opacity-70" />
          <div className="relative z-10 mx-auto max-w-2xl">
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-balance sm:text-5xl">
              {t('ctaBand.title')}
            </h2>
            <p className="mx-auto mt-5 max-w-lg leading-relaxed text-white/55">{t('ctaBand.subtitle')}</p>
            <div className="mt-9 flex flex-col items-center gap-4">
              <PrimaryCta label={t('ctaBand.button')} size="lg" variant="light" />
              <p className="font-mono text-xs text-white/40">{t('ctaBand.urgency')}</p>
            </div>
            <a
              href="#loop"
              className="mt-8 inline-flex items-center gap-1.5 text-sm text-white/45 transition-colors hover:text-white"
            >
              {t('ctaBand.secondary')}
              <ArrowRight className="size-3.5" aria-hidden />
            </a>
          </div>
        </section>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/5 px-5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="font-display font-bold text-white/80">AUREA</span>
            <p className="mt-1 text-sm text-white/35">{t('footer.tagline')}</p>
          </div>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/45">
            <a href="#what" className="transition-colors hover:text-white">
              {t('footer.how')}
            </a>
            <a href="#loop" className="transition-colors hover:text-white">
              {t('footer.loop')}
            </a>
            <a href="#pricing" className="transition-colors hover:text-white">
              {t('footer.pricing')}
            </a>
            <a href="#faq" className="transition-colors hover:text-white">
              {t('footer.faq')}
            </a>
            <Link to="/login" className="transition-colors hover:text-white">
              {t('footer.signin')}
            </Link>
          </nav>
          <span className="text-sm text-white/30">&copy; 2026 AUREA</span>
        </div>
      </footer>
    </div>
  );
}
