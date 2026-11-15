import { Logger, Module, type DynamicModule, type Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RouterModule, type Routes } from '@nestjs/core';
import { enhancementIds } from '../platform/platform-organisations.dto.js';

export type EnhancementId = (typeof enhancementIds)[number];
export type EnhancementLoaders = Partial<
  Record<EnhancementId, () => Promise<Type>>
>;

export function enhancementFlag(id: EnhancementId) {
  return 'FEATURE_' + id.replace('-', '_');
}

@Module({})
class EnhancementMountModule {}

// Keep optional module imports in their loader. A disabled feature never evaluates its code.
export const enhancementLoaders: EnhancementLoaders = {};

export async function mountEnhancements(
  loaders: EnhancementLoaders,
  environment?: NodeJS.ProcessEnv,
): Promise<DynamicModule> {
  if (!environment) await ConfigModule.envVariablesLoaded;
  const env = environment ?? process.env;
  const modules: Type[] = [];
  const routes: Routes = [];
  for (const id of enhancementIds) {
    if (env[enhancementFlag(id)] !== 'on') continue;
    const load = loaders[id];
    if (!load) {
      Logger.warn(
        'Enhancement module unavailable: ' + id,
        EnhancementMountModule.name,
      );
      continue;
    }
    const feature = await load();
    modules.push(feature);
    routes.push({ path: 'ext/' + id, module: feature });
  }
  return {
    module: EnhancementMountModule,
    imports: routes.length ? [...modules, RouterModule.register(routes)] : [],
  };
}
