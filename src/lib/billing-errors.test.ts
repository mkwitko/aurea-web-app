import { ApiError } from '@/api/client';
import { isNotConfigured } from './billing-errors';

describe('isNotConfigured', () => {
  it('is true for the AUR-T0016 BILLING_NOT_CONFIGURED shape', () => {
    const error = new ApiError(500, 'Internal Server Error', {
      error: { code: 'AUR-T0016', message: 'not configured' },
    });

    expect(isNotConfigured(error)).toBe(true);
  });

  it('is false for another error code', () => {
    const error = new ApiError(404, 'Not Found', { error: { code: 'AUR-T0001', message: 'not found' } });

    expect(isNotConfigured(error)).toBe(false);
  });

  it('is false, without throwing, for a null, undefined or shapeless error', () => {
    expect(isNotConfigured(null)).toBe(false);
    expect(isNotConfigured(undefined)).toBe(false);
    expect(isNotConfigured({})).toBe(false);
    expect(isNotConfigured(new Error('boom'))).toBe(false);
    expect(isNotConfigured('not an object')).toBe(false);
  });
});
