import { Module } from '@nestjs/common';
import { expect, it, vi } from 'vitest';
import { mountEnhancements } from './enhancement-mount.module.js';

@Module({})
class ExampleFeatureModule {}

it('loads and mounts only explicitly enabled enhancement modules', async () => {
  const analytics = vi.fn(async () => ExampleFeatureModule);
  const allocation = vi.fn(async () => ExampleFeatureModule);
  const loaders = { 'EF-01': analytics, 'EF-02': allocation };

  const off = await mountEnhancements(loaders, { FEATURE_EF_01: 'off' });
  expect(off.imports).toEqual([]);
  expect(analytics).not.toHaveBeenCalled();
  expect(allocation).not.toHaveBeenCalled();

  const on = await mountEnhancements(loaders, {
    FEATURE_EF_01: 'on',
    FEATURE_EF_02: 'off',
  });
  expect(on.imports).toHaveLength(2);
  expect(on.imports?.[0]).toBe(ExampleFeatureModule);
  expect(analytics).toHaveBeenCalledOnce();
  expect(allocation).not.toHaveBeenCalled();
});
