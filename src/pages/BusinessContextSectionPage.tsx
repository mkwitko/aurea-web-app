import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import type { FieldErrors } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { nanoid } from 'nanoid';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { useGetBusiness } from '@/api/generated/hooks/businessHooks/useGetBusiness';
import { useGetBusinessContext } from '@/api/generated/hooks/businessHooks/useGetBusinessContext';
import { useUpdateBusinessContextSection } from '@/api/generated/hooks/businessHooks/useUpdateBusinessContextSection';
import { BUSINESS } from '@/api/modules';
import { companySectionSchema } from '@/api/generated/zod/companySectionSchema';
import { productsSectionSchema } from '@/api/generated/zod/productsSectionSchema';
import { competitiveSectionSchema } from '@/api/generated/zod/competitiveSectionSchema';
import { marketSectionSchema } from '@/api/generated/zod/marketSectionSchema';
import { constraintsSectionSchema } from '@/api/generated/zod/constraintsSectionSchema';
import { performanceSectionSchema } from '@/api/generated/zod/performanceSectionSchema';
import { activitiesSectionSchema } from '@/api/generated/zod/activitiesSectionSchema';
import { projectsSectionSchema } from '@/api/generated/zod/projectsSectionSchema';
import { campaignsSectionSchema } from '@/api/generated/zod/campaignsSectionSchema';
import { dropBlankFields } from '@/lib/blank-fields';
import { zodIssuesToErrors, type ZodLikeIssue } from '@/lib/zod-errors';
import { CONTEXT_FILL_PATHS } from '@/lib/fill-paths';
import { markReviewed } from '@/lib/reviewed-sections';
import type { FillQuestion } from '@/schemas/fill-proposal';
import { AiFillButton } from '@/components/ai/AiFillButton';
import { PageHeader } from '../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  EMPTY_CONTEXT_DATA,
  type BusinessContextData,
  type ContextSection,
} from '@/types/business-context';
import { CONTEXT_SECTIONS, SECTION_FIELD } from '@/components/BusinessContextWizard/sectionRegistry';

function isContextSection(value: string | undefined): value is ContextSection {
  return !!value && CONTEXT_SECTIONS.some((s) => s.key === value);
}

/**
 * One optional context section, saved on its own. Sections are independent:
 * the user can fill a single one and leave — nothing else is required.
 */
