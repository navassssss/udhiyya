import { addUserNotice } from '../communications/user-notice.js';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type ParticipationOption,
  type Programme,
} from '../generated/prisma/client.js';
import type { CreateHouseholdDto } from '../households/households.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  RegistrationDecisionDto,
  RegistrationQuery,
  ReplaceOptionsDto,
  SubmitRegistrationDto,
} from './registration.dto.js';

type Scope = { organizationId: string; programmeId: string };
type Client = Prisma.TransactionClient;

const registrationInclude = {
  applicant: { select: { id: true, name: true, email: true } },
} satisfies Prisma.RegistrationInclude;
type RegistrationDetail = Prisma.RegistrationGetPayload<{
  include: typeof registrationInclude;
}>;

function optionView(option: ParticipationOption) {
  return {
    id: option.id,
    name: option.name,
    price: { amountMinor: option.priceMinor, currency: 'INR' },
    maxShares: option.maxShares,
  };
}

function registrationView(row: RegistrationDetail) {
  return {
    id: row.id,
    status: row.status,
    applicant: row.applicant,
    household: row.householdSnapshot,
    option: {
      id: row.optionId,
      name: row.optionName,
      price: { amountMinor: row.unitPriceMinor, currency: 'INR' },
    },
    shares: row.shares,
    fee: { amountMinor: row.feeMinor, currency: 'INR' },
    submittedAt: row.submittedAt,
    decision: row.decidedAt
      ? { reason: row.decisionReason, decidedAt: row.decidedAt }
      : null,
  };
}

@Injectable()
export class RegistrationService {
  constructor(private readonly prisma: PrismaService) {}

  async getProgramme(
    client: Client,
    scope: Scope,
    published: boolean,
    writable = false,
  ): Promise<Programme> {
    const programme = await client.programme.findFirst({
      where: {
        id: scope.programmeId,
        organizationId: scope.organizationId,
        status: published ? { in: ['published', 'closed'] } : undefined,
        organization: { status: 'ACTIVE' },
      },
    });
    if (!programme) throw new NotFoundException('Programme not found');
    if (writable && programme.status === 'closed')
      throw new ConflictException('Programme is closed');
    return programme;
  }

