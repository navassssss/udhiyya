import { CommitteeWorkspacesController } from './committee-workspaces.controller.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { Module } from '@nestjs/common';
import {
  PlatformOrganisationsController,
  PlatformOverviewController,
} from './platform-organisations.controller.js';
import { PlatformOrganisationsService } from './platform-organisations.service.js';

@Module({
  imports: [OrganizationsModule],
  controllers: [
    PlatformOrganisationsController,
    CommitteeWorkspacesController,
    PlatformOverviewController,
  ],
  providers: [PlatformOrganisationsService],
})
export class PlatformModule {}
