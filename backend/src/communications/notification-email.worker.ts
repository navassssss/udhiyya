import { notificationAudience } from './notification-audience.js';
import { randomUUID } from 'node:crypto';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EMAIL_DISPATCHER,
  type EmailDispatcher,
} from '../email/interfaces/email-job.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class NotificationEmailWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationEmailWorker.name);
  private timer?: NodeJS.Timeout;
  private run?: Promise<void>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(EMAIL_DISPATCHER) private readonly mail: EmailDispatcher,
  ) {}

  onModuleInit() {
    if (this.config.get<boolean>('mail.enabled') !== true) return;
    this.timer = setInterval(() => {
      if (this.run) return;
      this.run = this.flush()
        .catch(() => {
          this.logger.warn('Could not drain the programme email outbox');
        })
        .finally(() => {
          this.run = undefined;
        });
    }, 15000).unref();
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.run;
  }

  private async flush() {
    const now = new Date();
    const jobs = await this.prisma.notificationEmail.findMany({
      where: { state: { in: ['queued', 'sending'] }, readyAt: { lte: now } },
      orderBy: { readyAt: 'asc' },
      take: 10,
      include: {
        dispatch: {
          include: {
            programme: {
              select: { organization: { select: { status: true } } },
            },
          },
        },
      },
    });

    for (const job of jobs) {
      const claim = randomUUID();
      const attempt = job.attempts + 1;
      const claimed = await this.prisma.notificationEmail.updateMany({
        where: {
          id: job.id,
          state: job.state,
          attempts: job.attempts,
          readyAt: { lte: now },
        },
        data: {
          state: 'sending',
          attempts: attempt,
          claim,
          readyAt: new Date(Date.now() + 5 * 60000),
        },
      });
      if (!claimed.count) continue;

      const where = { id: job.id, state: 'sending' as const, claim };
      const recipient =
        job.dispatch.programme.organization.status === 'ACTIVE'
          ? await this.prisma.user.findFirst({
              where: {
                id: job.userId,
                ...notificationAudience(
                  job.dispatch.programmeId,
                  job.dispatch.audience,
                ),
              },
              select: { email: true },
            })
          : null;
      if (!recipient) {
        await this.prisma.notificationEmail.updateMany({
          where,
          data: { state: 'skipped', claim: null },
        });
        continue;
      }
      if (attempt > 3) {
        await this.prisma.notificationEmail.updateMany({
          where,
          data: { state: 'failed', claim: null },
        });
        continue;
      }

      try {
        await this.mail.dispatch({
          to: recipient.email,
          subject: job.dispatch.title,
          text: job.dispatch.body,
          html: '',
          templateType: 'programme_notification',
        });
      } catch {
        await this.prisma.notificationEmail.updateMany({
          where,
          data: {
            state: attempt < 3 ? 'queued' : 'failed',
            claim: null,
            readyAt: new Date(Date.now() + attempt * 60000),
          },
        });
        this.logger.warn('Programme notification email delivery failed');
        continue;
      }

      await this.prisma.notificationEmail.updateMany({
        where,
        data: { state: 'sent', claim: null },
      });
    }
  }
}
