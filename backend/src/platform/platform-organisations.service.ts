import type {
  PlatformAuditQuery,
  PlatformFeaturesDto,
} from './platform-organisations.dto.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import type { ProgrammeListQuery } from '../programmes/programmes.dto.js';
import type { InviteCommitteeAdminDto } from './platform-organisations.dto.js';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrganizationStatus,
  type Organization,
  type Prisma,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreatePlatformOrganisationDto,
  PlatformOrganisationQuery,
  UpdatePlatformOrganisationDto,
} from './platform-organisations.dto.js';

const transitions: Record<OrganizationStatus, readonly OrganizationStatus[]> = {
  ONBOARDING: ['ACTIVE', 'CLOSED'],
  ACTIVE: ['SUSPENDED', 'CLOSED'],
  SUSPENDED: ['ACTIVE', 'CLOSED'],
  CLOSED: [],
};

function project(organisation: Organization) {
  return {
    id: organisation.id,
    name: organisation.name,
    locality: organisation.locality,
    contact: organisation.contactEmail
      ? { email: organisation.contactEmail }
      : null,
    status: organisation.status.toLowerCase(),
  };
}

@Injectable()
export class PlatformOrganisationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
  ) {}

  async list(query: PlatformOrganisationQuery) {
    const rows = await this.prisma.organization.findMany({
      where: {
        id: query.cursor ? { gt: query.cursor } : undefined,
        name: query.search
          ? { contains: query.search, mode: 'insensitive' }
          : undefined,
      },
      orderBy: { id: 'asc' },
      take: query.limit + 1,
    });
    const items = rows.slice(0, query.limit).map(project);
    return {
      items,
      nextCursor: rows.length > query.limit ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async get(id: string) {
    const organisation = await this.prisma.organization.findUnique({
      where: { id },
    });
    if (!organisation) throw new NotFoundException('Organisation not found');
    return project(organisation);
  }

  async create(actorId: string, input: CreatePlatformOrganisationDto) {
    const name = input.name.trim();
    const locality = input.locality.trim();
    if (!name || !locality || !input.contact?.email) {
      throw new BadRequestException(
        'Name, locality and contact email are required',
      );
    }
    const id = randomUUID();
    return this.prisma.$transaction(async (tx) => {
      const organisation = await tx.organization.create({
        data: {
          id,
          slug: id,
          name,
          locality,
          contactEmail: input.contact.email,
          status: 'ONBOARDING',
          createdById: actorId,
        },
      });
      await this.audit(
        tx,
        organisation.id,
        actorId,
        'PLATFORM_ORGANISATION_CREATED',
        {
          status: organisation.status,
        },
      );
      return project(organisation);
    });
  }

  async update(
    id: string,
    actorId: string,
    input: UpdatePlatformOrganisationDto,
  ) {
    const name = input.name?.trim();
    const locality = input.locality?.trim();
    if (
      (input.name !== undefined && !name) ||
      (input.locality !== undefined && !locality) ||
      input.contact === null ||
      input.status === null
    ) {
      throw new BadRequestException(
        'Supplied organisation fields must have a value',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.organization.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Organisation not found');
      const next = input.status
        ? OrganizationStatus[input.status.toUpperCase() as OrganizationStatus]
        : current.status;
      if (
        next !== current.status &&
        !transitions[current.status].includes(next)
      ) {
        throw new ConflictException(
          'Organisation status transition is not allowed',
        );
      }
      const result = await tx.organization.updateMany({
        where: { id, status: current.status },
        data: {
          name,
          locality,
          contactEmail: input.contact?.email,
          status: next,
        },
      });
      if (result.count !== 1)
        throw new ConflictException(
          'Organisation status changed. Refresh and retry.',
        );
      const updated = await tx.organization.findUniqueOrThrow({
        where: { id },
      });
      await this.audit(tx, id, actorId, 'PLATFORM_ORGANISATION_UPDATED', {
        previousStatus: current.status,
        status: next,
      });
      return project(updated);
    });
  }

  async invite(
    id: string,
    actor: AuthenticatedUser,
    input: InviteCommitteeAdminDto,
  ) {
    const organisation = await this.prisma.organization.findUnique({
      where: { id },
    });
    if (!organisation) throw new NotFoundException('Organisation not found');
    if (
      organisation.status !== 'ONBOARDING' &&
      organisation.status !== 'ACTIVE'
    ) {
      throw new ConflictException(
        'Organisation is unavailable for invitations',
      );
    }
    const name = input.name.trim();
    if (!name) throw new BadRequestException('Recipient name is required');
    const role = await this.prisma.role.findFirst({
      where: { slug: 'org_admin', scope: 'ORGANIZATION', organizationId: null },
      select: { id: true },
    });
    if (!role)
      throw new ConflictException(
        'Committee administrator role is unavailable',
      );
    const invitation = await this.organizations.inviteMember(
      id,
      { email: input.email, roleId: role.id },
      actor,
      { organizationName: organisation.name, roleSlugs: [] },
      name,
    );
    return { id: invitation.id, status: 'pending' };
  }

  async invitations(id: string, query: ProgrammeListQuery) {
    await this.get(id);
    const rows = await this.prisma.organizationInvitation.findMany({
      where: {
        organizationId: id,
        id: query.cursor ? { gt: query.cursor } : undefined,
      },
      orderBy: { id: 'asc' },
      take: query.limit + 1,
      select: {
        id: true,
        recipientName: true,
        email: true,
        status: true,
        expiresAt: true,
      },
    });
    const now = new Date();
    const items = rows.slice(0, query.limit).map((row) => ({
      id: row.id,
      name: row.recipientName,
      email: row.email,
      status:
        row.status === 'PENDING' && row.expiresAt <= now
          ? 'expired'
          : row.status.toLowerCase(),
    }));
    return {
      items,
      nextCursor: rows.length > query.limit ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async revoke(id: string, invitationId: string, actor: AuthenticatedUser) {
    await this.organizations.revokeInvitation(id, invitationId, actor, true);
    return { id: invitationId, status: 'revoked' };
  }

  async features(id: string) {
    const row = await this.prisma.organization.findUnique({
      where: { id },
      select: { enabledFeatures: true },
    });
    if (!row) throw new NotFoundException('Organisation not found');
    return row;
  }

  async updateFeatures(
    id: string,
    actorId: string,
    input: PlatformFeaturesDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.organization.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!row) throw new NotFoundException('Organisation not found');
      if (row.status === 'CLOSED')
        throw new ConflictException('Organisation is closed');
      const enabledFeatures = input.enabledFeatures.slice().sort();
      const result = await tx.organization.updateMany({
        where: { id, status: { not: 'CLOSED' } },
        data: { enabledFeatures },
      });
      if (!result.count)
        throw new ConflictException(
          'Organisation was closed. Refresh and retry.',
        );
      await this.audit(tx, id, actorId, 'PLATFORM_FEATURES_UPDATED', {
        enabledFeatures,
      });
      return { enabledFeatures };
    });
  }

  async dashboard() {
    const [counts, committeeAdminCount, recentActivity] = await Promise.all([
      this.prisma.organization.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.user.count({
        where: {
          status: 'ACTIVE',
          organizationMemberships: {
            some: {
              status: 'ACTIVE',
              roles: {
                some: { role: { scope: 'ORGANIZATION', slug: 'org_admin' } },
              },
            },
          },
        },
      }),
      this.prisma.auditLog.findMany({
        where: { action: { startsWith: 'PLATFORM_' } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 10,
        select: {
          id: true,
          actorId: true,
          organizationId: true,
          action: true,
          targetId: true,
          createdAt: true,
        },
      }),
    ]);
    const count = (status: OrganizationStatus) =>
      counts.find((row) => row.status === status)?._count._all ?? 0;
    return {
      totalOrganisations: counts.reduce((sum, row) => sum + row._count._all, 0),
      organisations: {
        onboarding: count('ONBOARDING'),
        active: count('ACTIVE'),
        suspended: count('SUSPENDED'),
        closed: count('CLOSED'),
      },
      committeeAdminCount,
      recentActivity: recentActivity.map(({ organizationId, ...event }) => ({
        ...event,
        organisationId: organizationId,
      })),
    };
  }

  async auditEvents(query: PlatformAuditQuery) {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        organizationId: query.organisationId,
        id: query.cursor ? { gt: query.cursor } : undefined,
        action: { startsWith: 'PLATFORM_', equals: query.action },
      },
      orderBy: { id: 'asc' },
      take: query.limit + 1,
      select: {
        id: true,
        actorId: true,
        organizationId: true,
        action: true,
        targetId: true,
        createdAt: true,
      },
    });
    const items = rows
      .slice(0, query.limit)
      .map(({ organizationId, ...event }) => ({
        ...event,
        organisationId: organizationId,
      }));
    return {
      items,
      nextCursor: rows.length > query.limit ? (items.at(-1)?.id ?? null) : null,
    };
  }

  private async audit(
    tx: Prisma.TransactionClient,
    organisationId: string,
    actorId: string,
    action: string,
    metadata: Prisma.InputJsonObject,
  ) {
    await tx.auditLog.create({
      data: {
        actorId,
        organizationId: organisationId,
        action,
        targetType: 'organisation',
        targetId: organisationId,
        metadata,
      },
    });
  }
}
