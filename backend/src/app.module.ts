import { Module } from '@nestjs/common';
import { ConditionalModule, ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './audit/audit.module.js';
import { BrocodersAuthHttpModule } from './auth/brocoders/brocoders-auth-http.module.js';
import { LocalAuthHttpModule } from './auth/local-auth-http.module.js';
import { enhancementLoaders, mountEnhancements } from './enhancements/enhancement-mount.module.js';
import { CommonModule } from './common/common.module.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { CsrfGuard } from './common/guards/csrf.guard.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { OrganizationGuard } from './common/guards/organization.guard.js';
import { PermissionsGuard } from './common/guards/permissions.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { type AppConfig, appConfig } from './config/app.config.js';
import { authConfig } from './config/auth.config.js';
import { validateEnv } from './config/env.validation.js';
import { mailConfig } from './config/mail.config.js';
import { EmailModule } from './email/email.module.js';
import { HealthModule } from './health/health.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { PermissionsModule } from './permissions/permissions.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { CommunicationsModule } from './communications/communications.module.js';
import { DistributionModule } from './distribution/distribution.module.js';
import { OperationsModule } from './operations/operations.module.js';
import { FinanceModule } from './finance/finance.module.js';
import { AnimalsModule } from './animals/animals.module.js';
import { RegistrationModule } from './registration/registration.module.js';
import { HouseholdsModule } from './households/households.module.js';
import { PlatformModule } from './platform/platform.module.js';
import { ProgrammesModule } from './programmes/programmes.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RolesModule } from './roles/roles.module.js';
import { LocalSessionsModule } from './sessions/local-sessions.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV === 'test' ? ['.env.test', '.env'] : ['.env'],
      validate: validateEnv,
      load: [appConfig, authConfig, mailConfig],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const throttle = configService.get<AppConfig['throttle']>(
          'app.throttle',
        ) ?? {
          ttlMs: 60_000,
          limit: 60,
          authTtlMs: 60_000,
          authLimit: 10,
        };
        return {
          skipIf: () =>
            process.env.NODE_ENV === 'test' &&
            process.env.ENABLE_RATE_LIMIT_IN_TESTS !== 'true',
          throttlers: [
            {
              name: 'default',
              ttl: throttle.ttlMs,
              limit: throttle.limit,
            },
            {
              name: 'auth',
              ttl: throttle.authTtlMs,
              limit: throttle.authLimit,
            },
          ],
        };
      },
    }),
    PrismaModule,
    CommonModule,
    AuditModule,
    EmailModule,
    ConditionalModule.registerWhen(LocalSessionsModule, (env) => !env.AUTH_MODE || env.AUTH_MODE === 'local'),
    PermissionsModule,
    RolesModule,
    UsersModule,
    OrganizationsModule,
    ProgrammesModule,
    PlatformModule,
    HouseholdsModule,
    RegistrationModule,
    AnimalsModule,
    FinanceModule,
    OperationsModule,
    DistributionModule,
    CommunicationsModule,
    ReportsModule,
    ConditionalModule.registerWhen(LocalAuthHttpModule, (env) => !env.AUTH_MODE || env.AUTH_MODE === 'local'),
    ConditionalModule.registerWhen(BrocodersAuthHttpModule, (env) => env.AUTH_MODE === 'brocoders'),
    mountEnhancements(enhancementLoaders),
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: OrganizationGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
