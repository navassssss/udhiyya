import { notificationAudience } from './notification-audience.js';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ProgrammeListQuery } from '../programmes/programmes.dto.js';
import { RegistrationService } from '../registration/registration.service.js';
import type {
  EnquiryDto,
  MessageDto,
  NotificationDto,
} from './communications.dto.js';

type Scope = { organizationId: string; programmeId: string };

function page<T extends { id: string }>(rows: T[], limit: number) {
  return {
    items: rows.slice(0, limit),
    nextCursor: rows.length > limit ? rows[limit - 1].id : null,
  };
}

const notificationSelect = {
  id: true,
  title: true,
  body: true,
  createdAt: true,
  readAt: true,
} as const;

@Injectable()
export class CommunicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registrations: RegistrationService,
    private readonly config: ConfigService,
  ) {}

  async committeeAnnouncements(scope: Scope, query: ProgrammeListQuery) {
    await this.registrations.getProgramme(this.prisma, scope, false);
    const rows = await this.prisma.announcement.findMany({
      where: {
        programmeId: scope.programmeId,
        id: query.cursor ? { gt: query.cursor } : undefined,
      },
      orderBy: { id: 'asc' },
      take: query.limit + 1,
    });
    return page(rows, query.limit);
  }

  async createAnnouncement(scope: Scope, actorId: string, input: MessageDto) {
    return this.write(async (tx) => {
      await this.registrations.getProgramme(tx, scope, false, true);
      const row = await tx.announcement.create({
        data: {
          programmeId: scope.programmeId,
          title: this.required(input.title),
          body: this.required(input.body),
        },
      });
      await this.audit(tx, scope, actorId, 'ANNOUNCEMENT_CREATED', row.id);
      return row;
    });
  }

  async publishAnnouncement(scope: Scope, id: string, actorId: string) {
    return this.write(async (tx) => {
      await this.registrations.getProgramme(tx, scope, false, true);
      const result = await tx.announcement.updateMany({
        where: { id, programmeId: scope.programmeId, publishedAt: null },
        data: { publishedAt: new Date() },
      });
      const row = await tx.announcement.findFirst({
        where: { id, programmeId: scope.programmeId },
      });
      if (!row) throw new NotFoundException('Announcement not found');
      if (result.count)
        await this.audit(tx, scope, actorId, 'ANNOUNCEMENT_PUBLISHED', id);
      return row;
    });
  }

  async publicAnnouncements(
    organizationId: string,
    year: number,
    query: ProgrammeListQuery,
  ) {
    const programme = await this.publicProgramme(organizationId, year);
    const rows = await this.prisma.announcement.findMany({
      where: {
        programmeId: programme.id,
        publishedAt: { not: null },
        id: query.cursor ? { gt: query.cursor } : undefined,
      },
      orderBy: { id: 'asc' },
      take: query.limit + 1,
      select: { id: true, title: true, body: true, publishedAt: true },
    });
    return page(rows, query.limit);
  }

  async publicOverview(organizationId: string, year: number) {
    const programme = await this.publicProgramme(organizationId, year);
    const [animalCount, operations] = await Promise.all([
      this.prisma.animal.count({ where: { programmeId: programme.id } }),
      this.prisma.schedule.groupBy({
        by: ['department', 'status'],
        where: {
          programmeId: programme.id,
          department: { in: ['slaughter', 'processing'] },
        },
        _count: { _all: true },
      }),
    ]);
    const progress = (['slaughter', 'processing'] as const).map(
      (department) => {
        const rows = operations.filter(
          (item) => item.department === department,
        );
        return {
          department,
          completed:
            rows.find((row) => row.status === 'completed')?._count._all ?? 0,
          total: rows.reduce((sum, row) => sum + row._count._all, 0),
        };
      },
    );
    return { asOf: new Date(), animalCount, progress };
  }

  async addEnquiry(organizationId: string, year: number, input: EnquiryDto) {
    const programme = await this.publicProgramme(organizationId, year);
    const row = await this.prisma.programmeEnquiry.create({
      data: {
        programmeId: programme.id,
        name: this.required(input.name),
        replyEmail: input.replyEmail.toLowerCase(),
        message: this.required(input.message),
      },
      select: { id: true },
    });
    return row;
  }

  async enquiries(scope: Scope, query: ProgrammeListQuery) {
    await this.registrations.getProgramme(this.prisma, scope, false);
    const rows = await this.prisma.programmeEnquiry.findMany({
      where: {
        programmeId: scope.programmeId,
        id: query.cursor ? { gt: query.cursor } : undefined,
      },
      orderBy: { id: 'asc' },
      take: query.limit + 1,
    });
    return page(rows, query.limit);
  }

  async send(scope: Scope, actorId: string, input: NotificationDto) {
    const emailRequested = input.channels.includes('email');
    const emailEnabled =
      emailRequested && this.config.get<boolean>('mail.enabled') === true;
    const inApp = input.channels.includes('in_app');
    if (emailRequested && !emailEnabled && !inApp)
      throw new ServiceUnavailableException(
        'Programme email delivery is disabled',
      );

    return this.write(async (tx) => {
      await this.registrations.getProgramme(tx, scope, false, true);
      const programmeId = scope.programmeId;
      const recipients = await tx.user.findMany({
        where: notificationAudience(programmeId, input.audience),
        select: { id: true },
        take: 10001,
      });
      if (recipients.length > 10000)
        throw new BadRequestException(
          'Select an audience of at most 10,000 recipients',
        );

      const title = this.required(input.title);
      const body = this.required(input.body);
      const dispatch = await tx.notificationDispatch.create({
        data: { programmeId, title, body, audience: input.audience },
      });
      if (inApp && recipients.length) {
        await tx.userNotification.createMany({
          data: recipients.map((user) => ({
            programmeId,
            userId: user.id,
            title,
            body,
          })),
        });
      }
      if (emailEnabled && recipients.length) {
        await tx.notificationEmail.createMany({
          data: recipients.map((user) => ({
            userId: user.id,
            dispatchId: dispatch.id,
          })),
        });
      }
      await this.audit(
        tx,
        scope,
        actorId,
        'NOTIFICATIONS_DISPATCHED',
        dispatch.id,
      );
      return {
        dispatchId: dispatch.id,
        status: emailEnabled && recipients.length ? 'queued' : 'completed',
        recipientCount: recipients.length,
        emailEnabled,
      };
    });
  }

  async inbox(scope: Scope, userId: string, query: ProgrammeListQuery) {
    await this.registrations.getProgramme(this.prisma, scope, false);
    const rows = await this.prisma.userNotification.findMany({
      where: {
        programmeId: scope.programmeId,
        userId,
        id: query.cursor ? { gt: query.cursor } : undefined,
      },
      orderBy: { id: 'asc' },
      take: query.limit + 1,
      select: notificationSelect,
    });
    return page(
      rows.map((row) => ({ ...row, read: row.readAt !== null })),
      query.limit,
    );
  }

  async markRead(scope: Scope, id: string, userId: string) {
    await this.registrations.getProgramme(this.prisma, scope, false);
    return this.write(async (tx) => {
      await tx.userNotification.updateMany({
        where: { id, programmeId: scope.programmeId, userId, readAt: null },
        data: { readAt: new Date() },
      });
      const row = await tx.userNotification.findFirst({
        where: { id, programmeId: scope.programmeId, userId },
        select: notificationSelect,
      });
      if (!row) throw new NotFoundException('Notification not found');
      return { ...row, read: true };
    });
  }

  private async publicProgramme(organizationId: string, year: number) {
    const programme = await this.prisma.programme.findFirst({
      where: {
        organizationId,
        year,
        status: 'published',
        organization: { status: 'ACTIVE' },
      },
      select: { id: true },
    });
    if (!programme) throw new NotFoundException('Programme not found');
    return programme;
  }

  private async write<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    try {
      return await this.prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Concurrent communications change. Refresh and retry.',
        );
      }
      throw error;
    }
  }

  private required(value: string) {
    const text = value.trim();
    if (!text) throw new BadRequestException('Value must be non-blank');
    return text;
  }

  private async audit(
    tx: Prisma.TransactionClient,
    scope: Scope,
    actorId: string,
    action: string,
    targetId: string,
  ) {
    await tx.auditLog.create({
      data: {
        organizationId: scope.organizationId,
        actorId,
        action,
        targetType: 'communications',
        targetId,
      },
    });
  }
}
