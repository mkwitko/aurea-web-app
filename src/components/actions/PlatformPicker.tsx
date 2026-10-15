import { useTranslation } from 'react-i18next';
import { platformLabel } from './PlatformNames';
import { PlatformIcon } from './PlatformIcon';
import { isVideoUrl } from './MediaPicker';
import { Help } from '@/components/Help';
import { Button } from '@/components/ui/button';

type Account = { id: string; platform: string; username: string | null; connected: boolean };

export type Capability = {
  platform: string;
  requiresMedia: boolean;
  accepts: string[];
  maxMedia: number;
  requiresTitle: boolean;
};

/**
 * Por que esta rede não pode receber este post, ou `null` quando pode.
 *
 * A regra não é escrita aqui: vem de `GET /actions/capabilities`, a mesma tabela
 * que o backend usa para recusar a criação. Esta função só traduz a tabela em
 * frase — se a tela tivesse a própria cópia, voltaria a prometer o que a API nega,
 * que foi o defeito do botão de retentar.
 */
export function mediaBlocker(
  capability: Capability | undefined,
  media: string[],
  t: (key: string, options?: Record<string, unknown>) => string,
): string | null {
  if (!capability) return null;

  if (capability.requiresMedia && media.length === 0) return t('pages.actions.form.platforms.needsMedia');

  const hasVideo = media.some(isVideoUrl);
  const kind = media.length === 0 ? null : hasVideo ? 'VIDEO' : 'IMAGE';
  if (kind && !capability.accepts.includes(kind)) {
    return t(kind === 'VIDEO' ? 'pages.actions.form.platforms.noVideo' : 'pages.actions.form.platforms.noImage');
  }

  if (media.length > capability.maxMedia) {
    return t('pages.actions.form.platforms.tooManyFor', { count: capability.maxMedia });
  }

  return null;
}

/**
 * As redes que este post vai atingir.
 *
 * Mostra a conta ao lado da rede — `LinkedIn · @acme` — porque é numa conta que o
 * post sai, e o cliente precisa reconhecer qual.
 *
 * A conta desconectada aparece desabilitada com o motivo: publicar nela falharia,
 * e o backend a recusa de todo jeito. Mostrá-la selecionável seria prometer o que
 * não acontece. Uma rede que não aceita o arquivo escolhido é desabilitada pelo
 * mesmo princípio, e o motivo é dito na hora — não depois da aprovação.
 */
export function PlatformPicker({
  accounts,
  selected,
  onChange,
  media = [],
  capabilities = [],
}: {
  accounts: Account[];
  selected: string[];
  onChange: (platforms: string[]) => void;
  media?: string[];
  capabilities?: Capability[];
}) {
  const { t } = useTranslation();
  const byPlatform = new Map(capabilities.map((row) => [row.platform, row]));

  const toggle = (platform: string): void => {
    onChange(selected.includes(platform) ? selected.filter((item) => item !== platform) : [...selected, platform]);
  };

  return (
    <div>
      <p className="text-sm font-medium">
        {t('pages.actions.form.platformsLabel')}
        <Help title={t('pages.actions.form.platformsHelpTitle')}>{t('pages.actions.form.platformsHelp')}</Help>
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        {accounts.map((account) => {
          const blocker = mediaBlocker(byPlatform.get(account.platform), media, t);

          return (
            <Button
              key={account.platform}
              size="sm"
              variant={selected.includes(account.platform) ? 'default' : 'outline'}
              disabled={!account.connected || (blocker !== null && !selected.includes(account.platform))}
              aria-pressed={selected.includes(account.platform)}
              onClick={() => toggle(account.platform)}
            >
              <PlatformIcon platform={account.platform} />
              {platformLabel(account.platform)}
              {account.username && ` · ${account.username}`}
              {!account.connected && ` · ${t('pages.integrations.social.reconnect')}`}
              {/* O motivo junto do botão: "TikTok · precisa de imagem ou vídeo"
                  diz o que fazer, um botão cinza não diz nada. */}
              {account.connected && blocker && ` · ${blocker}`}
            </Button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t('pages.actions.form.platformsCount', { count: selected.length })}
        </p>
      )}
    </div>
  );
}
