import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { MediaPicker } from './MediaPicker';

const PUT_PATH = '/put/signed';
const PUBLIC = 'https://cdn.test.aurea/media/ws-1/a1.png';

const routes = () => ({
  '/upload/presigned': {
    body: { uploadUrl: `https://r2.test${PUT_PATH}?X-Amz-Signature=x`, publicUrl: PUBLIC, key: 'media/ws-1/a1.png' },
  },
  [PUT_PATH]: { body: {} },
});

const VIDEO = 'https://cdn.test.aurea/media/ws-1/reel.mp4';

const png = (name = 'foto.png', bytes = 8) =>
  new File([new Uint8Array(bytes)], name, { type: 'image/png' });

/**
 * `Uint8Array` do tamanho declarado seria 200MB de memória no teste. O `size` do
 * `File` é derivado do conteúdo, então ele é redefinido — é o número que a tela lê,
 * e é o que entra na assinatura do backend.
 */
const video = (name: string, bytes: number) => {
  const file = new File([new Uint8Array(8)], name, { type: 'video/mp4' });
  Object.defineProperty(file, 'size', { value: bytes });
  return file;
};

function pick() {
  // O input é escondido atrás do botão; o teste fala com ele diretamente porque é
  // o que o clique do botão faz.
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

afterEach(() => vi.unstubAllGlobals());

describe('MediaPicker', () => {
  /**
   * A ordem importa: presign, depois PUT, e só então a URL entra na lista. Se a URL
   * entrasse antes do PUT, o post poderia ser criado apontando para um objeto que
   * não subiu.
   */
  it('assina, envia ao R2 e só então devolve a URL pública', async () => {
    const calls: StubFetchCall[] = [];
    const onChange = vi.fn();
    stubFetch(routes(), calls);

    renderWithProviders(<MediaPicker urls={[]} onChange={onChange} />);
    await userEvent.upload(pick(), png('foto.png', 4));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith([PUBLIC]));
    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      'POST /upload/presigned',
      `PUT ${PUT_PATH}`,
    ]);
    expect(calls[0]?.body).toMatchObject({ filename: 'foto.png', contentType: 'image/png', type: 'media', size: 4 });
  });

  /**
   * A propriedade que sustenta o resto: PUT que falha não produz URL. Sem isto, a
   * ação poderia ser criada apontando para um objeto que não existe no bucket, e a
   * Post for Me falharia ao buscá-lo — depois de alguém aprovar o post.
   */
  it('não devolve URL quando o envio ao R2 falha', async () => {
    const onChange = vi.fn();
    stubFetch({ ...routes(), [PUT_PATH]: { status: 500, body: {} } });

    renderWithProviders(<MediaPicker urls={[]} onChange={onChange} />);
    await userEvent.upload(pick(), png());

    // Mensagem nossa e traduzida, e não o "Upload failed: …" cravado em inglês.
    await screen.findByText(i18n.t('pages.actions.form.media.failed'));
    expect(onChange).not.toHaveBeenCalled();
    expect(document.querySelectorAll('img')).toHaveLength(0);
  });

  it('mostra a miniatura de cada imagem já enviada e deixa remover', async () => {
    const onChange = vi.fn();
    stubFetch(routes());

    renderWithProviders(<MediaPicker urls={[PUBLIC, 'https://cdn.test.aurea/media/ws-1/b.png']} onChange={onChange} />);

    expect(document.querySelectorAll('img')).toHaveLength(2);

    await userEvent.click(screen.getAllByRole('button', { name: i18n.t('pages.actions.form.media.remove') })[0]!);

    expect(onChange).toHaveBeenCalledWith(['https://cdn.test.aurea/media/ws-1/b.png']);
  });

  /**
   * Recusa antes de subir, e recusa a leva inteira. Cortar em silêncio publicaria
   * menos imagens do que o fundador escolheu — e ele só descobriria no post.
   */
  it('recusa passar de quatro imagens sem enviar nada', async () => {
    const calls: StubFetchCall[] = [];
    const onChange = vi.fn();
    stubFetch(routes(), calls);

    renderWithProviders(<MediaPicker urls={[PUBLIC, PUBLIC + '2', PUBLIC + '3']} onChange={onChange} />);
    await userEvent.upload(pick(), [png('a.png'), png('b.png')]);

    expect(await screen.findByText(i18n.t('pages.actions.form.media.tooMany', { count: 4 }))).toBeInTheDocument();
    expect(calls).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  // O teto é do backend, que assina o tamanho declarado; recusar aqui só poupa a
  // ida e a espera.
  it('recusa arquivo acima de 10MB sem gastar uma assinatura', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(routes(), calls);

    renderWithProviders(<MediaPicker urls={[]} onChange={vi.fn()} />);
    await userEvent.upload(pick(), png('grande.png', 10 * 1024 * 1024 + 1));

    expect(
      await screen.findByText(i18n.t('pages.actions.form.media.tooLarge', { name: 'grande.png' })),
    ).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  /**
   * Vídeo tem teto próprio: 10MB não é um vídeo. 60MB passa, 201MB não — e o
   * arquivo grande é recusado **antes** do upload, que é o ponto de checar aqui.
   */
  it('aceita vídeo até 200MB e recusa acima disso sem enviar', async () => {
    const calls: StubFetchCall[] = [];
    const onChange = vi.fn();
    stubFetch(
      {
        '/upload/presigned': { body: { uploadUrl: `https://r2.test${PUT_PATH}`, publicUrl: VIDEO, key: 'k' } },
        [PUT_PATH]: { body: {} },
      },
      calls,
    );

    renderWithProviders(<MediaPicker urls={[]} onChange={onChange} />);
    await userEvent.upload(pick(), video('reel.mp4', 60 * 1024 * 1024));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith([VIDEO]));
    expect(calls[0]?.body).toMatchObject({ contentType: 'video/mp4', size: 60 * 1024 * 1024 });

    calls.length = 0;
    await userEvent.upload(pick(), video('grande.mp4', 200 * 1024 * 1024 + 1));

    expect(
      await screen.findByText(i18n.t('pages.actions.form.media.videoTooLarge', { name: 'grande.mp4' })),
    ).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  /**
   * Nenhuma rede publica imagem e vídeo no mesmo post — o backend recusa. Recusar
   * aqui evita subir 200MB para descobrir na criação.
   */
  it('recusa misturar imagem e vídeo, sem gastar upload', async () => {
    const calls: StubFetchCall[] = [];
    const onChange = vi.fn();
    stubFetch(routes(), calls);

    renderWithProviders(<MediaPicker urls={[PUBLIC]} onChange={onChange} />);
    await userEvent.upload(pick(), video('reel.mp4', 1024));

    expect(await screen.findByText(i18n.t('pages.actions.form.media.mixed'))).toBeInTheDocument();
    expect(calls).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  // Quem escolheu o arquivo precisa poder conferir que é o vídeo certo — uma
  // imagem parada não prova isso.
  it('mostra o vídeo com controles, e imagem como imagem', () => {
    stubFetch(routes());

    renderWithProviders(<MediaPicker urls={[VIDEO, PUBLIC]} onChange={vi.fn()} />);

    expect(document.querySelectorAll('video')).toHaveLength(1);
    expect(document.querySelector('video')?.hasAttribute('controls')).toBe(true);
    expect(document.querySelectorAll('img')).toHaveLength(1);
  });

  // Com quatro já enviadas não há o que adicionar, e o botão diz isso.
  it('desabilita adicionar quando já são quatro', () => {
    stubFetch(routes());

    renderWithProviders(<MediaPicker urls={['a', 'b', 'c', 'd']} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: i18n.t('pages.actions.form.media.add') })).toBeDisabled();
  });
});
