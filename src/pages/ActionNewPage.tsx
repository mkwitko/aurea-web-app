import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useCreateAction } from '@/api/generated/hooks/actionsHooks/useCreateAction';
import { useListSocialAccounts } from '@/api/generated/hooks/integrationsHooks/useListSocialAccounts';
import { useListExperiments } from '@/api/generated/hooks/experimentsHooks/useListExperiments';
import { useFillRun } from '@/components/ai/useFillRun';
import { apiErrorMessage } from '@/lib/api-errors';
import { proposeSocialPostOutput } from '@/schemas/social-post';
import { PageHeader } from '@/components/PageHeader';
import { Help } from '@/components/Help';
import { SectionLoading } from '@/components/SectionState';
import { useListActionCapabilities } from '@/api/generated/hooks/actionsHooks/useListActionCapabilities';
import { PlatformPicker, mediaBlocker, type Capability } from '@/components/actions/PlatformPicker';
import { MediaPicker } from '@/components/actions/MediaPicker';
import { platformLabel } from '@/components/actions/PlatformNames';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TextField } from '@/components/form/TextField';
import { TextAreaField } from '@/components/form/TextAreaField';
import { SelectField } from '@/components/form/SelectField';

const TASK_TYPE = 'propose-social-post';

export function ActionNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [experimentId, setExperimentId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const accounts = useListSocialAccounts();
  const experiments = useListExperiments({});
  // A matriz de capacidade vem do backend, e não de uma cópia aqui: é a mesma
  // tabela que recusa a criação.
  const capabilities = useListActionCapabilities();

  // Conta desconectada não é publicável: o backend a recusa, e o agente não deve
  // sugerir a rede dela.
  const usable = (accounts.data?.accounts ?? []).filter((account) => account.connected);

  /**
   * O agente recebe as redes conectadas e sugere entre elas. Sem nenhuma não há o
   * que pedir — `input: null` deixa `start()` inerte, que é o comportamento do
   * hook.
   */
  const run = useFillRun({
    taskType: TASK_TYPE,
    input:
      usable.length > 0
        ? {
            connected: usable.map((account) => account.platform),
            ...(experimentId ? { experimentId } : {}),
            ...(brief.trim() ? { brief: brief.trim() } : {}),
          }
        : null,
    startFailedMessage: t('ai.fill.failed'),
  });

  const proposal = run.state === 'done' ? proposeSocialPostOutput.safeParse(run.output) : null;

  const create = useCreateAction({
    mutation: {
      onMutate: () => setError(null),
      onSuccess: (data) => navigate(`/app/actions/${data.action.id}`),
      onError: (err) => setError(apiErrorMessage(err, t('pages.actions.form.createFailed'))),
    },
  });

  if (accounts.isLoading) return <SectionLoading />;

  // Sem rede conectada não há para onde publicar. Deixar o fundador escrever um
  // post inteiro para descobrir isso no fim é desperdiçar o trabalho dele.
  if ((accounts.data?.accounts ?? []).length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow={t('app.nav.actions')} title={t('pages.actions.new')} />
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-sm">{t('pages.actions.form.needsSocial')}</p>
            <Button asChild size="sm">
              <Link to="/app/settings/integrations">{t('pages.actions.form.goToIntegrations')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /**
   * A matriz normalizada para `string`.
   *
   * O Kubb tipa `platform` e `accepts` como enums gerados do contrato, e o resto da
   * tela trata rede como `string` — o mesmo que `PLATFORM_LABEL` e o seletor fazem.
   * A conversão fica num lugar só, aqui.
   */
  const rules: Capability[] = (capabilities.data?.capabilities ?? []).map((row) => ({
    platform: String(row.platform),
    requiresMedia: row.requiresMedia,
    accepts: row.accepts.map(String),
    maxMedia: row.maxMedia,
    requiresTitle: row.requiresTitle,
  }));
  const byPlatform = new Map(rules.map((row) => [row.platform, row]));

  /**
   * As redes escolhidas que este arquivo não satisfaz.
   *
   * Elas continuam selecionáveis e visíveis com o motivo, em vez de sair da
   * seleção sozinhas: tirar uma rede que o fundador escolheu mudaria o destino do
   * post sem ele pedir. Criar fica bloqueado até ele resolver — trocando o arquivo
   * ou desmarcando a rede.
   */
  const blocked = platforms
    .map((platform) => ({ platform, why: mediaBlocker(byPlatform.get(platform), media, t) }))
    .filter((row): row is { platform: string; why: string } => row.why !== null);

  // O título existe por causa do YouTube, que não publica sem ele.
  const needsTitle = platforms.some((platform) => byPlatform.get(platform)?.requiresTitle);

  const ready =
    name.trim() !== '' &&
    content.trim() !== '' &&
    platforms.length > 0 &&
    blocked.length === 0 &&
    (!needsTitle || title.trim() !== '');

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={t('app.nav.actions')}
        title={t('pages.actions.new')}
        help={<Help title={t('pages.actions.helpTitle')}>{t('pages.actions.help')}</Help>}
      />

      <Card>
        <CardContent className="space-y-4 p-5">
          <TextField
            htmlFor="action-name"
            label={t('pages.actions.form.nameLabel')}
            helpTitle={t('pages.actions.form.nameHelpTitle')}
            help={t('pages.actions.form.nameHelp')}
            value={name}
            onChange={setName}
          />

          <PlatformPicker
            accounts={accounts.data?.accounts ?? []}
            selected={platforms}
            onChange={setPlatforms}
            media={media}
            capabilities={rules}
          />

          {blocked.length > 0 && (
            <p className="text-sm text-destructive">
              {blocked.map((row) => `${platformLabel(row.platform)}: ${row.why}`).join(' · ')}
            </p>
          )}

          <SelectField
            htmlFor="action-experiment"
            label={t('pages.actions.form.experimentLabel')}
            helpTitle={t('pages.actions.form.experimentHelpTitle')}
            help={t('pages.actions.form.experimentHelp')}
            value={experimentId}
            onChange={setExperimentId}
            clearLabel={t('pages.actions.form.noExperiment')}
            options={(experiments.data?.experiments ?? []).map((item) => ({
              value: item.id,
              labelKey: item.name,
            }))}
            translate={(label) => label}
          />

          <TextAreaField
            htmlFor="action-brief"
            label={t('pages.actions.form.briefLabel')}
            value={brief}
            onChange={setBrief}
          />

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={usable.length === 0 || run.isStarting || run.state === 'running'}
              onClick={() => run.start()}
            >
              {t('pages.actions.form.generate')}
            </Button>
            {run.error && <span className="text-sm text-destructive">{run.error}</span>}
          </div>

          {/* A proposta preenche os campos; ela não cria nada. Confirmar é humano. */}
          {proposal?.success && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (proposal.data.filled.name) setName(proposal.data.filled.name);
                if (proposal.data.filled.payload?.content) setContent(proposal.data.filled.payload.content);
                // A sugestão de rede é filtrada contra o que está conectado agora:
                // o modelo não sabe o que o cliente autorizou desde então.
                if (proposal.data.filled.platforms) {
                  const connected = new Set<string>(usable.map((account) => account.platform));
                  setPlatforms(proposal.data.filled.platforms.filter((platform) => connected.has(platform)));
                }
              }}
            >
              {t('pages.actions.form.applyProposal')}
            </Button>
          )}

          <TextAreaField
            htmlFor="action-content"
            label={t('pages.actions.form.contentLabel')}
            value={content}
            onChange={setContent}
          />

          <MediaPicker urls={media} onChange={setMedia} />

          {/* Só aparece quando alguma rede escolhida exige título — hoje o
              YouTube. Cobrar título de quem só publica no X seria campo a mais
              sem motivo. */}
          {needsTitle && (
            <TextField
              htmlFor="action-title"
              label={t('pages.actions.form.videoTitleLabel')}
              helpTitle={t('pages.actions.form.videoTitleHelpTitle')}
              help={t('pages.actions.form.videoTitleHelp')}
              value={title}
              onChange={setTitle}
            />
          )}

          <Button
            size="sm"
            disabled={!ready || create.isPending}
            onClick={() =>
              create.mutate({
                data: {
                  type: 'SOCIAL_POST',
                  name: name.trim(),
                  ...(experimentId ? { experimentId } : {}),
                  // `media` só quando há imagem: o backend trata ausência e lista
                  // vazia de formas diferentes, e o provider espera o campo
                  // ausente num post de texto puro.
                  payload: {
                    content,
                    ...(media.length > 0 ? { media } : {}),
                    ...(needsTitle && title.trim() ? { title: title.trim() } : {}),
                  },
                  platforms: platforms as never,
                },
              })
            }
          >
            {create.isPending ? t('pages.actions.form.creating') : t('pages.actions.form.create')}
          </Button>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