export function BusinessContextSectionPage() {
  const { section } = useParams<{ section: string }>();
  const [searchParams] = useSearchParams();
  const fillRunParam = searchParams.get('fillRun');
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: businessData, isLoading: businessLoading } = useGetBusiness();
  const business = businessData?.business;

  const { data: contextData, isLoading: contextLoading } = useGetBusinessContext({
    query: { enabled: !!business },
  });

  const form = useForm<BusinessContextData>({ defaultValues: EMPTY_CONTEXT_DATA });
  const data = form.watch();
  const [errors, setErrors] = useState<FieldErrors<BusinessContextData>>({});
  const [loaded, setLoaded] = useState(false);
  // Set by `onFilled` when the values on screen came from an AI proposal, so
  // `persist` can carry it as `sourceAgentRunId` — the provenance a stored
  // version needs to record `source: AI`. Cleared on a successful save so a
  // later hand-edited save never gets attributed to a run it did not use.
  const [fillRunId, setFillRunId] = useState<string | null>(null);

  const remote = contextData?.currentVersion?.data as BusinessContextData | undefined;

  useEffect(() => {
    if (loaded || !remote) return;
    form.reset({ ...EMPTY_CONTEXT_DATA, ...remote });
    setLoaded(true);
  }, [remote, loaded, form]);

  const save = useUpdateBusinessContextSection({
    mutation: {
      onSuccess: () => {
        form.reset(form.getValues());
        setFillRunId(null);
        void queryClient.invalidateQueries({ queryKey: BUSINESS.contextQueryKey });
      },
    },
  });

  if (businessLoading || (business && contextLoading) || (remote && !loaded)) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> {t('common.loading')}
      </p>
    );
  }

  if (!business) return <Navigate to="/app/business/profile" replace />;
  if (!isContextSection(section)) return <Navigate to="/app/business" replace />;

  const info = CONTEXT_SECTIONS.find((s) => s.key === section);
  if (!info) return <Navigate to="/app/business" replace />;
  const index = CONTEXT_SECTIONS.indexOf(info);
  const next = CONTEXT_SECTIONS[index + 1];

  const onChange = (patch: Partial<BusinessContextData>) => {
    for (const [key, value] of Object.entries(patch)) {
      form.setValue(key as keyof BusinessContextData, value, { shouldDirty: true, shouldValidate: false });
    }
  };

  /**
   * Marks the current section invalid, populates `errors` with a tree the
   * steps can read field-by-field, and aborts `persist` — validation must
   * block the save rather than let an invalid payload reach the server.
   */
  const fail = (key: keyof BusinessContextData, issues: readonly ZodLikeIssue[]): never => {
    setErrors({ [key]: zodIssuesToErrors(issues) } as FieldErrors<BusinessContextData>);
    throw new Error('validation');
  };

  const persist = async () => {
    // Text inputs report `''` for "left empty", which is a UI artifact rather
    // than a domain value — and a field with a format constraint (`url`,
    // `baselineDate`) rejects it. Dropping blanks once here keeps the nine step
    // components from each having to remember.
    const values = dropBlankFields(form.getValues());

    switch (section) {
      case 'company': {
        const result = companySectionSchema.safeParse(values.companyProfile ?? {});
        if (!result.success) fail('companyProfile', result.error.issues);
        else await save.mutateAsync({ data: { section, data: result.data, sourceAgentRunId: fillRunId ?? undefined } });
        break;
      }
      case 'products': {
        const result = productsSectionSchema.safeParse(values.products ?? []);
        if (!result.success) fail('products', result.error.issues);
        else await save.mutateAsync({ data: { section, data: result.data, sourceAgentRunId: fillRunId ?? undefined } });
        break;
      }
      case 'competitive': {
        const result = competitiveSectionSchema.safeParse(values.competitiveLandscape ?? {});
        if (!result.success) fail('competitiveLandscape', result.error.issues);
        else await save.mutateAsync({ data: { section, data: result.data, sourceAgentRunId: fillRunId ?? undefined } });
        break;
      }
      case 'market': {
        const result = marketSectionSchema.safeParse(values.marketContext ?? {});
        if (!result.success) fail('marketContext', result.error.issues);
        else await save.mutateAsync({ data: { section, data: result.data, sourceAgentRunId: fillRunId ?? undefined } });
        break;
      }
      case 'constraints': {
        const result = constraintsSectionSchema.safeParse(values.constraints ?? {});
        if (!result.success) fail('constraints', result.error.issues);
        else await save.mutateAsync({ data: { section, data: result.data, sourceAgentRunId: fillRunId ?? undefined } });
        break;
      }
      case 'performance': {
        const result = performanceSectionSchema.safeParse(values.currentPerformance ?? {});
        if (!result.success) fail('currentPerformance', result.error.issues);
        else {
          // The generated request type models `baselineDate` (OpenAPI
          // date-time) as `Date`, while the rest of the app carries dates as
          // ISO strings; JSON.stringify converts a Date back to the same ISO
          // string on the wire, so this is a representation change, not a
          // narrowing cast.
          const { baselineDate, ...performance } = result.data;
          await save.mutateAsync({
            data: {
              section,
              data: { ...performance, baselineDate: baselineDate ? new Date(baselineDate) : undefined },
              sourceAgentRunId: fillRunId ?? undefined,
            },
          });
        }
        break;
      }
      case 'activities': {
        const result = activitiesSectionSchema.safeParse(values.currentActivities ?? {});
        if (!result.success) fail('currentActivities', result.error.issues);
        else await save.mutateAsync({ data: { section, data: result.data, sourceAgentRunId: fillRunId ?? undefined } });
        break;
      }
      case 'projects': {
        const result = projectsSectionSchema.safeParse(values.projects ?? []);
        if (!result.success) fail('projects', result.error.issues);
        else await save.mutateAsync({ data: { section, data: result.data, sourceAgentRunId: fillRunId ?? undefined } });
        break;
      }
      case 'campaigns': {
        const result = campaignsSectionSchema.safeParse(values.campaigns ?? []);
        if (!result.success) fail('campaigns', result.error.issues);
        else await save.mutateAsync({ data: { section, data: result.data, sourceAgentRunId: fillRunId ?? undefined } });
        break;
      }
    }

    setErrors({});

    // Depois do save, e só depois: uma seção que reprovou validação não foi
    // revisada, foi abandonada no meio. A marca é o que apaga o "proposta
    // esperando revisão" na tela do negócio mesmo quando a seção foi salva
    // vazia — ver `reviewed-sections.ts`.
    const reviewedRun = fillRunId ?? fillRunParam;
    if (reviewedRun) markReviewed(reviewedRun, section);
  };

  const saveAndGo = async (to: string) => {
    try {
      await persist();
      navigate(to);
    } catch {
      /* error surfaced below via save.isError, or field errors via `errors` */
    }
  };

  // Undefined for `projects`/`campaigns`: neither fill agent proposes those
  // two sections (see the comment on `SECTION_FIELD`), so no button renders
  // there at all rather than one that would only ever error on click.
  const field = SECTION_FIELD[section];

  /**
   * Applies only THIS section's slice of whatever `filled` the run produced
   * — the whole-context proposal fills seven sections at once, and a section
   * page must never reach into another section's data. Arrays get an `id`
   * per row here, right before `setValue`: the agent never emits one (by
   * design — a model inventing ids produces collisions the form has no way
   * to detect), and the array steps' own `Repeater` needs a stable key.
   */
  const applyFilledSlice = (filled: unknown, runId: string) => {
    if (!field) return;
    const slice = (filled as Record<string, unknown> | null)?.[field];
    if (slice === undefined) return;
    const withIds = Array.isArray(slice) ? slice.map((item) => ({ ...(item as object), id: nanoid() })) : slice;
    form.setValue(field as keyof BusinessContextData, withIds as never, { shouldDirty: true });
    setFillRunId(runId);
  };

  /**
   * `path` is a full context path (`currentPerformance.mrr`); the form is
   * keyed the same way. Also records `runId` as `fillRunId`, exactly like
   * `applyFilledSlice` does: a section resolved purely by answering panel
   * questions (`performance`'s eight founder-only metrics are entirely this
   * case — `propose-context-section`'s `filled` never has a branch for
   * `currentPerformance` at all) must still save as `source: AI`. The AI
   * asked the question either way; `source` says it participated, not that it
   * wrote the number itself.
   */
  const applyAnswer = (path: string, value: string | number, runId: string) => {
    form.setValue(path as never, value as never, { shouldDirty: true });
    setFillRunId(runId);
  };

  /**
   * The whole-context proposal's `questions` span every section it covers —
   * `marketContext`, `constraints`, `currentPerformance`, `currentActivities`
   * — in one array. Without this, a founder on the `company` page could be
   * asked (and answer) their MRR through the adopted button, only to have
   * `persist()` silently drop it: `company`'s save only ever reads
   * `values.companyProfile`. Applied to both branches for the same reason
   * `SECTION_FIELD` itself exists once: `propose-context-section` already
   * scopes its own questions server-side (see `verifySection` in
   * `back/src/ai/agents/fill/propose-context-section.ts`), so this is
   * belt-and-suspenders there and load-bearing for the adopted branch.
   */
  const questionBelongsToSection = (question: FillQuestion) => (field ? question.fills.startsWith(`${field}.`) : false);

  const fillButton = !field
    ? null
    : fillRunParam ? (
        <AiFillButton
          // Keyed by section: the whole-context run stays the SAME run across
          // every section page (same taskType, same id, same completed
          // proposal), so neither `useFillRun`'s internal state nor the
          // `onFilled`-fired-once guard would otherwise notice the section
          // changed — the walk-through's next page would show the button as
          // already resolved without ever applying ITS slice. Remounting per
          // section makes each page apply its own slice fresh, which is the
          // whole point of "the same run, section by section."
          key={section}
          taskType="propose-business-context"
          input={{ businessId: business.id }}
          allowedPaths={CONTEXT_FILL_PATHS}
          label={t('ai.fill.section.label')}
          matchesInput={(input) =>
            typeof input === 'object' && input !== null && (input as { businessId?: unknown }).businessId === business.id
          }
          filterQuestions={questionBelongsToSection}
          onFilled={applyFilledSlice}
          onAnswer={applyAnswer}
        />
      ) : (
        <AiFillButton
          key={section}
          taskType="propose-context-section"
          input={{ businessId: business.id, section }}
          allowedPaths={CONTEXT_FILL_PATHS}
          label={t('ai.fill.section.label')}
          matchesInput={(input) =>
            typeof input === 'object' && input !== null && (input as { section?: unknown }).section === section
          }
          filterQuestions={questionBelongsToSection}
          onFilled={applyFilledSlice}
          onAnswer={applyAnswer}
        />
      );

  return (
    <div className="pb-24">
      <Link to="/app/business" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t('pages.business.context.backToBusiness')}
      </Link>

      <PageHeader
        eyebrow={t('pages.business.context.eyebrow', { current: index + 1, total: CONTEXT_SECTIONS.length })}
        title={t(`wizard.steps.${section}.label`)}
        subtitle={t(`wizard.steps.${section}.description`)}
        right={
          <span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">{t('common.optional')}</span>
        }
      />

      {fillButton && <div className="mb-4">{fillButton}</div>}

      <Card>
        <CardContent className="p-6">
          <info.Component data={data} onChange={onChange} errors={errors} />
        </CardContent>
      </Card>

      {save.isError && <p className="mt-4 text-sm text-destructive">{t('pages.business.saveFailed')}</p>}

      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <span className="text-xs text-muted-foreground">
            {save.isPending
              ? t('common.saving')
              : form.formState.isDirty
                ? t('pages.business.context.unsaved')
                : save.isSuccess
                  ? t('pages.business.context.saved')
                  : `${info?.icon ?? ''} ${t(`wizard.steps.${section}.label`)}`}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" asChild>
              <Link to="/app/business">{t('common.cancel')}</Link>
            </Button>
            {next && (
              <Button
                variant="outline"
                disabled={save.isPending}
                // Carries the whole-context run forward while it's set: the
                // founder is walking through the same proposal one section at
                // a time, and without this only the very first section ever
                // sees it — the other six of a 5-credit run become
                // unreachable, and clicking "fill this section with AI" there
                // would start a brand-new, separately-billed run over data
                // already paid for.
                onClick={() =>
                  void saveAndGo(
                    `/app/business/context/${next.key}${fillRunParam ? `?fillRun=${fillRunParam}` : ''}`,
                  )
                }
                className="gap-2"
              >
                {t('pages.business.context.saveAndNext')} <ArrowRight className="size-4" />
              </Button>
            )}
            <Button disabled={save.isPending} onClick={() => void saveAndGo('/app/business')}>
              {save.isPending ? t('common.saving') : t('pages.business.context.saveAndClose')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
