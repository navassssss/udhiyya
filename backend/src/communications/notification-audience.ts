import type {
  NotificationAudience,
  Prisma,
} from '../generated/prisma/client.js';

export function notificationAudience(
  programmeId: string,
  audience: NotificationAudience,
): Prisma.UserWhereInput {
  const matches = (group: NotificationAudience) =>
    audience === group || audience === 'all';
  const groups: Prisma.UserWhereInput[] = [];
  if (matches('participants'))
    groups.push({ registrations: { some: { programmeId } } });
  if (matches('beneficiaries'))
    groups.push({
      beneficiaryLinks: { some: { programmeId, eligibility: 'approved' } },
    });
  if (matches('volunteers'))
    groups.push({
      volunteerAssignments: { some: { programmeId, active: true } },
    });
  return { status: 'ACTIVE', emailVerifiedAt: { not: null }, OR: groups };
}
