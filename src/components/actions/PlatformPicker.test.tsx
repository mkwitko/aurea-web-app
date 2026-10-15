import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { PlatformPicker } from './PlatformPicker';

const ACCOUNTS = [
  { id: 'acc-li', platform: 'LINKEDIN', username: null, connected: true },
  { id: 'acc-x', platform: 'X', username: null, connected: true },
];

describe('PlatformPicker', () => {
  it('mostra as redes conectadas pelo nome próprio delas', () => {
    renderWithProviders(<PlatformPicker accounts={ACCOUNTS} selected={[]} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'LinkedIn' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'X' })).toBeInTheDocument();
  });

  // É numa conta que o post sai, e o cliente precisa reconhecer qual.
  it('mostra a conta ao lado da rede', () => {
    renderWithProviders(
      <PlatformPicker
        accounts={[{ id: 'acc-li', platform: 'LINKEDIN', username: '@acme', connected: true }]}
        selected={[]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'LinkedIn · @acme' })).toBeInTheDocument();
  });

  it('marca e desmarca uma rede', async () => {
    const onChange = vi.fn();
    renderWithProviders(<PlatformPicker accounts={ACCOUNTS} selected={['LINKEDIN']} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'X' }));
    expect(onChange).toHaveBeenLastCalledWith(['LINKEDIN', 'X']);

    await userEvent.click(screen.getByRole('button', { name: 'LinkedIn' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  /**
   * Publicar numa conta desconectada falharia, e o backend a recusa: mostrá-la
   * selecionável seria prometer o que não acontece.
   */
  it('desabilita a conta desconectada, e diz por quê', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <PlatformPicker
        accounts={[{ id: 'acc-li', platform: 'LINKEDIN', username: 'acme', connected: false }]}
        selected={[]}
        onChange={onChange}
      />,
    );

    const button = screen.getByRole('button', { name: new RegExp(i18n.t('pages.integrations.social.reconnect')) });
    expect(button).toBeDisabled();

    await userEvent.click(button);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('conta as redes escolhidas', () => {
    renderWithProviders(<PlatformPicker accounts={ACCOUNTS} selected={['LINKEDIN', 'X']} onChange={vi.fn()} />);

    expect(screen.getByText(i18n.t('pages.actions.form.platformsCount', { count: 2 }))).toBeInTheDocument();
  });

  it('não mostra contagem quando nada foi escolhido', () => {
    renderWithProviders(<PlatformPicker accounts={ACCOUNTS} selected={[]} onChange={vi.fn()} />);

    expect(screen.queryByText(i18n.t('pages.actions.form.platformsCount', { count: 0 }))).not.toBeInTheDocument();
  });
});
