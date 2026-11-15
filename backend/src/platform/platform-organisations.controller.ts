import {
  PlatformAuditQuery,
  PlatformFeaturesDto,
} from './platform-organisations.dto.js';
import { ProgrammeListQuery } from '../programmes/programmes.dto.js';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import {
  CreatePlatformOrganisationDto,
  InviteCommitteeAdminDto,
  PlatformOrganisationQuery,
  UpdatePlatformOrganisationDto,
} from './platform-organisations.dto.js';
import { PlatformOrganisationsService } from './platform-organisations.service.js';

@Controller('platform/organisations')
@Roles('super_admin')
export class PlatformOrganisationsController {
  constructor(private readonly organisations: PlatformOrganisationsService) {}

  @Get()
  list(@Query() query: PlatformOrganisationQuery) {
    return this.organisations.list(query);
  }

  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: CreatePlatformOrganisationDto,
  ) {
    return this.organisations.create(actor.id, input);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.organisations.get(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: UpdatePlatformOrganisationDto,
  ) {
    return this.organisations.update(id, actor.id, input);
  }

  @Post(':id/invitations')
  invite(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: InviteCommitteeAdminDto,
  ) {
    return this.organisations.invite(id, actor, input);
  }

  @Get(':id/invitations')
  invitations(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ProgrammeListQuery,
  ) {
    return this.organisations.invitations(id, query);
  }

  @Post(':id/invitations/:invitationId/revoke')
  @HttpCode(200)
  revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.organisations.revoke(id, invitationId, actor);
  }

  @Get(':id/features')
  features(@Param('id', ParseUUIDPipe) id: string) {
    return this.organisations.features(id);
  }

  @Patch(':id/features')
  updateFeatures(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: PlatformFeaturesDto,
  ) {
    return this.organisations.updateFeatures(id, actor.id, input);
  }
}

@Controller('platform')
@Roles('super_admin')
export class PlatformOverviewController {
  constructor(private readonly organisations: PlatformOrganisationsService) {}

  @Get('dashboard')
  dashboard() {
    return this.organisations.dashboard();
  }

  @Get('audit-events')
  auditEvents(@Query() query: PlatformAuditQuery) {
    return this.organisations.auditEvents(query);
  }
}
