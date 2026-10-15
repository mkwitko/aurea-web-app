import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { PendingMeasurementCard, type PendingMeasurementItem } from './PendingMeasurementCard';

const item = (over: Partial<PendingMeasurementItem> = {}): PendingMeasurementItem => ({
  experimentId: 'e1',
  name: 'Landing A/B',
  metric: 'conversion_rate',
  endDate: '2026-08-01T00:00:00.000Z',
  ...over,
});

describe('PendingMeasurementCard', () => {
  it('nomeia cada teste que está esperando o número, com link para medi-lo', () => {
    renderWithProviders(<PendingMeasurementCard count={1} items={[item()]} />);

    expect(screen.getByRole('link', { name: 'Landing A/B' })).toHaveAttribute('href', '/app/experiments/e1');
  });

  // `count` é a contagem real e `items` uma janela: sem o "+N" a tela leria
  // como se a lista fosse tudo.
  it('diz quantos ficaram fora da lista', () => {
    const items = Array.from({ length: 5 }, (_, i) => item({ experimentId: `e${i}`, name: `Teste ${i}` }));

    renderWithProviders(<PendingMeasurementCard count={8} items={items} />);

    expect(screen.getByText(i18n.t('app.dashboard.pendingMeasurement.more', { count: 3 }))).toBeInTheDocument();
  });

  it('não renderiza nada quando nada está esperando', () => {
    const { container } = renderWithProviders(<PendingMeasurementCard count={0} items={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
