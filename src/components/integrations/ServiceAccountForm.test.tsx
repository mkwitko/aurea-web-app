import { describe, expect, it, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { ServiceAccountForm } from './ServiceAccountForm';

const CREDENTIAL = '{"client_email":"aurea@project.iam.gserviceaccount.com","private_key":"pk-secret"}';

afterEach(() => vi.unstubAllGlobals());

// `credentialsLabel` is "Service account key (JSON)": the literal parentheses
// are regex grouping syntax, so `new RegExp(i18n.t(key), 'i')` without
// escaping never matches this label — it searches for "...key" immediately
// followed by "JSON" with no parens in between. Every label lookup in this
// file goes through this helper so a future label with regex-special
// characters doesn't silently fail to match either.
const labelRegex = (key: string) => new RegExp(i18n.t(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

describe('ServiceAccountForm', () => {
  it('mostra o formulário de service account', () => {
    renderWithProviders(<ServiceAccountForm />);

    expect(screen.getByLabelText(labelRegex('pages.integrations.propertyLabel'))).toBeTruthy();
    expect(screen.getByLabelText(labelRegex('pages.integrations.credentialsLabel'))).toBeTruthy();
  });

  it('envia a property e a credencial, e chama onConnected', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch({ '/integrations': { body: { integration: { provider: 'GA4', externalId: '123456789' } } } }, calls);
    const onConnected = vi.fn();

    renderWithProviders(<ServiceAccountForm onConnected={onConnected} />);

    await userEvent.type(
      screen.getByLabelText(labelRegex('pages.integrations.propertyLabel')),
      '123456789',
    );
    // paste, e não type: a credencial é JSON cru, e o parser de teclas
    // especiais do userEvent.type trata `{` e `}` como abre/fecha de
    // modificador, quebrando em qualquer chave literal do texto.
    await userEvent.click(screen.getByLabelText(labelRegex('pages.integrations.credentialsLabel')));
    await userEvent.paste(CREDENTIAL);
    await userEvent.click(screen.getByRole('button', { name: i18n.t('pages.integrations.connect') }));

    await waitFor(() => {
      const put = calls.find((call) => call.method === 'PUT');
      expect(put?.body).toMatchObject({
        provider: 'GA4',
        authKind: 'SERVICE_ACCOUNT',
        externalId: '123456789',
        credentials: CREDENTIAL,
      });
    });
    await waitFor(() => expect(onConnected).toHaveBeenCalled());
  });

  // A recusa sobe pelo `onError`: é o card que mostra mensagem, não o
  // formulário — dois lugares mostrando erro deixariam o fundador com duas
  // mensagens sobre o mesmo problema.
  it('sobe o motivo pelo onError quando a fonte recusa a credencial', async () => {
    stubFetch({
      '/integrations': {
        status: 400,
        body: { error: { code: 'AUR-T0001', message: 'The source refused this credential' } },
      },
    });
    const onError = vi.fn();

    renderWithProviders(<ServiceAccountForm onError={onError} />);

    await userEvent.type(
      screen.getByLabelText(labelRegex('pages.integrations.propertyLabel')),
      '123456789',
    );
    await userEvent.click(screen.getByLabelText(labelRegex('pages.integrations.credentialsLabel')));
    await userEvent.paste(CREDENTIAL);
    await userEvent.click(screen.getByRole('button', { name: i18n.t('pages.integrations.connect') }));

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(expect.stringMatching(/refused this credential/i)),
    );
  });
});
