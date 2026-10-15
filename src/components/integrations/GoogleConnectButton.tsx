import { useTranslation } from 'react-i18next';
import { useAuthorizeGoogle } from '@/api/generated/hooks/integrationsHooks/useAuthorizeGoogle';
import { apiErrorMessage } from '@/lib/api-errors';
import { Button } from '@/components/ui/button';

/**
 * Pede a url de consentimento e navega.
 *
 * A url é montada pelo servidor, não aqui: ela carrega o `state` assinado, e um
 * frontend que montasse a url seria um frontend decidindo em qual workspace
 * gravar.
 */
export function GoogleConnectButton({
  label,
  onError,
  onBeforeStart,
}: {
  label: string;
  onError?: (message: string) => void;
  /** Devolve false para abortar — é onde a confirmação de substituição entra. */
  onBeforeStart?: () => boolean;
}) {
  const { t } = useTranslation();

  const authorize = useAuthorizeGoogle({
    mutation: {
      onSuccess: (data) => window.location.assign(data.url),
      onError: (error) => onError?.(apiErrorMessage(error, t('pages.integrations.google.failed'))),
    },
  });

  return (
    <Button
      size="sm"
      disabled={authorize.isPending}
      onClick={() => {
        if (onBeforeStart && !onBeforeStart()) return;
        authorize.mutate();
      }}
    >
      {authorize.isPending ? t('pages.integrations.google.connecting') : label}
    </Button>
  );
}
