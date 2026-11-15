import {
  applyDecorators,
  CanActivate,
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import type { RequestWithAuth } from '../common/interfaces/authenticated-user.interface.js';
import { AuthorizationLookupService } from '../common/services/authorization-lookup.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  enhancementFlag,
  type EnhancementId,
} from './enhancement-mount.module.js';

const ENHANCEMENT_ID = 'qurbanios:enhancement-id';

@Injectable()
export class EnhancementAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly authorization: AuthorizationLookupService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const id = this.reflector.getAllAndOverride<EnhancementId>(ENHANCEMENT_ID, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!id || this.config.get(enhancementFlag(id)) !== 'on')
      throw new NotFoundException('Enhancement is unavailable');
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const user = request.user;
    if (!user)
      throw new ForbiddenException(
        'Authenticated committee access is required',
      );

    const header = request.headers['x-organization-id'];
    const organizationId =
      typeof header === 'string' ? header : user.activeOrganizationId;
    if (!organizationId || !isUUID(organizationId))
      throw new ForbiddenException('Organisation context is required');

    const membership =
      await this.authorization.getOrganizationMembershipContext(
        user.id,
        organizationId,
      );
    if (
      !membership ||
      !membership.roleSlugs.some(
        (role) => role === 'org_admin' || role === 'org_owner',
      )
    ) {
      throw new ForbiddenException('Active committee membership is required');
    }

    const body: unknown = request.body;
    const bodyProgrammeId =
      body && typeof body === 'object' && 'programmeId' in body
        ? body.programmeId
        : undefined;
    const programmeId: unknown =
      request.params?.['programmeId'] ??
      request.query?.['programmeId'] ??
      bodyProgrammeId;
    if (typeof programmeId !== 'string' || !isUUID(programmeId))
      throw new NotFoundException('Programme not found');
    const programme = await this.prisma.programme.findFirst({
      where: {
        id: programmeId,
        organizationId,
        organization: { status: 'ACTIVE', enabledFeatures: { has: id } },
      },
      select: { status: true },
    });
    if (!programme) throw new NotFoundException('Enhancement is unavailable');
    if (
      programme.status === 'closed' &&
      request.method !== 'GET' &&
      request.method !== 'HEAD'
    ) {
      throw new ConflictException('Programme is closed');
    }
    request.organizationContext = membership;
    return true;
  }
}

export const EnhancementAccess = (id: EnhancementId) =>
  applyDecorators(
    SetMetadata(ENHANCEMENT_ID, id),
    UseGuards(EnhancementAccessGuard),
  );
