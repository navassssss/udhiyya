import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { InvitationTokenDto } from '../organizations/dto/invitation-token.dto.js';
import { OrganizationsService } from '../organizations/organizations.service.js';

@Controller('organisations')
export class CommitteeWorkspacesController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  async list(@CurrentUser() actor: AuthenticatedUser) {
    const memberships = await this.organizations.listMyOrganizations(
      actor.id,
      true,
    );
    return memberships.map(({ organization, ...membership }) => ({
      ...membership,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        status: organization.status.toLowerCase(),
      },
    }));
  }

  @Post('invitations/accept')
  @HttpCode(200)
  async accept(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: InvitationTokenDto,
  ) {
    const result = await this.organizations.acceptInvitation(
      input.token,
      actor,
    );
    return {
      organisationId: result.organizationId,
      role: 'committee_admin',
    };
  }
}
