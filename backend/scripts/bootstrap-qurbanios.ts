import { PrismaClient, RoleScope, UserStatus, OrganizationStatus, MembershipStatus, ProgrammeStatus } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import argon2 from 'argon2';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const useSsl =
  process.env.DATABASE_SSL === 'true' ||
  connectionString.includes('supabase.com') ||
  connectionString.includes('sslmode=require');
const pool = new pg.Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

async function main() {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SAMPLE_BOOTSTRAP) {
    console.error('FATAL: bootstrap-qurbanios contains sample development data and is strictly blocked in production.');
    process.exit(1);
  }

  console.log('--- Bootstrapping QurbaniOS Persistent Database ---');

  // 1. Ensure Organization
  const org = await prisma.organization.upsert({
    where: { id: 'e775b56d-38e8-42ee-9a24-9b0e51582ca5' },
    create: {
      id: 'e775b56d-38e8-42ee-9a24-9b0e51582ca5',
      name: 'Al-Rahma Mahallu Committee',
      slug: 'al-rahma-mahallu',
      locality: 'Calicut Central',
      contactEmail: 'committee@alrahma.local',
      status: OrganizationStatus.ACTIVE,
    },
    update: {
      status: OrganizationStatus.ACTIVE,
    },
  });
  console.log(`Organization verified: ${org.name} (${org.id}) [status: ${org.status}]`);

  // 2. Fetch or create roles
  const superAdminRole = await prisma.role.findFirstOrThrow({
    where: { slug: 'super_admin', scope: RoleScope.GLOBAL },
  });

  const orgAdminRole = await prisma.role.findFirstOrThrow({
    where: { slug: 'org_admin', scope: RoleScope.ORGANIZATION },
  });

  const orgMemberRole = await prisma.role.findFirstOrThrow({
    where: { slug: 'org_member', scope: RoleScope.ORGANIZATION },
  });

  const orgViewerRole = await prisma.role.findFirstOrThrow({
    where: { slug: 'org_viewer', scope: RoleScope.ORGANIZATION },
  });

  const customerRole = await prisma.role.findFirstOrThrow({
    where: { slug: 'customer', scope: RoleScope.GLOBAL },
  });

  // 3. Setup Users
  const userDefs = [
    {
      email: 'admin@qurbanios.local',
      password: 'SuperAdminPassword123!',
      name: 'System Administrator',
      globalRole: superAdminRole,
      orgRole: null,
    },
    {
      email: 'committee@alrahma.local',
      password: 'CommitteeAdmin123!',
      name: 'Ahmed Koya (Committee Admin)',
      globalRole: customerRole,
      orgRole: orgAdminRole,
    },
    {
      email: 'volunteer@alrahma.local',
      password: 'VolunteerPass123!',
      name: 'Yusuf Ahmed (Volunteer Operations)',
      globalRole: customerRole,
      orgRole: orgMemberRole,
    },
    {
      email: 'participant@alrahma.local',
      password: 'ParticipantPass123!',
      name: 'Mohammed Ashraf (Participant)',
      globalRole: customerRole,
      orgRole: orgViewerRole,
    },
  ];

  for (const u of userDefs) {
    const passwordHash = await hashPassword(u.password);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: {
        email: u.email,
        passwordHash,
        name: u.name,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        activeOrganizationId: u.orgRole ? org.id : null,
      },
      update: {
        passwordHash,
        name: u.name,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        activeOrganizationId: u.orgRole ? org.id : null,
      },
    });

    // Global role
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: u.globalRole.id } },
      create: { userId: user.id, roleId: u.globalRole.id },
      update: {},
    });

    // Org membership if orgRole is defined
    if (u.orgRole) {
      const member = await prisma.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
        create: {
          organizationId: org.id,
          userId: user.id,
          status: MembershipStatus.ACTIVE,
        },
        update: {
          status: MembershipStatus.ACTIVE,
        },
      });

      await prisma.organizationMemberRole.upsert({
        where: { memberId_roleId: { memberId: member.id, roleId: u.orgRole.id } },
        create: { memberId: member.id, roleId: u.orgRole.id },
        update: {},
      });
    }

    console.log(`User configured: ${user.email} (${u.name})`);
  }

  // 4. Ensure Programme
  const existingProg = await prisma.programme.findFirst({
    where: { organizationId: org.id, year: 2027 },
  });

  const progData = {
    organizationId: org.id,
    year: 2027,
    title: 'Eid al-Adha 1448 / 2027 Qurbani Programme',
    status: ProgrammeStatus.published,
    description: 'Annual community Qurbani programme organizing cattle shares, sacrifice, hygienic processing, and door-to-door meat distribution across all local wards.',
    guidelines: '1 share per participant or household; animal inspection completed according to Halal slaughter standards.',
    publicEmail: 'programme@alrahma.local',
    priceMinor: 250000,
    registrationLimit: 200,
    registrationOpensAt: new Date('2026-01-01T00:00:00Z'),
    registrationClosesAt: new Date('2027-12-31T23:59:59Z'),
  };

  const prog = existingProg
    ? await prisma.programme.update({ where: { id: existingProg.id }, data: progData })
    : await prisma.programme.create({ data: progData });

  console.log(`Published Programme verified: ${prog.title} (ID: ${prog.id})`);

  // 5. Ensure Participation Option
  const OPTION_ID = 'a1111111-1111-4111-8111-111111111111';
  await prisma.participationOption.deleteMany({
    where: { id: 'a1111111-1111-1111-1111-111111111111' },
  });

  const option = await prisma.participationOption.upsert({
    where: { id: OPTION_ID },
    create: {
      id: OPTION_ID,
      programmeId: prog.id,
      name: 'Cattle (1/7 Share)',
      maxShares: 7,
      priceMinor: 250000,
      active: true,
    },
    update: {
      priceMinor: 250000,
      maxShares: 7,
      active: true,
    },
  });
  console.log(`Participation Option verified: ${option.name} (7-share, ₹2,500)`);

  // 6. Ensure Volunteer record in Programme
  const volunteerUser = await prisma.user.findUniqueOrThrow({ where: { email: 'volunteer@alrahma.local' } });
  const volRecord = await prisma.volunteer.upsert({
    where: { programmeId_email: { programmeId: prog.id, email: volunteerUser.email } },
    create: {
      programmeId: prog.id,
      userId: volunteerUser.id,
      name: volunteerUser.name,
      email: volunteerUser.email,
      departments: ['slaughter', 'processing', 'distribution', 'finance'],
      active: true,
    },
    update: {
      userId: volunteerUser.id,
      departments: ['slaughter', 'processing', 'distribution', 'finance'],
      active: true,
    },
  });
  console.log(`Volunteer record verified in Programme: ${volRecord.name} (ID: ${volRecord.id})`);

  // 7. Ensure Applicant Household in Programme
  const participantUser = await prisma.user.findUniqueOrThrow({ where: { email: 'participant@alrahma.local' } });
  const applicantHousehold = await prisma.applicantHousehold.upsert({
    where: { programmeId_userId: { programmeId: prog.id, userId: participantUser.id } },
    create: {
      programmeId: prog.id,
      userId: participantUser.id,
      name: 'Mohammed Ashraf Household',
      address: 'House #42, North Ward, Calicut',
      contactEmail: 'participant@alrahma.local',
      contactPhone: '+91 98470 12345',
    },
    update: {
      address: 'House #42, North Ward, Calicut',
    },
  });
  console.log(`Applicant Household verified in Programme: ${applicantHousehold.name} (ID: ${applicantHousehold.id})`);

  console.log('--- Database Bootstrap Complete & Verified ---');
  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
