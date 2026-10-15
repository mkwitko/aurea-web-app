import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FlaskConical } from 'lucide-react';
import { Help } from '@/components/Help';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Um teste que terminou e cujo número não chegou. `endDate` é string porque a
 * resposta chega como ISO — o Kubb tipa `Date` a partir do `date-time` do
 * OpenAPI, mas nada aqui recebe uma instância viva (mesmo fato que
 * `NextActionCard` e `LoopPanel` documentam).
 */
export type PendingMeasurementItem = {
  experimentId: string;
  name: string;
  metric: string;
  endDate: string | null;
};

/**
 * O que o loop está esperando do fundador.
 *
 * Sem veredito e sem cor de resultado: um teste sem número não é um teste que
 * deu errado, é um teste que ninguém leu ainda.
 */
export function PendingMeasurementCard({ count, items }: { count: number; items: PendingMeasurementItem[] }) {
  const { t, i18n } = useTranslation();

  if (count === 0) return null;

  const hidden = count - items.length;
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(value));

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <p className="text-sm font-medium">
          <FlaskConical className="mr-2 inline size-4" aria-hidden />
          {t('app.dashboard.pendingMeasurement.title', { count })}
          <Help title={t('app.dashboard.pendingMeasurement.helpTitle')}>
            {t('app.dashboard.pendingMeasurement.help')}
          </Help>
        </p>

        <ul className="space-y-2">
          {items.map((entry) => (
            <li key={entry.experimentId} className="text-sm">
              <Link
                to={`/app/experiments/${entry.experimentId}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {entry.name}
              </Link>
              <span className="text-muted-foreground">
                {' · '}
                {entry.metric}
                {entry.endDate && ` · ${t('app.dashboard.pendingMeasurement.ended', { date: formatDate(entry.endDate) })}`}
              </span>
            </li>
          ))}
        </ul>

        {hidden > 0 && (
          <p className="text-xs text-muted-foreground">
            {t('app.dashboard.pendingMeasurement.more', { count: hidden })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
