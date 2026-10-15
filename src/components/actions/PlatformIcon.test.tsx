import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { PLATFORMS } from './PlatformNames';
import { PlatformIcon } from './PlatformIcon';

describe('PlatformIcon', () => {
  // A razão de existir do componente: até aqui toda rede aparecia como um círculo
  // cinza vazio. Uma rede oferecida sem logo é a falha que isso conserta, então a
  // afirmação percorre `PLATFORMS` em vez de nomear uma.
  it('desenha um logo para cada rede que a tela oferece', () => {
    for (const platform of PLATFORMS) {
      const { container, unmount } = render(<PlatformIcon platform={platform} />);

      expect(container.querySelector('svg'), platform).not.toBeNull();
      unmount();
    }
  });

  // As redes que exigem mídia ainda não estão no enum do backend, mas o mapa já as
  // cobre: quando entrarem, não há segunda edição aqui.
  it('já cobre as redes de mídia que ainda não publicamos', () => {
    for (const platform of ['TIKTOK', 'YOUTUBE', 'INSTAGRAM', 'PINTEREST']) {
      const { container, unmount } = render(<PlatformIcon platform={platform} />);

      expect(container.querySelector('svg'), platform).not.toBeNull();
      unmount();
    }
  });

  // Rede desconhecida não pode derrubar a lista nem tirá-la de alinhamento.
  it('reserva o espaço de uma rede que não conhece, sem quebrar', () => {
    const { container } = render(<PlatformIcon platform="ORKUT" />);

    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('span')).not.toBeNull();
  });

  // O nome da rede está sempre escrito ao lado; o logo é decoração. Sem isto, quem
  // usa leitor de tela ouve "LinkedIn" duas vezes.
  it('é decorativo para leitor de tela', () => {
    const { container } = render(<PlatformIcon platform="LINKEDIN" />);

    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
