import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useListActions } from '@/api/generated/hooks/actionsHooks/useListActions';
import { PageHeader } from '@/components/PageHeader';
import { Help } from '@/components/Help';
import { SectionLoading, SectionLoadError } from '@/components/SectionState';
import { ActionStatusBadge } from '@/components/actions/ActionStatusBadge';
import { platformLabel } from '@/components/actions/PlatformNames';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const FILTERS = [
  'all',
  'PROPOSED',
  'PENDING_APPROVAL',
  'APPROVED',
  'EXECUTED',
  'PARTIALLY_EXECUTED',
  'FAILED',
  'DELIVERY_UNKNOWN',
] as const;

export function ActionsPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');

  // O filtro vai para o servidor, e não é aplicado no cliente: filtrar uma
  // página no cliente esconde o que não veio nela.
  const actions = useListActions(filter === 'all' ? {} : { status: filter });

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={t('app.nav.actions')}
        title={t('pages.actions.title')}
        help={<Help title={t('pages.actions.helpTitle')}>{t('pages.actions.help')}</Help>}
        subtitle={t('pages.actions.subtitle')}
        right={
          <Button asChild size="sm">
            <Link to="/app/actions/new">{t('pages.actions.new')}</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <Button
            key={option}
            size="sm"
            variant={filter === option ? 'default' : 'outline'}
            onClick={() => setFilter(option)}
          >
            {t(`pages.actions.filter.${option}`)}
          </Button>
        ))}
      </div>

      {actions.isLoading && <SectionLoading />}
      {actions.isError && <SectionLoadError refetch={[actions.refetch]} />}

      {actions.data?.actions.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('pages.actions.empty')}</p>
      )}

      <ul className="space-y-3">
        {actions.data?.actions.map((action) => (
          <li key={action.id}>
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <Link to={`/app/actions/${action.id}`} className="text-sm font-medium hover:underline">
                    {action.name}
                  </Link>
                  {/* As redes do post, não um canal só: é o que a linha precisa
                      dizer para o fundador reconhecer a ação numa lista. */}
                  <p className="text-xs text-muted-foreground">
                    {action.targets.map((target) => platformLabel(target.platform)).join(' · ')}
                  </p>
                </div>
                <ActionStatusBadge status={action.status} />
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
