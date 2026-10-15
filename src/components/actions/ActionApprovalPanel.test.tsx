import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { ActionApprovalPanel } from './ActionApprovalPanel';

const ACTION_ID = '33333333-3333-3333-3333-333333333333';
const url = `/actions/${ACTION_ID}`;

afterEach(() => vi.unstubAllGlobals());

describe('ActionApprovalPanel', () => {
  it('oferece submeter em PROPOSED', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch({ [`${url}/submit`]: { body: { action: { id: ACTION_ID, status: 'PENDING_APPROVAL' } } } }, calls);

    renderWithProviders(
      <ActionApprovalPanel action={{ id: ACTION_ID, status: 'PROPOSED' }} approvals={[]} onChanged={vi.fn()} />,
    );

    await userEvent.click(screen.getByRole('button', { name: i18n.t('pages.actions.detail.submit') }));

    await waitFor(() => expect(calls.some((call) => call.path === `${url}/submit`)).toBe(true));
  });

  it('não oferece aprovar nem rejeitar em PROPOSED', () => {
    renderWithProviders(
      <ActionApprovalPanel action={{ id: ACTION_ID, status: 'PROPOSED' }} approvals={[]} onChanged={vi.fn()} />,
    );

    expect(screen.queryByRole('button', { name: i18n.t('pages.actions.detail.approve') })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: i18n.t('pages.actions.detail.reject') })).not.toBeInTheDocument();
  });

  it('não oferece submeter em PENDING_APPROVAL, e aprova', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch({ [`${url}/approve`]: { body: { action: { id: ACTION_ID, status: 'APPROVED' } } } }, calls);

    renderWithProviders(
      <ActionApprovalPanel
        action={{ id: ACTION_ID, status: 'PENDING_APPROVAL' }}
        approvals={[]}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: i18n.t('pages.actions.detail.submit') })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: i18n.t('pages.actions.detail.approve') }));

    await waitFor(() => expect(calls.some((call) => call.path === `${url}/approve`)).toBe(true));
  });

  // Rejeitar sem motivo devolve o trabalho ao autor sem dizer o que corrigir: o
  // botão fica indisponível até haver comentário.
  it('não deixa rejeitar sem comentário, e rejeita com o comentário escrito', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch({ [`${url}/reject`]: { body: { action: { id: ACTION_ID, status: 'PROPOSED' } } } }, calls);

    renderWithProviders(
      <ActionApprovalPanel
        action={{ id: ACTION_ID, status: 'PENDING_APPROVAL' }}
        approvals={[]}
        onChanged={vi.fn()}
      />,
    );

    const rejectButton = screen.getByRole('button', { name: i18n.t('pages.actions.detail.reject') });
    expect(rejectButton).toBeDisabled();

    await userEvent.type(screen.getByLabelText(i18n.t('pages.actions.detail.commentLabel')), 'Trocar o número.');
    expect(rejectButton).toBeEnabled();

    await userEvent.click(rejectButton);

    await waitFor(() =>
      expect(calls.find((call) => call.path === `${url}/reject`)?.body).toEqual({ comment: 'Trocar o número.' }),
    );
  });

  it('mostra o histórico de aprovação com o comentário', () => {
    renderWithProviders(
      <ActionApprovalPanel
        action={{ id: ACTION_ID, status: 'PROPOSED' }}
        approvals={[
          {
            id: 'ap-1',
            requestedBy: 'u1',
            reviewedBy: 'u2',
            status: 'REJECTED',
            comment: 'Trocar o número.',
            requestedAt: '2026-08-04T10:30:00.000Z',
            reviewedAt: '2026-08-04T10:40:00.000Z',
          },
        ]}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByText(i18n.t('pages.actions.approval.REJECTED'))).toBeInTheDocument();
    expect(screen.getByText('Trocar o número.')).toBeInTheDocument();
  });
});
