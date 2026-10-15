import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePutIntegration } from '@/api/generated/hooks/integrationsHooks/usePutIntegration';
import { apiErrorMessage } from '@/lib/api-errors';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/form/TextField';
import { TextAreaField } from '@/components/form/TextAreaField';

const PROVIDER = 'GA4';

/**
 * O caminho de service account: uma chave JSON e um id de property.
 *
 * Continua existindo, e recolhido atrás de um disclosure: é o piso que funciona
 * sem depender de nenhuma verificação de app do Google, e é caro para o humano
 * — nove passos em três consoles. Piso, não porta de entrada.
 *
 * A credencial só viaja para cima. Ela nunca volta em resposta nenhuma (o
 * servidor a exclui por `select`, não por confiança), e o campo é limpo assim
 * que a gravação passa: um textarea que continua com a chave é o segredo em
 * tela por tempo indefinido.
 */
export function ServiceAccountForm({
  onConnected,
  onError,
}: {
  onConnected?: () => void;
  onError?: (message: string) => void;
}) {
  const { t } = useTranslation();
  const [propertyId, setPropertyId] = useState('');
  const [credentials, setCredentials] = useState('');

  const connect = usePutIntegration({
    mutation: {
      onSuccess: () => {
        setCredentials('');
        setPropertyId('');
        onConnected?.();
      },
      onError: (error) => onError?.(apiErrorMessage(error, t('pages.integrations.connectFailed'))),
    },
  });

  return (
    <div className="space-y-4">
      <TextField
        htmlFor="ga4-property"
        label={t('pages.integrations.propertyLabel')}
        helpTitle={t('pages.integrations.propertyHelpTitle')}
        help={t('pages.integrations.propertyHelp')}
        value={propertyId}
        onChange={setPropertyId}
      />
      <TextAreaField
        htmlFor="ga4-credentials"
        label={t('pages.integrations.credentialsLabel')}
        helpTitle={t('pages.integrations.credentialsHelpTitle')}
        help={t('pages.integrations.credentialsHelp')}
        value={credentials}
        onChange={setCredentials}
      />
      <Button
        size="sm"
        disabled={connect.isPending || propertyId.trim() === '' || credentials.trim() === ''}
        onClick={() =>
          connect.mutate({
            data: {
              provider: PROVIDER,
              authKind: 'SERVICE_ACCOUNT',
              externalId: propertyId.trim(),
              credentials,
            },
          })
        }
      >
        {connect.isPending ? t('pages.integrations.connecting') : t('pages.integrations.connect')}
      </Button>
    </div>
  );
}
