import { ApiError } from '@/api/client';
import { apiErrorMessage } from './api-errors';

const FALLBACK = 'Something went wrong. Try again.';

describe('apiErrorMessage', () => {
  it('returns the message the backend sent', () => {
    const error = new ApiError(401, 'Unauthorized', { error: { code: 'AUR-A0002', message: 'Invalid credentials' } });

    expect(apiErrorMessage(error, FALLBACK)).toBe('Invalid credentials');
  });

  it('never returns the synthetic message on the error itself', () => {
    // `ApiError.message` is built from the status line ("API 401
    // Unauthorized"). Showing that to a founder explains nothing, and it is
    // what a plain `err.message` would put on screen.
    const error = new ApiError(401, 'Unauthorized', { error: { code: 'AUR-A0002', message: 'Invalid credentials' } });

    expect(error.message).toBe('API 401 Unauthorized');
    expect(apiErrorMessage(error, FALLBACK)).not.toContain('401');
  });

  it('falls back when the body carries no message', () => {
    // A gateway that swallows the envelope, a 500 with an empty body, a code
    // without a message — all of them have to end up as readable copy rather
    // than "undefined".
    expect(apiErrorMessage(new ApiError(500, 'Internal Server Error', undefined), FALLBACK)).toBe(FALLBACK);
    expect(apiErrorMessage(new ApiError(500, 'Internal Server Error', {}), FALLBACK)).toBe(FALLBACK);
    expect(apiErrorMessage(new ApiError(409, 'Conflict', { error: { code: 'AUR-X' } }), FALLBACK)).toBe(FALLBACK);
  });

  it('falls back for anything that is not an API error', () => {
    expect(apiErrorMessage(new Error('network down'), FALLBACK)).toBe(FALLBACK);
    expect(apiErrorMessage(null, FALLBACK)).toBe(FALLBACK);
    expect(apiErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
    expect(apiErrorMessage('boom', FALLBACK)).toBe(FALLBACK);
  });

  it('ignores a non-string message instead of rendering an object', () => {
    // The body is untrusted input: a message that is not a string must not
    // reach the DOM as "[object Object]".
    expect(apiErrorMessage(new ApiError(400, 'Bad Request', { error: { message: { nested: true } } }), FALLBACK)).toBe(
      FALLBACK,
    );
  });
});
