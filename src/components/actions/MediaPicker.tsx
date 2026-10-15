import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useGetPresignedUrl, uploadToPresignedUrl } from '@/api/modules/upload';
import { Help } from '@/components/Help';
import { Button } from '@/components/ui/button';

/** Os seis tipos que o backend aceita como mídia de post. */
const ACCEPT = 'image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm';
const MAX_FILES = 4;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

const isVideoFile = (type: string): boolean => type.startsWith('video/');

/** Vídeo pela extensão que o backend escreveu na chave do objeto. */
export const isVideoUrl = (url: string): boolean => /\.(mp4|mov|webm)(\?|$)/i.test(url);

/**
 * Os arquivos do post: imagens ou um vídeo.
 *
 * O estado é a lista de URLs já no R2, e nunca o `File`: a URL só entra depois do
 * PUT dar certo, então o post nunca é criado apontando para um arquivo que não
 * subiu. É o oposto de guardar o arquivo e enviar tudo no fim, que falharia depois
 * de a ação existir.
 *
 * Os limites são os mesmos do backend — quatro arquivos, 10MB por imagem, 200MB por
 * vídeo — e repetidos aqui para o erro chegar antes do upload, não depois. O backend
 * continua sendo quem decide: estes números são conveniência, não a regra.
 *
 * Proporção, duração e codec não são verificados em lugar nenhum, de propósito: a
 * Post for Me transcodifica a mídia que busca. Verificar aqui recusaria arquivo que
 * publicaria bem.
 */
export function MediaPicker({ urls, onChange }: { urls: string[]; onChange: (urls: string[]) => void }) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const presign = useGetPresignedUrl();

  const full = urls.length >= MAX_FILES;

  async function add(files: FileList): Promise<void> {
    setError(null);

    // Uma leva que passa do teto é recusada inteira, e não cortada em silêncio:
    // cortar publicaria menos imagens do que o fundador escolheu.
    if (urls.length + files.length > MAX_FILES) {
      setError(t('pages.actions.form.media.tooMany', { count: MAX_FILES }));
      return;
    }

    // O tamanho é conferido na leva inteira antes do primeiro upload: descobrir no
    // terceiro arquivo deixaria dois no bucket sem que ninguém tenha pedido. O teto
    // é por tipo — 10MB não é um vídeo.
    const tooLarge = Array.from(files).find(
      (file) => file.size > (isVideoFile(file.type) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES),
    );
    if (tooLarge) {
      setError(
        t(isVideoFile(tooLarge.type) ? 'pages.actions.form.media.videoTooLarge' : 'pages.actions.form.media.tooLarge', {
          name: tooLarge.name,
        }),
      );
      return;
    }

    /**
     * Imagem e vídeo no mesmo post é recusado pelo backend, porque nenhuma rede
     * publica os dois juntos. Recusar aqui evita subir um arquivo de 200MB para
     * descobrir na criação.
     */
    const kinds = new Set([...urls.map(isVideoUrl), ...Array.from(files).map((file) => isVideoFile(file.type))]);
    if (kinds.size > 1) {
      setError(t('pages.actions.form.media.mixed'));
      return;
    }

    setBusy(true);
    const added: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const signed = await presign.mutateAsync({
          filename: file.name,
          contentType: file.type,
          type: 'media',
          size: file.size,
        });
        await uploadToPresignedUrl(signed.uploadUrl, file);
        added.push(signed.publicUrl);
      }
      onChange([...urls, ...added]);
    } catch {
      // O que subiu antes da falha permanece: descartar obrigaria a subir tudo de
      // novo por causa da última imagem.
      if (added.length > 0) onChange([...urls, ...added]);
      // Mensagem nossa, traduzida. `uploadToPresignedUrl` estoura com
      // "Upload failed: <statusText>" — texto cravado em inglês, vindo do R2, que
      // não explica nada a quem está tentando publicar.
      setError(t('pages.actions.form.media.failed'));
    } finally {
      setBusy(false);
      // Sem isto, escolher o mesmo arquivo outra vez não dispara `change`.
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div>
      <p className="text-sm font-medium">
        {t('pages.actions.form.media.label')}
        <Help title={t('pages.actions.form.media.helpTitle')}>{t('pages.actions.form.media.help')}</Help>
      </p>

      {urls.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {urls.map((url) => (
            <li key={url} className="relative">
              {/* `<video>` com controles em vez de miniatura: quem escolheu o
                  arquivo precisa poder conferir que é o vídeo certo, e uma imagem
                  parada de um vídeo não prova isso. */}
              {isVideoUrl(url) ? (
                <video
                  src={url}
                  controls
                  preload="metadata"
                  className="size-20 rounded-md border border-border object-cover"
                />
              ) : (
                <img src={url} alt="" className="size-20 rounded-md border border-border object-cover" />
              )}
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label={t('pages.actions.form.media.remove')}
                className="absolute -right-2 -top-2 size-6 rounded-full bg-background"
                onClick={() => onChange(urls.filter((item) => item !== url))}
              >
                <X className="size-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) void add(event.target.files);
        }}
      />

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-2"
        disabled={busy || full}
        onClick={() => input.current?.click()}
      >
        {busy ? t('pages.actions.form.media.uploading') : t('pages.actions.form.media.add')}
      </Button>

      {full && <p className="mt-2 text-xs text-muted-foreground">{t('pages.actions.form.media.atMost', { count: MAX_FILES })}</p>}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
