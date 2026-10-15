import type { IconType } from 'react-icons';
import {
  FaLinkedin,
  FaXTwitter,
  FaFacebook,
  FaThreads,
  FaTiktok,
  FaYoutube,
  FaInstagram,
  FaPinterest,
  FaBluesky,
} from 'react-icons/fa6';
import { cn } from '@/lib/utils';

/**
 * O logo de cada rede, de uma família só.
 *
 * Font Awesome 6 Brands, e não simple-icons: a LinkedIn pediu a remoção do logo
 * dela do simple-icons, e faltar justamente a rede principal da AUREA obrigaria a
 * misturar duas famílias com pesos visuais diferentes na mesma lista.
 *
 * Mais redes do que o enum do backend tem, de propósito: TikTok, YouTube,
 * Instagram e Pinterest entram quando a AUREA publicar mídia, e um mapa que já os
 * cobre não é código morto — é o passo seguinte sem uma segunda edição aqui.
 */
const PLATFORM_ICON: Record<string, IconType> = {
  LINKEDIN: FaLinkedin,
  X: FaXTwitter,
  FACEBOOK: FaFacebook,
  THREADS: FaThreads,
  TIKTOK: FaTiktok,
  YOUTUBE: FaYoutube,
  INSTAGRAM: FaInstagram,
  PINTEREST: FaPinterest,
  BLUESKY: FaBluesky,
};

/**
 * Monocromático, seguindo `currentColor`.
 *
 * A cor de marca do X, do Threads e do TikTok é `#000000`: no tema escuro os três
 * desapareceriam no fundo. A forma do logo é o que identifica a rede, e ela
 * sobrevive ao tema — a cor não.
 *
 * `aria-hidden` porque o nome da rede está sempre escrito ao lado: quem usa leitor
 * de tela ouviria "LinkedIn" duas vezes.
 */
export function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  const Icon = PLATFORM_ICON[platform];

  // Rede que não conhecemos: um espaço do mesmo tamanho, para a lista não pular
  // de alinhamento por causa dela.
  if (!Icon) return <span className={cn('inline-block size-4 shrink-0', className)} aria-hidden />;

  return <Icon aria-hidden className={cn('size-4 shrink-0', className)} />;
}
