import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, ChevronRight, CheckCircle2, Circle, Plus, Rocket, Trash2, Pencil } from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { BusinessProfileForm } from '@/components/business/BusinessProfileForm';
import { IcpsPanel } from '@/components/icps/IcpsPanel';
import { useQueryClient } from '@tanstack/react-query';
import { useGetBusiness } from '@/api/generated/hooks/businessHooks/useGetBusiness';
import { useGetBusinessContext } from '@/api/generated/hooks/businessHooks/useGetBusinessContext';
import { useDeleteBusiness } from '@/api/generated/hooks/businessHooks/useDeleteBusiness';
import { BUSINESS, DASHBOARD } from '@/api/modules';
import { Help } from '../components/Help';
import { PageHeader } from '../components/PageHeader';
import { LoopRail } from '../components/LoopRail';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { apiErrorMessage } from '@/lib/api-errors';
import { CONTEXT_FILL_PATHS } from '@/lib/fill-paths';
import { AiFillButton } from '@/components/ai/AiFillButton';
import { AI_FILLED_SECTION_COUNT, CONTEXT_SECTIONS, isAiFilled } from '@/components/BusinessContextWizard/sectionRegistry';
import type { BusinessContextVersion } from '@/types/business-context';

export type BusinessTab = 'context' | 'profile' | 'icps';

