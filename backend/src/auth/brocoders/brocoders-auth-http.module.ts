import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module.js';
import { EmailModule } from '../../email/email.module.js';
import { OrganizationsModule } from '../../organizations/organizations.module.js';
import { SessionsModule } from '../../sessions/sessions.module.js';
import { UsersModule } from '../../users/users.module.js';
import { AuthModule } from '../auth.module.js';
import {
  BrocodersAdminUsersController,
  BrocodersAuthController,
} from './brocoders-auth.controller.js';
import { BrocodersEmailChangeService } from './brocoders-email-change.service.js';
import { BrocodersProfileService } from './brocoders-profile.service.js';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    EmailModule,
    OrganizationsModule,
    SessionsModule,
    UsersModule,
  ],
  controllers: [BrocodersAdminUsersController, BrocodersAuthController],
  providers: [BrocodersProfileService, BrocodersEmailChangeService],
})
export class BrocodersAuthHttpModule {}
