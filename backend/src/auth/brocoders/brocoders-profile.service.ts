import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../../audit/audit.service.js';
import { CryptoService } from '../../common/services/crypto.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { OrganizationsService } from '../../organizations/organizations.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UsersService } from '../../users/users.service.js';
import type { AuthTokenBundle } from '../token-issuer.service.js';
import type { CreateRegularUserDto } from './brocoders-auth.dto.js';

export function nameParts(input: { firstName?: string; lastName?: string; name?: string }) {
  let firstName = input.firstName?.trim();
  let lastName = input.lastName?.trim();
  if ((!firstName || !lastName) && input.name) {
    const parts = input.name.trim().split(/\s+/);
    firstName = parts[0] || 'User';
    lastName = parts.slice(1).join(' ') || 'Account';
  }
  if (!firstName || !lastName) {
    throw new BadRequestException('First and last name (or full name) are required');
  }
  return { firstName, lastName, name: firstName + ' ' + lastName };
}

@Injectable()
export class BrocodersProfileService {
  constructor(
    private readonly users: UsersService,
    private readonly organizations: OrganizationsService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  async profile(userId: string) {
    const [user, memberships] = await Promise.all([
      this.users.getMyProfile(userId),
      this.organizations.listMyOrganizations(userId, true),
    ]);
    const [firstName = '', ...otherNames] = user.name.trim().split(/\s+/);
    const organisations = memberships.map(({ organization, roles }) => ({
      id: organization.id,
      name: organization.name,
      status: organization.status.toLowerCase(),
      roles: roles.map((role) => role.slug),
    }));
    const organisation =
      organisations.find(
        (row) =>
          row.id === user.activeOrganizationId && row.status === 'active',
      ) ??
      (organisations.filter((row) => row.status === 'active').length === 1
        ? organisations.find((row) => row.status === 'active')
        : undefined);
    const admin =
      user.roles.includes('super_admin') || user.roles.includes('admin');

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      firstName: user.firstName ?? firstName,
      lastName: user.lastName ?? otherNames.join(' '),
      avatarUrl: user.avatarUrl,
      emailVerifiedAt: user.emailVerifiedAt,
      role: { id: admin ? 1 : 2, name: admin ? 'Admin' : 'User' },
      status: {
        id: user.status === 'ACTIVE' ? 1 : 2,
        name: user.status === 'ACTIVE' ? 'Active' : 'Inactive',
      },
      roles: user.roles,
      permissions: user.permissions,
      organisations,
      organisation: organisation ?? null,
      activeOrganisationId: organisation?.id ?? null,
    };
  }

  async session(bundle: AuthTokenBundle) {
    const claims: { exp?: number } | null = this.jwt.decode(bundle.accessToken);
    if (!claims?.exp) throw new UnauthorizedException('Invalid session expiry');
    return {
      token: bundle.accessToken,
      refreshToken: bundle.refreshToken,
      tokenExpires: claims.exp * 1000,
      user: await this.profile(bundle.user.id),
    };
  }

  async createRegularUser(actorId: string, input: CreateRegularUserDto) {
    const names = nameParts(input);
    const email = input.email.trim().toLowerCase();
    const passwordHash = await this.crypto.hashPassword(input.password);
    try {
      const userId = await this.prisma.$transaction(async (tx) => {
        const role = await tx.role.findFirst({
          where: { scope: 'GLOBAL', organizationId: null, slug: 'customer' },
          select: { id: true },
        });
        if (!role)
          throw new ConflictException('Regular account role is unavailable');
        const user = await tx.user.create({
          data: {
            ...names,
            email,
            passwordHash,
            status: 'ACTIVE',
            emailVerificationExempt: true,
          },
          select: { id: true },
        });
        await tx.userRole.create({
          data: { userId: user.id, roleId: role.id, assignedById: actorId },
        });
        await this.audit.record(
          {
            actorId,
            action: 'PLATFORM_REGULAR_USER_CREATED',
            targetType: 'User',
            targetId: user.id,
          },
          tx,
        );
        return user.id;
      });
      return this.profile(userId);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'An account with this email address already exists',
        );
      }
      throw error;
    }
  }
}
