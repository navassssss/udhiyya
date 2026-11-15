import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditService } from '../../audit/audit.service.js';
import { CryptoService } from '../../common/services/crypto.service.js';
import { EmailService } from '../../email/email.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SessionsService } from '../../sessions/sessions.service.js';

@Injectable()
export class BrocodersEmailChangeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly email: EmailService,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
  ) {}

  async request(userId: string, address: string, password: string) {
    const email = address.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, status: 'ACTIVE' },
    });
    if (
      !user?.passwordHash ||
      !(await this.crypto.verifyPassword(user.passwordHash, password))
    ) {
      throw new UnauthorizedException('Current password is required');
    }
    if (
      await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      })
    ) {
      throw new ConflictException('This email address is unavailable');
    }

    const token = this.crypto.generateOpaqueToken(36);
    await this.write(async (tx) => {
      // Serialize requests for this account. A later request invalidates the earlier link.
      const active = await tx.user.updateMany({
        where: {
          id: userId,
          status: 'ACTIVE',
          tokenVersion: user.tokenVersion,
        },
        data: { updatedAt: new Date() },
      });
      if (!active.count)
        throw new ConflictException('Account changed. Sign in and retry.');
      await tx.emailChangeToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.emailChangeToken.create({
        data: {
          userId,
          email,
          tokenVersion: user.tokenVersion,
          tokenHash: this.crypto.hashToken(token),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      await this.audit.record(
        {
          actorId: userId,
          action: 'ACCOUNT_EMAIL_CHANGE_REQUESTED',
          targetType: 'User',
          targetId: userId,
        },
        tx,
      );
    });
    this.email.sendNewEmailConfirmation(email, user.name, token);
  }

  async confirm(token: string) {
    await this.write(async (tx) => {
      const now = new Date();
      const row = await tx.emailChangeToken.findUnique({
        where: { tokenHash: this.crypto.hashToken(token) },
      });
      if (!row || row.usedAt || row.expiresAt <= now)
        throw new BadRequestException(
          'Email change link is invalid or expired',
        );
      const claimed = await tx.emailChangeToken.updateMany({
        where: { id: row.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (!claimed.count)
        throw new BadRequestException('Email change link was already used');

      const user = await tx.user.updateMany({
        where: {
          id: row.userId,
          status: 'ACTIVE',
          tokenVersion: row.tokenVersion,
          deletedAt: null,
        },
        data: {
          email: row.email,
          emailVerifiedAt: now,
          emailVerificationExempt: false,
          tokenVersion: { increment: 1 },
        },
      });
      if (!user.count)
        throw new ConflictException(
          'Account changed. Request a new email change link.',
        );
      await tx.passwordResetToken.updateMany({
        where: { userId: row.userId, consumedAt: null },
        data: { consumedAt: now },
      });
      await tx.emailVerificationToken.updateMany({
        where: { userId: row.userId, consumedAt: null },
        data: { consumedAt: now },
      });
      await this.sessions.revokeAllUserSessions(row.userId, {
        reason: 'EMAIL_CHANGED',
        tx,
      });
      await this.audit.record(
        {
          actorId: row.userId,
          action: 'ACCOUNT_EMAIL_CHANGED',
          targetType: 'User',
          targetId: row.userId,
        },
        tx,
      );
    });
  }

  private async write(work: (tx: Prisma.TransactionClient) => Promise<void>) {
    try {
      await this.prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)
      ) {
        throw new ConflictException(
          'Email is unavailable or the account changed. Refresh and retry.',
        );
      }
      throw error;
    }
  }
}