  async options(scope: Scope, published: boolean) {
    await this.getProgramme(this.prisma, scope, published);
    const rows = await this.prisma.participationOption.findMany({
      where: { programmeId: scope.programmeId, active: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return { items: rows.map(optionView) };
  }

  async replaceOptions(scope: Scope, input: ReplaceOptionsDto) {
    return this.serial(async (tx) => {
      await this.getProgramme(tx, scope, false, true);
      const options = input.items.map((item) => ({
        id: item.id,
        price: item.price,
        maxShares: item.maxShares,
        name: item.name.trim(),
      }));
      const suppliedIds = options.flatMap((item) => (item.id ? [item.id] : []));
      if (
        options.some((item) => !item.name) ||
        new Set(suppliedIds).size !== suppliedIds.length
      ) {
        throw new BadRequestException(
          'Names must be non-blank and option IDs must be unique',
        );
      }

      await tx.participationOption.updateMany({
        where: { programmeId: scope.programmeId, id: { notIn: suppliedIds } },
        data: { active: false },
      });
      const saved = [];
      for (const item of options) {
        const data = {
          name: item.name,
          priceMinor: item.price.amountMinor,
          maxShares: item.maxShares,
          active: true,
        };
        if (item.id) {
          const existing = await tx.participationOption.findFirst({
            where: { id: item.id, programmeId: scope.programmeId },
          });
          if (!existing)
            throw new NotFoundException('Participation option not found');
          saved.push(
            await tx.participationOption.update({
              where: { id: existing.id },
              data,
            }),
          );
        } else {
          saved.push(
            await tx.participationOption.create({
              data: { ...data, programmeId: scope.programmeId },
            }),
          );
        }
      }
      return { items: saved.map(optionView) };
    });
  }

  async ownHousehold(scope: Scope, userId: string) {
    await this.getProgramme(this.prisma, scope, true);
    const household = await this.prisma.applicantHousehold.findUnique({
      where: { programmeId_userId: { programmeId: scope.programmeId, userId } },
    });
    if (!household)
      throw new NotFoundException('Household details have not been submitted');
    return this.householdView(household);
  }

  async saveHousehold(scope: Scope, userId: string, input: CreateHouseholdDto) {
    return this.serial(async (tx) => {
      await this.getProgramme(tx, scope, true, true);
      const name = input.name.trim();
      const address = input.address.trim();
      const phone = input.contact.phone?.trim();
      if (!name || !address || (input.contact.phone != null && !phone)) {
        throw new BadRequestException('Household fields must be non-blank');
      }
      const data = {
        name,
        address,
        contactEmail: input.contact.email?.toLowerCase() ?? null,
        contactPhone: phone ?? null,
      };
      const household = await tx.applicantHousehold.upsert({
        where: {
          programmeId_userId: { programmeId: scope.programmeId, userId },
        },
        create: { ...data, programmeId: scope.programmeId, userId },
        update: data,
      });
      return this.householdView(household);
    });
  }

  async submit(scope: Scope, userId: string, input: SubmitRegistrationDto) {
    return this.serial(async (tx) => {
      const programme = await this.getProgramme(tx, scope, true, true);
      const now = new Date();
      if (
        !programme.registrationOpensAt ||
        !programme.registrationClosesAt ||
        programme.registrationOpensAt > now ||
        programme.registrationClosesAt <= now
      ) {
        throw new ConflictException('Registration is closed');
      }
      const unique = { programmeId: scope.programmeId, applicantId: userId };
      if (
        await tx.registration.findUnique({
          where: { programmeId_applicantId: unique },
        })
      ) {
        throw new ConflictException(
          'A registration already exists for this applicant',
        );
      }
      const registrations = await tx.registration.count({
        where: {
          programmeId: scope.programmeId,
          status: { in: ['submitted', 'approved'] },
        },
      });
      if (
        programme.registrationLimit === null ||
        registrations >= programme.registrationLimit
      ) {
        throw new ConflictException('Registration capacity reached');
      }
      const household = await tx.applicantHousehold.findUnique({
        where: {
          programmeId_userId: { programmeId: scope.programmeId, userId },
        },
      });
      if (!household)
        throw new ConflictException('Submit household details before applying');
      const option = await tx.participationOption.findFirst({
        where: {
          id: input.optionId,
          programmeId: scope.programmeId,
          active: true,
        },
      });
      if (!option)
        throw new NotFoundException('Participation option not found');
      const feeMinor = input.shares * option.priceMinor;
      if (input.shares > option.maxShares || feeMinor > 2147483647) {
        throw new BadRequestException('Requested shares exceed option limits');
      }
      const registered = await tx.registration.create({
        data: {
          ...unique,
          householdId: household.id,
          householdSnapshot: this.householdView(household),
          optionId: option.id,
          optionName: option.name,
          unitPriceMinor: option.priceMinor,
          feeMinor,
          shares: input.shares,
        },
        include: registrationInclude,
      });
      await this.audit(
        tx,
        scope,
        registered.id,
        userId,
        'REGISTRATION_SUBMITTED',
      );
      return registrationView(registered);
    });
  }

  async getOwn(scope: Scope, userId: string) {
    await this.getProgramme(this.prisma, scope, true);
    const row = await this.prisma.registration.findUnique({
      where: {
        programmeId_applicantId: {
          programmeId: scope.programmeId,
          applicantId: userId,
        },
      },
      include: registrationInclude,
    });
    if (!row) throw new NotFoundException('Registration not found');
    return registrationView(row);
  }

  async ownParticipation(scope: Scope, userId: string) {
    const registration = await this.getOwn(scope, userId);
    const allocation = await this.prisma.shareAllocation.findUnique({
      where: { registrationId: registration.id },
      select: {
        shares: true,
        group: {
          select: {
            id: true,
            name: true,
            animal: { select: { id: true, reference: true } },
          },
        },
      },
    });
    const operations = allocation
      ? await this.prisma.schedule.findMany({
          where: {
            programmeId: scope.programmeId,
            animalId: allocation.group.animal.id,
            department: { in: ['slaughter', 'processing'] },
          },
          select: { department: true, status: true, stage: true },
          orderBy: { startsAt: 'asc' },
        })
      : [];
    const distribution = await this.prisma.distributionAllocation.findFirst({
      where: {
        programmeId: scope.programmeId,
        registrationId: registration.id,
        status: { in: ['confirmed', 'packed', 'collected', 'delivered'] },
      },
      select: {
        id: true,
        status: true,
        quantityGrams: true,
        collectionReference: true,
        packedAt: true,
        handedOffAt: true,
        collectionWindow: {
          select: {
            id: true,
            location: true,
            startsAt: true,
            endsAt: true,
            instructions: true,
          },
        },
      },
    });
    return {
      registration,
      assignment: allocation
        ? {
            shares: allocation.shares,
            group: { id: allocation.group.id, name: allocation.group.name },
            animal: allocation.group.animal,
          }
        : null,
      operations: operations.length ? operations : null,
      distribution,
    };
  }

  async list(scope: Scope, query: RegistrationQuery) {
    await this.getProgramme(this.prisma, scope, false);
    const rows = await this.prisma.registration.findMany({
      where: {
        programmeId: scope.programmeId,
        status: query.status,
        id: query.cursor ? { gt: query.cursor } : undefined,
        applicant: query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : undefined,
      },
      orderBy: { id: 'asc' },
      take: query.limit + 1,
      include: registrationInclude,
    });
    const items = rows.slice(0, query.limit).map(registrationView);
    return {
      items,
      nextCursor: rows.length > query.limit ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async get(scope: Scope, id: string) {
    await this.getProgramme(this.prisma, scope, false);
    return registrationView(await this.find(this.prisma, scope, id));
  }

  async decide(
    scope: Scope,
    id: string,
    actorId: string,
    dto: RegistrationDecisionDto,
  ) {
    return this.serial(async (tx) => {
      await this.getProgramme(tx, scope, false, true);
      const registration = await this.find(tx, scope, id);
      const nextStatus = {
        approve: 'approved',
        reject: 'rejected',
        cancel: 'cancelled',
      } as const;
      const status = nextStatus[dto.action];
      if (registration.status === status) return registrationView(registration);
      if (
        registration.status !== 'submitted' &&
        !(registration.status === 'approved' && status === 'cancelled')
      ) {
        throw new ConflictException(
          'Registration status transition is not allowed',
        );
      }
      if (status === 'cancelled') {
        const allocation = await tx.shareAllocation.findUnique({
          where: { registrationId: id },
          select: { id: true },
        });
        if (allocation)
          throw new ConflictException(
            'Release the share allocation before cancelling registration',
          );
      }
      if (status === 'cancelled') {
        const payment = await tx.payment.findFirst({
          where: {
            programmeId: scope.programmeId,
            registrationId: id,
            status: { in: ['pending', 'verified'] },
          },
          select: { id: true },
        });
        if (payment)
          throw new ConflictException(
            'Resolve payments before cancelling registration',
          );
      }
      if (
        status === 'cancelled' &&
        (await tx.distributionAllocation.count({
          where: {
            programmeId: scope.programmeId,
            registrationId: id,
            status: { not: 'cancelled' },
          },
        }))
      ) {
        throw new ConflictException(
          'Resolve distribution allocations before cancelling registration',
        );
      }
      const changed = await tx.registration.update({
        where: { id, programmeId: scope.programmeId },
        data: {
          status,
          decidedAt: new Date(),
          decisionReason: dto.reason?.trim() || null,
        },
        include: registrationInclude,
      });
      if (status === 'approved') {
        await tx.receipt.create({
          data: {
            programmeId: scope.programmeId,
            registrationId: id,
            kind: 'registration',
          },
        });
      }
      await this.audit(
        tx,
        scope,
        id,
        actorId,
        'REGISTRATION_' + status.toUpperCase(),
      );
      await addUserNotice(
        tx,
        scope.programmeId,
        registration.applicantId,
        'Registration updated',
        'Your programme registration is ' + status + '.',
      );
      return registrationView(changed);
    });
  }

  private async find(client: Client, scope: Scope, id: string) {
    const row = await client.registration.findFirst({
      where: { id, programmeId: scope.programmeId },
      include: registrationInclude,
    });
    if (!row) throw new NotFoundException('Registration not found');
    return row;
  }

  private householdView(row: {
    name: string;
    address: string;
    contactEmail: string | null;
    contactPhone: string | null;
  }) {
    return {
      name: row.name,
      address: row.address,
      contact: { email: row.contactEmail, phone: row.contactPhone },
    };
  }

  private async serial<T>(work: (tx: Client) => Promise<T>) {
    try {
      return await this.prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2034' || error.code === 'P2002')
      ) {
        throw new ConflictException(
          'A concurrent programme change occurred. Refresh and retry.',
        );
      }
      throw error;
    }
  }

  private async audit(
    tx: Client,
    scope: Scope,
    id: string,
    actorId: string,
    action: string,
  ) {
    await tx.auditLog.create({
      data: {
        actorId,
        action,
        targetType: 'registration',
        targetId: id,
        organizationId: scope.organizationId,
      },
    });
  }
}
