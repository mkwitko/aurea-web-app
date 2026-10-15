import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSubmitAction } from '@/api/generated/hooks/actionsHooks/useSubmitAction';
import { useApproveAction } from '@/api/generated/hooks/actionsHooks/useApproveAction';
import { useRejectAction } from '@/api/generated/hooks/actionsHooks/useRejectAction';
import { apiErrorMessage } from '@/lib/api-errors';
import { Button } from '@/components/ui/button';
import { TextAreaField } from '@/components/form/TextAreaField';

type ActionLike = { id: string; status: string };

type ApprovalLike = {
  id: string;
  requestedBy: string;
  reviewedBy: string | null;
  status: string;
  comment: string | null;
  requestedAt: string | Date;
  reviewedAt: string | Date | null;
};

/**
 * O ciclo humano: submeter, aprovar, rejeitar.
 *
 * Os botões aparecem por estado, e nunca dois atos no mesmo lugar: aprovar em
 * `PROPOSED` não existe, e submeter em `PENDING_APPROVAL` também não. É a
 * mesma regra do backend, dita na tela.
 */
export function ActionApprovalPanel({
  action,
  approvals,
  onChanged,
}: {
  action: ActionLike;
  approvals: ApprovalLike[];
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onError = (err: unknown) => setError(apiErrorMessage(err, t('pages.actions.detail.actionFailed')));
  const mutation = { onMutate: () => setError(null), onSuccess: () => onChanged(), onError };

  const submit = useSubmitAction({ mutation });
  const approve = useApproveAction({ mutation });
  const reject = useRejectAction({ mutation });

  return (
    <div className="space-y-3">
      {action.status === 'PROPOSED' && (
        <Button size="sm" disabled={submit.isPending} onClick={() => submit.mutate({ id: action.id })}>
          {t('pages.actions.detail.submit')}
        </Button>
      )}

      {action.status === 'PENDING_APPROVAL' && (
        <div className="space-y-3">
          <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate({ id: action.id })}>
            {t('pages.actions.detail.approve')}
          </Button>
          <TextAreaField
            htmlFor="action-reject-comment"
            label={t('pages.actions.detail.commentLabel')}
            value={comment}
            onChange={setComment}
          />
          {/* Indisponível sem comentário: rejeitar sem motivo devolve o trabalho
              ao autor sem dizer o que corrigir. */}
          <Button
            size="sm"
            variant="outline"
            disabled={reject.isPending || comment.trim() === ''}
            onClick={() => reject.mutate({ id: action.id, data: { comment: comment.trim() } })}
          >
            {t('pages.actions.detail.reject')}
          </Button>
        </div>
      )}

      {approvals.length > 0 && (
        <div>
          <p className="text-sm font-medium">{t('pages.actions.detail.history')}</p>
          <ul className="mt-1 space-y-2">
            {approvals.map((approval) => (
              <li key={approval.id} className="text-xs text-muted-foreground">
                <span className="font-medium">{t(`pages.actions.approval.${approval.status}`)}</span>{' '}
                — {t('pages.actions.detail.requestedBy')} {approval.requestedBy}
                {approval.reviewedBy && `, ${t('pages.actions.detail.reviewedBy')} ${approval.reviewedBy}`}
                {approval.comment && <p className="mt-1 text-foreground">{approval.comment}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
