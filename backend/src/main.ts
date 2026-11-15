import multipart from '@fastify/multipart';
import fastifyHelmet from '@fastify/helmet';
import type { INestApplication } from '@nestjs/common';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import type { AppConfig } from './config/app.config.js';

function configureCommon(app: INestApplication): AppConfig {
  const configService = app.get(ConfigService);
  const appCfg = configService.get<AppConfig>('app');
  if (!appCfg) {
    throw new Error('Application configuration is not loaded');
  }

  if (appCfg.apiPrefix) {
    app.setGlobalPrefix(appCfg.apiPrefix);
  }

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow: boolean) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (appCfg.allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'X-Organization-Id',
      'X-Client-Type',
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.enableShutdownHooks();

  return appCfg;
}

export function configureApp(app: NestExpressApplication): AppConfig {
  const appCfg = configureCommon(app);
  if (appCfg.trustProxy) {
    app.set('trust proxy', 1);
  }
  app.use(
    helmet({
      contentSecurityPolicy:
        appCfg.nodeEnv === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cookieParser(appCfg.cookie.secret));
  return appCfg;
}

export async function configureFastifyApp(
  app: NestFastifyApplication,
): Promise<AppConfig> {
  const appCfg = configureCommon(app);
  await app.register(multipart);
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: appCfg.nodeEnv === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
  });
  return appCfg;
}

export function setupSwagger(app: INestApplication, appCfg: AppConfig): void {
  const swaggerConfig = new DocumentBuilder()
    .setTitle(`${appCfg.appName} - Authentication & Authorization API`)
    .setDescription(
      'Reusable NestJS + PostgreSQL + Prisma authentication, dynamic RBAC, multi-tenant organization access control, session security, and audit platform.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addCookieAuth('access_token')
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-organization-id' },
      'x-organization-id',
    )
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-csrf-token' },
      'x-csrf-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  const docsPath = appCfg.apiPrefix ? `${appCfg.apiPrefix}/docs` : 'docs';
  SwaggerModule.setup(docsPath, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      withCredentials: true,
    },
  });
}

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  // The starter's legacy cookie endpoints still use the Express response API.
  const app =
    process.env.AUTH_MODE === 'supabase' ||
    process.env.AUTH_MODE === 'brocoders'
      ? await NestFactory.create<NestFastifyApplication>(
          AppModule,
          new FastifyAdapter({
            trustProxy:
              process.env.TRUST_PROXY === 'true'
                ? (_address, hop) => hop === 0
                : false,
          }),
          { bufferLogs: true },
        )
      : await NestFactory.create<NestExpressApplication>(AppModule, {
          bufferLogs: true,
        });

  const appCfg =
    app.getHttpAdapter().getType() === 'fastify'
      ? await configureFastifyApp(app as NestFastifyApplication)
      : configureApp(app as NestExpressApplication);
  setupSwagger(app, appCfg);

  await app.listen(appCfg.port, '0.0.0.0');
  logger.log(
    `Server listening on port ${appCfg.port} (${appCfg.nodeEnv}) - Swagger at /${
      appCfg.apiPrefix ? `${appCfg.apiPrefix}/docs` : 'docs'
    }`,
  );
}

const isEntrypoint =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  (process.argv[1]?.endsWith('main.js') ||
    process.argv[1]?.endsWith('main.ts'));

if (isEntrypoint) {
  await bootstrap();
}
