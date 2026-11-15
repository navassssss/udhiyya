import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Programme } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateProgrammeDto,
  ProgrammeListQuery,
  UpdateProgrammeDto,
} from './programmes.dto.js';

type ProgrammeChanges = Omit<Partial<Programme>, 'faqs'> & {
  faqs?: { question: string; answer: string }[];
};

function projectPublic(programme: Programme) {
  return {
    year: programme.year,
    title: programme.title,
    status: programme.status,
    description: programme.description,
    guidelines: programme.guidelines,
    faqs: programme.faqs,
    publicContact: programme.publicEmail
      ? { email: programme.publicEmail }
      : null,
    registrationOpensAt: programme.registrationOpensAt,
    registrationClosesAt: programme.registrationClosesAt,
    price:
      programme.priceMinor === null
        ? null
        : { amountMinor: programme.priceMinor, currency: 'INR' },
  };
}

function projectCommittee(programme: Programme) {
  return {
    ...projectPublic(programme),
    id: programme.id,
    organisationId: programme.organizationId,
    registrationLimit: programme.registrationLimit,
    closedAt: programme.closedAt,
  };
}

@Injectable()
export class ProgrammesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, query: ProgrammeListQuery) {
    const rows = await this.prisma.programme.findMany({
      where: {
        organizationId,
        id: query.cursor ? { gt: query.cursor } : undefined,
      },
      orderBy: { id: 'asc' },
      take: query.limit + 1,
    });
    const items = rows.slice(0, query.limit).map(projectCommittee);
    return {
      items,
      nextCursor: rows.length > query.limit ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async create(
    organizationId: string,
    actorId: string,
    dto: CreateProgrammeDto,
  ) {
    const title = dto.title.trim();
    if (!title) throw new BadRequestException('Title is required');
    try {
      const programme = await this.prisma.$transaction(async (tx) => {
        const created = await tx.programme.create({
          data: { organizationId, year: dto.year, title },
        });
        await this.audit(tx, created, actorId, 'PROGRAMME_CREATED');
        return created;
      });
      return projectCommittee(programme);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'PROGRAMME_YEAR_EXISTS',
          message: 'A programme already exists for this year',
        });
      }
      throw error;
    }
  }

  async get(organizationId: string, id: string) {
    const programme = await this.prisma.programme.findFirst({
      where: { id, organizationId },
    });
    if (!programme) throw new NotFoundException('Programme not found');
    return projectCommittee(programme);
  }

  async update(
    organizationId: string,
    id: string,
    actorId: string,
    dto: UpdateProgrammeDto,
  ) {
    const title = dto.title?.trim();
    if (dto.title !== undefined && !title)
      throw new BadRequestException('Title is required');
    if (dto.faqs === null)
      throw new BadRequestException('Use an empty array to clear FAQs');
    const faqs = dto.faqs?.map((item) => ({
      question: item.question.trim(),
      answer: item.answer.trim(),
    }));
    if (faqs?.some((item) => !item.question || !item.answer)) {
      throw new BadRequestException(
        'FAQ questions and answers must be non-blank',
      );
    }
    const data = {
      title,
      faqs,
      description: dto.description,
      guidelines: dto.guidelines,
      publicEmail:
        dto.publicContact === undefined
          ? undefined
          : (dto.publicContact?.email ?? null),
      registrationOpensAt: this.parseDate(dto.registrationOpensAt),
      registrationClosesAt: this.parseDate(dto.registrationClosesAt),
      registrationLimit: dto.registrationLimit,
      priceMinor:
        dto.price === undefined ? undefined : (dto.price?.amountMinor ?? null),
    };
    return this.change(organizationId, id, actorId, data);
  }

  async publish(organizationId: string, id: string, actorId: string) {
    return this.change(organizationId, id, actorId, { status: 'published' });
  }

  async close(organizationId: string, id: string, actorId: string) {
    return this.change(organizationId, id, actorId, {
      status: 'closed',
      closedAt: new Date(),
    });
  }

  async getPublic(organizationId: string, year: number) {
    const programme = await this.prisma.programme.findFirst({
      where: {
        organizationId,
        year,
        status: 'published',
        organization: { status: 'ACTIVE' },
      },
    });
    if (!programme) throw new NotFoundException('Programme not found');
    return projectPublic(programme);
  }

  private parseDate(value: string | null | undefined) {
    if (value == null) return value;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
      throw new BadRequestException('Invalid registration date');
    return date;
  }

  private async change(
    organizationId: string,
    id: string,
    actorId: string,
    data: ProgrammeChanges,
  ) {
    try {
      const programme = await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.programme.findFirst({
            where: { id, organizationId },
          });
          if (!current) throw new NotFoundException('Programme not found');
          if (current.status === 'closed') {
            if (data.status === 'closed') return current;
            throw new ConflictException('Programme is closed');
          }
          if (data.status === 'closed')
            await this.assertCloseReady(tx, current);
          if (data.status === 'published' && current.status === 'published')
            return current;

          const next = { ...current };
          for (const [key, value] of Object.entries(data)) {
            if (value !== undefined) Object.assign(next, { [key]: value });
          }
          this.validate(next);

          const updated = await tx.programme.update({
            where: { id, organizationId },
            data,
          });
          await this.audit(
            tx,
            updated,
            actorId,
            data.status === 'closed'
              ? 'PROGRAMME_CLOSED'
              : data.status === 'published'
                ? 'PROGRAMME_PUBLISHED'
                : 'PROGRAMME_UPDATED',
          );
          return updated;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return projectCommittee(programme);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Programme was changed concurrently. Refresh and retry.',
        );
      }
      throw error;
    }
  }

  private async assertCloseReady(
    tx: Prisma.TransactionClient,
    programme: Programme,
  ) {
    if (programme.status !== 'published')
      throw new ConflictException('Publish programme before closing');
    const programmeId = programme.id;
    const [registrations, payments, operations, allocations] =
      await Promise.all([
        tx.registration.count({ where: { programmeId, status: 'submitted' } }),
        tx.payment.count({ where: { programmeId, status: 'pending' } }),
        tx.schedule.count({
          where: {
            programmeId,
            department: { in: ['slaughter', 'processing'] },
            status: { not: 'completed' },
          },
        }),
        tx.distributionAllocation.count({
          where: {
            programmeId,
            status: { in: ['draft', 'confirmed', 'packed'] },
          },
        }),
      ]);
    if (registrations || payments || operations || allocations) {
      throw new ConflictException({
        code: 'PROGRAMME_HAS_PENDING_WORK',
        message:
          'Finish registration review, pending payment review, operations and distribution before closing',
      });
    }
  }

  private validate(programme: Programme) {
    const { registrationOpensAt, registrationClosesAt } = programme;
    if (
      registrationOpensAt &&
      registrationClosesAt &&
      registrationClosesAt <= registrationOpensAt
    ) {
      throw new BadRequestException(
        'Registration close must follow registration opening',
      );
    }
    if (
      programme.status === 'published' &&
      (!programme.description?.trim() ||
        !programme.guidelines?.trim() ||
        !programme.publicEmail ||
        !registrationOpensAt ||
        !registrationClosesAt ||
        programme.registrationLimit === null ||
        programme.priceMinor === null)
    ) {
      throw new ConflictException(
        'Complete all required programme fields before publishing',
      );
    }
  }

  private async audit(
    tx: Prisma.TransactionClient,
    programme: Programme,
    actorId: string,
    action: string,
  ) {
    await tx.auditLog.create({
      data: {
        actorId,
        action,
        targetType: 'programme',
        targetId: programme.id,
        organizationId: programme.organizationId,
      },
    });
  }
}