/** Abas por rota: cada aba é um destino navegável, não estado local. */
function BusinessTabs({ active }: { active: BusinessTab }) {
  const { t } = useTranslation();
  const tabs: { key: BusinessTab; to: string }[] = [
    { key: 'context', to: '/app/business' },
    { key: 'profile', to: '/app/business/profile' },
    { key: 'icps', to: '/app/business/icps' },
  ];
  return (
    <div role="tablist" aria-label={t('app.nav.business')} className="mb-6 flex gap-1 border-b border-border/70">
      {tabs.map(({ key, to }) => (
        <NavLink
          key={key}
          to={to}
          end
          role="tab"
          aria-selected={key === active}
          className={cn(
            '-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition-colors',
            key === active
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t(`pages.business.tabs.${key}`)}
        </NavLink>
      ))}
    </div>
  );
}

export function BusinessPage({ tab = 'context' }: { tab?: BusinessTab }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetBusiness();
  const business = data?.business;
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: contextData } = useGetBusinessContext({ query: { enabled: !!business } });
  const context = contextData?.currentVersion as BusinessContextVersion | null | undefined;
  const completeness = context?.completeness ?? 0;
  const incompleteSections = context?.incompleteSections ?? CONTEXT_SECTIONS.map((s) => s.key);

  const deleteBusiness = useDeleteBusiness({
    mutation: {
      onMutate: () => setDeleteError(null),
      onSuccess: async () => {
        // O dashboard também: ele conta o negócio para decidir se a etapa de
        // setup está feita, então sem esta invalidação a home continua
        // dizendo que existe um negócio logo depois de o fundador excluí-lo —
        // e é para a home que este navigate manda.
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: BUSINESS.queryKeyRoot }),
          queryClient.invalidateQueries({ queryKey: DASHBOARD.queryKeyRoot }),
        ]);
        navigate('/app');
      },
      // Staying put with the reason on screen: navigating away from a delete
      // that did not happen reads exactly like one that did, and the backend
      // knows why it refused (a business with active goals, say).
      onError: (error) => setDeleteError(apiErrorMessage(error, t('pages.business.deleteFailed'))),
    },
  });

  const matchesThisBusiness = (input: unknown): boolean =>
    typeof input === 'object' && input !== null && (input as { businessId?: unknown }).businessId === business?.id;

  // Um run de contexto inteiro agora grava as seções sozinho no servidor
  // (applyOutput do propose-business-context): a badge "rascunho da IA" por
  // seção vem da proveniência gravada, não de uma proposta pendente que o
  // fundador precisa colher tela a tela.
  const sectionMeta = context?.sectionMeta ?? {};

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> {t('common.loading')}
      </p>
    );
  }

  if (!business) {
    // A aba de perfil é o próprio formulário de criação — o empty state das
    // outras abas aponta para ela.
    if (tab === 'profile') {
      return (
        <div>
          <LoopRail />
          <PageHeader eyebrow={t('app.nav.business')} title={t('pages.business.setup.title')} subtitle={t('pages.business.setup.subtitle')} />
          <BusinessTabs active="profile" />
          <BusinessProfileForm />
        </div>
      );
    }
    return (
      <div>
        <LoopRail />
        <PageHeader eyebrow={t('app.nav.business')} title={t('pages.business.title')} subtitle={t('pages.business.subtitle')} />
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Rocket className="size-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">{t('pages.business.setupTitle')}</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">{t('pages.business.setupBody')}</p>
            <Link to="/app/business/profile">
              <Button size="lg" className="gap-2">
                {t('pages.business.setupButton')} <ChevronRight className="size-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const nextSection = CONTEXT_SECTIONS.find((s) => incompleteSections.includes(s.key))?.key;

  const progressText =
    completeness === 100
      ? t('pages.business.progressComplete')
      : t('pages.business.progressLabel', { pct: completeness, missing: incompleteSections.length });

  if (tab === 'profile') {
    return (
      <div>
        <LoopRail />
        <PageHeader
          eyebrow={t('app.nav.business')}
          title={business.name}
          subtitle={t('pages.business.setup.subtitle')}
        />
        <BusinessTabs active="profile" />
        <BusinessProfileForm />
      </div>
    );
  }

  if (tab === 'icps') {
    return (
      <div>
        <LoopRail />
        <PageHeader
          eyebrow={t('app.nav.business')}
          title={business.name}
          help={<Help title={t('pages.icps.helpTitle')}>{t('pages.icps.help')}</Help>}
          subtitle={t('pages.icps.subtitle')}
          right={
            <Button asChild>
              <Link to="/app/icps/new">
                <Plus className="size-4" /> {t('crud.new')}
              </Link>
            </Button>
          }
        />
        <BusinessTabs active="icps" />
        <IcpsPanel />
      </div>
    );
  }

  return (
    <div>
      <LoopRail />
      <PageHeader
        eyebrow={t('app.nav.business')}
        title={business.name}
        help={<Help title={t('pages.business.cardHelpTitle')}>{t('pages.business.cardHelp')}</Help>}
        subtitle={t('pages.business.subtitle')}
      />
      <BusinessTabs active="context" />

      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 flex-1 min-w-0">
                {business.website && (
                  <a href={business.website} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline block truncate">
                    {business.website}
                  </a>
                )}
                {business.industry && <p className="text-sm text-muted-foreground">{business.industry}</p>}
                {business.valueProposition && <p className="text-sm text-muted-foreground max-w-lg">{business.valueProposition}</p>}
                {!business.website && !business.industry && !business.valueProposition && (
                  <p className="text-sm text-muted-foreground">{t('pages.business.noBusiness')}</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Link to="/app/business/profile">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Pencil className="size-4" /> {t('pages.business.editInfo')}
                  </Button>
                </Link>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" aria-label={t('pages.business.deleteTitle')}>
                      <Trash2 className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('pages.business.deleteTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>{t('pages.business.deleteBody')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteBusiness.mutate()}
                        disabled={deleteBusiness.isPending}
                        className="bg-destructive text-white hover:bg-destructive/90"
                      >
                        {deleteBusiness.isPending ? t('common.deleting') : t('common.confirm')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
            {/* Outside the dialog on purpose: the dialog closes on confirm, so
                a message inside it would be unmounted before it could be read. */}
            {deleteError && <p className="mt-4 text-sm text-destructive">{deleteError}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{progressText}</p>
                <p className="text-xs text-muted-foreground">{t('pages.business.contextHint')}</p>
              </div>
              {nextSection && (
                <Link to={`/app/business/context/${nextSection}`} className="shrink-0">
                  <Button size="sm" className="gap-2">
                    {t('pages.business.continueContext')} <ChevronRight className="size-4" />
                  </Button>
                </Link>
              )}
            </div>

            <div className="mb-4">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${completeness === 100 ? 'bg-emerald-500' : completeness >= 60 ? 'bg-primary' : completeness >= 30 ? 'bg-amber-500' : 'bg-muted-foreground/30'}`}
                  style={{ width: `${completeness}%` }}
                />
              </div>
            </div>

            <div className="mb-4">
              <AiFillButton
                taskType="propose-business-context"
                input={business ? { businessId: business.id } : null}
                allowedPaths={CONTEXT_FILL_PATHS}
                // O número vem do registro, não do texto: "preencher tudo"
                // mentia — projetos e campanhas o agente nunca propõe, e prometer
                // as nove e entregar sete é a pior forma de gastar crédito do
                // fundador.
                label={t('ai.fill.context.label', { count: AI_FILLED_SECTION_COUNT })}
                matchesInput={matchesThisBusiness}
                // O servidor grava as seções ao completar o run (applyOutput);
                // aqui só falta buscar o contexto novo para o grid refletir o
                // que acabou de ser escrito — em vez de mandar o fundador
                // colher seção a seção como antes.
                onFilled={() => {
                  void queryClient.invalidateQueries({ queryKey: BUSINESS.queryKeyRoot });
                  void queryClient.invalidateQueries({ queryKey: DASHBOARD.queryKeyRoot });
                }}
                // Esta tela não salva respostas — `onAnswer` aqui é no-op, e um
                // painel que pergunta e descarta é pior do que não perguntar.
                // As perguntas do run pertencem às telas de seção, que sabem em
                // qual campo escrever cada `fills` (`filterQuestions` +
                // `applyAnswer` em BusinessContextSectionPage).
                filterQuestions={() => false}
                onAnswer={() => undefined}
              />
              {/* O custo por seção fica aqui e não no botão: o botão já imprime
                  o preço do run em bloco, e é a comparação entre os dois que
                  responde "vale a pena?". */}
              <p className="mt-1.5 text-xs text-muted-foreground">{t('ai.fill.context.scope')}</p>
              {/* Legenda da marca azul dos cartões. Fica junto do botão de bloco
                  porque é ali que a pergunta nasce ("quais seções isto cobre?"),
                  e visível em vez de só no hover: num telefone não existe hover,
                  e uma marca de cor que ninguém consegue decifrar é ruído. */}
              <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span aria-hidden="true" className="inline-block h-3 w-0.5 shrink-0 rounded-full bg-primary" />
                {t('pages.business.sectionLegend')}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CONTEXT_SECTIONS.map((section) => {
                const isDone = !incompleteSections.includes(section.key);
                // O rascunho da IA fica gravado com proveniência por seção
                // (chaveada pelo campo de dados, como o backend grava); a
                // badge some quando o fundador salva a seção (vira USER).
                const isAiDraft = section.field != null && sectionMeta[section.field]?.source === 'AI';
                return (
                  <Link
                    key={section.key}
                    to={`/app/business/context/${section.key}`}
                    className={`group flex items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/50 ${
                      isDone ? 'border-primary/40 bg-primary/5' : 'border-border'
                    } ${
                      // A marca da IA é a barra azul à esquerda, não a borda
                      // inteira: a borda inteira já é do estado "concluída"
                      // (verde), e as duas informações precisam caber no mesmo
                      // cartão ao mesmo tempo.
                      isAiFilled(section) ? 'border-l-2 border-l-primary' : ''
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    ) : (
                      <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {t(`pages.business.sections.${section.key}`)}
                        </span>
                        {/* A barra azul do cartão é só cor, e cor sozinha não
                            chega a quem usa leitor de tela — o mesmo fato vai
                            escrito aqui, fora da tela. */}
                        <span className="sr-only">
                          {t(isAiFilled(section) ? 'pages.business.sectionMarker.ai' : 'pages.business.sectionMarker.manual')}
                        </span>
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {t(`wizard.steps.${section.key}.description`)}
                      </span>
                      {/* O que a IA escreveu e o fundador ainda não confirmou.
                          Editar e salvar a seção transfere a autoria (USER) e
                          apaga a marca. */}
                      {isAiDraft && (
                        <span className="mt-1 block text-xs font-medium text-primary">
                          {t('pages.business.aiDraft')}
                        </span>
                      )}
                    </span>
                    <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
