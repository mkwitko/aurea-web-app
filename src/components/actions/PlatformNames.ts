/**
 * As redes que a AUREA publica, na ordem em que a tela as mostra.
 *
 * O rótulo é o nome próprio da rede e **não** passa por i18n: "LinkedIn" é
 * LinkedIn em qualquer idioma, e uma chave de tradução por rede convidaria alguém
 * a traduzir um nome de marca.
 *
 * As três últimas exigem mídia — o que cada uma aceita não está escrito aqui, e
 * vem de `GET /actions/capabilities`: é a mesma tabela que o backend usa para
 * recusar, e copiá-la nesta tela faria a promessa divergir da regra.
 *
 * Fora daqui: Pinterest, cuja credencial não está habilitada na conta do
 * provider, e Bluesky, que pede senha de app em vez de OAuth.
 */
export const PLATFORM_LABEL: Record<string, string> = {
  LINKEDIN: 'LinkedIn',
  X: 'X',
  FACEBOOK: 'Facebook',
  THREADS: 'Threads',
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
  YOUTUBE: 'YouTube',
  BLUESKY: 'Bluesky',
};

/**
 * As redes que não conectam por OAuth.
 *
 * Bluesky é a única: em vez de abrir a rede numa aba, a AUREA pede o handle e uma
 * senha de app, que atravessam até o provider e não ficam aqui. A tela precisa
 * saber disso para mostrar um formulário no lugar do botão que abre aba.
 */
export const PLATFORMS_WITH_CREDENTIALS = ['BLUESKY'];

/** As redes oferecíveis, na ordem da tela. */
export const PLATFORMS = Object.keys(PLATFORM_LABEL);

export function platformLabel(platform: string): string {
  return PLATFORM_LABEL[platform] ?? platform;
}

/**
 * As redes que publicam com uma consequência que o nome não revela.
 *
 * O vídeo do YouTube sai **público** (`privacy_status: 'public'`), e é a coisa mais
 * irreversível que este fluxo faz. O diálogo de confirmação nomeia isso antes do
 * clique — "YouTube · público" — porque é a última tela onde alguém pode desistir.
 */
export const PLATFORM_CONSEQUENCE: Record<string, string> = {
  YOUTUBE: 'pages.actions.detail.confirmExecute.youtubePublic',
};
