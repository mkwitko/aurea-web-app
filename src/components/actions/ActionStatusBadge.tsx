import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

// DELIVERY_UNKNOWN e FAILED pedem atenção; o resto é neutro. `badge.tsx` não tem
// variante `destructive` (só o botão tem) — a ênfase de erro é o mesmo token de
// texto usado em toda mensagem de erro do produto, sobre o contorno neutro do
// badge, e não uma variante inventada.
const ATTENTION = ['FAILED', 'DELIVERY_UNKNOWN', 'PARTIALLY_EXECUTED'];

function attentionClass(status: string): string | undefined {
  return ATTENTION.includes(status) ? 'border-destructive/40 text-destructive' : undefined;
}

/**
 * O status da ação.
 *
 * `EXECUTED` finalmente diz **"Publicado"**: o desfecho vem de uma leitura
 * autenticada do provider, com o id e a URL do post real. No desenho anterior,
 * com o Postiz, o que se sabia era só "entregue" — o `state` devolvido era
 * `QUEUE` e a publicação acontecia depois, lá dentro, sem nos avisar.
 */
export function ActionStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();

  return (
    <Badge variant="outline" className={attentionClass(status)}>
      {t(`pages.actions.status.${status}`)}
    </Badge>
  );
}

/**
 * O status de um alvo — o ciclo de *entrega* de uma rede, que não é o de
 * *aprovação* da ação. Vocabulário separado porque `PUBLISHING` e `PENDING` não
 * existem no ciclo humano.
 */
export function ActionTargetStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();

  return (
    <Badge variant="outline" className={attentionClass(status)}>
      {t(`pages.actions.targetStatus.${status}`)}
    </Badge>
  );
}
