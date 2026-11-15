import { expect, it, vi } from 'vitest';
import { HealthController } from './health.controller.js';

it('provides a database-independent liveness response', () => {
  const checkHealth = vi.fn();
  const controller = new HealthController({ checkHealth } as never);

  expect(controller.live()).toMatchObject({ status: 'ok' });
  expect(checkHealth).not.toHaveBeenCalled();
});
