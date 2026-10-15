import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/form/TextField';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/**
 * Conectar o Bluesky, que não tem OAuth.
 *
 * As outras redes abrem numa aba e voltam autorizadas. O Bluesky pede um handle e
 * uma **senha de app** — revogável e específica, criada em bsky.app, e não a senha
 * da conta. O texto diz isso, porque pedir "senha" sem explicar qual é pedir a
 * errada.
 *
 * O que é digitado aqui atravessa a AUREA até o provider e não fica: nada é
 * gravado, e o campo é limpo quando o diálogo fecha. `type="password"` para não
 * deixar a senha exposta numa tela compartilhada.
 */
export function BlueskyConnectDialog({
  onSubmit,
  pending,
  label,
}: {
  onSubmit: (credentials: { handle: string; appPassword: string }) => void;
  pending: boolean;
  label: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState('');
  const [appPassword, setAppPassword] = useState('');

  const ready = handle.trim() !== '' && appPassword.trim() !== '';

  const close = (next: boolean): void => {
    setOpen(next);
    // Fechar apaga o que foi digitado: a senha não fica em memória à espera de uma
    // segunda abertura do diálogo.
    if (!next) {
      setHandle('');
      setAppPassword('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={pending}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('pages.integrations.social.bluesky.title')}</DialogTitle>
          <DialogDescription>{t('pages.integrations.social.bluesky.body')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <TextField
            htmlFor="bluesky-handle"
            label={t('pages.integrations.social.bluesky.handleLabel')}
            value={handle}
            onChange={setHandle}
          />
          <TextField
            htmlFor="bluesky-app-password"
            label={t('pages.integrations.social.bluesky.passwordLabel')}
            helpTitle={t('pages.integrations.social.bluesky.passwordHelpTitle')}
            help={t('pages.integrations.social.bluesky.passwordHelp')}
            type="password"
            value={appPassword}
            onChange={setAppPassword}
          />
        </div>

        <DialogFooter>
          <Button
            size="sm"
            disabled={!ready || pending}
            onClick={() => {
              onSubmit({ handle: handle.trim(), appPassword: appPassword.trim() });
              close(false);
            }}
          >
            {t('pages.integrations.social.connectOne')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
