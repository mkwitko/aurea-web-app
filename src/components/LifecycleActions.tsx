import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
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

/** One legal move, as produced by the lifecycle mirrors in `src/lib`. */
interface Move<TAction extends string> {
  action: TAction;
  destructive: boolean;
}

/**
 * The action bar for a lifecycle: one button per move the current status
 * allows, and nothing at all once there are none.
 *
 * Generic over the two domains — it takes the moves already computed by
 * `allowedExperimentActions` / `allowedHypothesisActions` rather than a status,
 * so the legality rules stay in one tested place and this stays presentational.
 *
 * `labelKey` is the i18n prefix holding one label per action, plus
 * `confirm.<action>.title` and `confirm.<action>.body` for each destructive
 * one. Keyed per action rather than per domain because learnings have two
 * different terminal moves: one shared dialog would put "Reject this learning?"
 * in front of the archive button.
 */
export function LifecycleActions<TAction extends string>({
  moves,
  labelKey,
  pending,
  onAct,
}: {
  moves: ReadonlyArray<Move<TAction>>;
  labelKey: string;
  /** A move is already in flight: a second one would target a status the first just left. */
  pending: boolean;
  onAct: (action: TAction) => void;
}) {
  const { t } = useTranslation();

  if (moves.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {moves.map((move) => {
        const label = t(`${labelKey}.${move.action}`);

        // Irreversible moves get a confirmation: the transition tables have no
        // edge out of CANCELLED or REJECTED, so a misplaced click is permanent.
        if (move.destructive) {
          return (
            <AlertDialog key={move.action}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={pending}>
                  {label}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t(`${labelKey}.confirm.${move.action}.title`)}</AlertDialogTitle>
                  <AlertDialogDescription>{t(`${labelKey}.confirm.${move.action}.body`)}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onAct(move.action)}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    {label}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          );
        }

        return (
          <Button key={move.action} size="sm" disabled={pending} onClick={() => onAct(move.action)}>
            {label}
          </Button>
        );
      })}
    </div>
  );
}
