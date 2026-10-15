import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useListGoogleProperties } from '@/api/generated/hooks/integrationsHooks/useListGoogleProperties';
import { useSelectGoogleProperty } from '@/api/generated/hooks/integrationsHooks/useSelectGoogleProperty';
import { listIntegrationsQueryKey } from '@/api/generated/hooks/integrationsHooks/useListIntegrations';
import { apiErrorMessage } from '@/lib/api-errors';
import { Help } from '@/components/Help';
import { SectionLoading } from '@/components/SectionState';
import { Button } from '@/components/ui/button';

/**
 * Escolher a property por nome.
 *
 * É o motivo de o OAuth existir: o fundador reconhece "Site institucional"; ele
 * não reconhece `123456789`.
 */
export function PropertyPicker({
  current,
  onSelected,
  onCancel,
}: {
  current: string | null;
  onSelected?: () => void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [chosen, setChosen] = useState<string | null>(current);
  const [error, setError] = useState<string | null>(null);

  const properties = useListGoogleProperties({ query: { retry: false } });

  const select = useSelectGoogleProperty({
    mutation: {
      onMutate: () => setError(null),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: listIntegrationsQueryKey() });
        onSelected?.();
      },
      onError: (err) => setError(apiErrorMessage(err, t('pages.integrations.picker.failed'))),
    },
  });

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">
        {t('pages.integrations.picker.title')}
        <Help title={t('pages.integrations.picker.helpTitle')}>{t('pages.integrations.picker.help')}</Help>
      </p>

      {properties.isLoading && <SectionLoading />}

      {properties.isError && (
        <p className="text-sm text-destructive">
          {apiErrorMessage(properties.error, t('pages.integrations.picker.failed'))}
        </p>
      )}

      {properties.data && properties.data.properties.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('pages.integrations.picker.empty')}</p>
      )}

      {properties.data && properties.data.properties.length > 0 && (
        <>
          <ul className="space-y-2">
            {properties.data.properties.map((property) => (
              <li key={property.propertyId}>
                <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/50">
                  <input
                    type="radio"
                    name="ga4-property"
                    className="mt-1"
                    value={property.propertyId}
                    checked={chosen === property.propertyId}
                    onChange={() => setChosen(property.propertyId)}
                  />
                  <span>
                    <span className="block text-sm font-medium">{property.displayName}</span>
                    <span className="block text-xs text-muted-foreground">{property.accountName}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          {/* O corte declarado: uma property ausente da lista não é uma
              property inexistente. */}
          {properties.data.truncated && (
            <p className="text-xs text-muted-foreground">{t('pages.integrations.picker.truncated')}</p>
          )}
        </>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={chosen === null || select.isPending}
          onClick={() => chosen && select.mutate({ data: { propertyId: chosen } })}
        >
          {select.isPending ? t('pages.integrations.picker.selecting') : t('pages.integrations.picker.select')}
        </Button>
        {onCancel && (
          <Button size="sm" variant="outline" onClick={onCancel}>
            {t('pages.integrations.picker.cancel')}
          </Button>
        )}
      </div>
    </div>
  );
}
