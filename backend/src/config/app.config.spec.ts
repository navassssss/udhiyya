import { afterEach, describe, expect, it, vi } from 'vitest';
import { appConfig } from './app.config.js';

describe('appConfig API prefix', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('forces the versioned contract in Brocoders mode', () => {
    vi.stubEnv('AUTH_MODE', 'brocoders');
    vi.stubEnv('API_PREFIX', '');

    expect(appConfig().apiPrefix).toBe('api/v1');
  });

  it('does not allow a stale Brocoders prefix to change the contract', () => {
    vi.stubEnv('AUTH_MODE', 'brocoders');
    vi.stubEnv('API_PREFIX', 'ap1/v1');

    expect(appConfig().apiPrefix).toBe('api/v1');
  });
});
