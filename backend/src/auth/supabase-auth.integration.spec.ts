import ExcelJS from 'exceljs';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { UserStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

const subject = '9cc92916-c427-48f3-86ba-9473eeaf71ed';
const id = 'ad9830e6-bbe4-4034-88e1-21e8e7d13225';
const confirmedAt = '2026-01-01T00:00:00Z';
const profile = {
  id,
  email: 'user@example.com',
  name: 'user',
  status: UserStatus.ACTIVE,
  deletedAt: null,
  emailVerifiedAt: new Date(confirmedAt),
};
const assignments = vi.fn().mockResolvedValue([]);
const orgId = 'ae73944a-acf7-4e07-b566-d14d9dc36199';
const programme = {
  id: '3eb12077-1049-4c77-a607-39f45b27fd42',
  organizationId: orgId,
  year: 2027,
  title: 'Annual programme',
  status: 'published',
  registrationLimit: 50,
  priceMinor: 100,
};
const findProgramme = vi.fn();
const findRegistration = vi.fn().mockResolvedValue(null);
const countRegistrations = vi.fn().mockResolvedValue(0);
const createRegistration = vi.fn();
const findApplicantHousehold = vi.fn();
const findOption = vi.fn();
const findOrganisations = vi.fn().mockResolvedValue([]);
const createOrganisation = vi.fn();
const createAuditEvent = vi.fn().mockResolvedValue({});
const createMembership = vi.fn();
const findMembership = vi.fn().mockResolvedValue(null);
const importHouseholds = vi.fn().mockResolvedValue({ count: 1 });
let app: NestFastifyApplication;

beforeAll(async () => {
  vi.stubEnv('AUTH_MODE', 'supabase');
  vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'publishable-key');
  vi.stubEnv('DATABASE_URL', 'postgresql://localhost/test');
  vi.stubEnv('API_PREFIX', '');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        id: subject,
        email: profile.email,
        email_confirmed_at: confirmedAt,
      }),
    ),
  );

  const { AppModule } = await import('../app.module.js');
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({
      user: {
        findUnique: vi.fn().mockResolvedValue(profile),
        findFirst: vi.fn().mockResolvedValue(profile),
      },
      userRole: { findMany: assignments },
      organizationMember: { findFirst: findMembership },
      programme: { findFirst: findProgramme },
      registration: { findUnique: findRegistration },
      household: { createMany: importHouseholds },
      organization: { findMany: findOrganisations },
      $transaction: async (work: (tx: object) => Promise<unknown>) =>
        work({
          organization: { create: createOrganisation },
          programme: { findFirst: findProgramme },
          applicantHousehold: { findUnique: findApplicantHousehold },
          participationOption: { findFirst: findOption },
          registration: {
            findUnique: findRegistration,
            count: countRegistrations,
            create: createRegistration,
          },
          organizationMember: { create: createMembership },
          auditLog: { create: createAuditEvent },
        }),
      role: { findMany: vi.fn().mockResolvedValue([]) },
    })
    .compile();
  const { configureFastifyApp, setupSwagger } = await import('../main.js');
  app = module.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
    { logger: false },
  );
  const appConfig = await configureFastifyApp(app);
  setupSwagger(app, appConfig);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});

afterAll(async () => {
  await app?.close();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('connects Supabase identity to the profile and database-backed permission guard', async () => {
  const client = request(app.getHttpServer());
  await client
    .get('/users/me')
    .expect(401)
    .expect(({ body }) => {
      expect(body).toMatchObject({ statusCode: 401, path: '/users/me' });
    });
  await client
    .get('/users/me')
    .set('Authorization', 'Bearer token')
    .expect(200)
    .expect(({ body }) => {
      expect(body).toMatchObject({ id, roles: [], permissions: [] });
    });
  await client.get('/roles').set('Authorization', 'Bearer token').expect(403);
  assignments.mockResolvedValueOnce([
    {
      role: {
        slug: 'reviewer',
        rolePermissions: [{ permission: { key: 'role:read' } }],
      },
    },
  ]);
  await client.get('/roles').set('Authorization', 'Bearer token').expect(200);
  await client.post('/auth/login').expect(404);
  await client
    .get('/sessions')
    .set('Authorization', 'Bearer token')
    .expect(404);
});

it('limits the anonymous programme response to published records and public fields', async () => {
  const client = request(app.getHttpServer());
  const url = `/public/organisations/${orgId}/programmes/2027`;
  findProgramme.mockResolvedValueOnce(null);
  await client.get(url).expect(404);
  expect(findProgramme).toHaveBeenLastCalledWith({
    where: {
      organizationId: orgId,
      year: 2027,
      status: 'published',
      organization: { status: 'ACTIVE' },
    },
  });
  findProgramme.mockResolvedValueOnce(programme);
  await client
    .get(url)
    .expect(200)
    .expect(({ body }) => {
      expect(body).toMatchObject({
        title: programme.title,
        price: { amountMinor: 100, currency: 'INR' },
      });
      expect(body).not.toHaveProperty('registrationLimit');
      expect(body).not.toHaveProperty('organisationId');
    });
});

it('denies committee programme reads without active membership', async () => {
  findProgramme.mockClear();
  await request(app.getHttpServer())
    .get(`/organisations/${orgId}/programmes/${programme.id}`)
    .set('Authorization', 'Bearer token')
    .expect(403);
  expect(findMembership).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        organizationId: orgId,
        status: 'ACTIVE',
      }),
    }),
  );
  expect(findProgramme).not.toHaveBeenCalled();
});

it('serves Swagger UI assets with the Fastify adapter', async () => {
  const client = request(app.getHttpServer());
  await client
    .get('/docs-json')
    .expect(200)
    .expect(({ body }) => {
      expect(body.paths).toHaveProperty(['/organisations/{orgId}/programmes']);
    });
  await client.get('/docs/swagger-ui.css').expect(200);
});

it('restricts platform organisation search to the platform super admin', async () => {
  const client = request(app.getHttpServer());
  await client
    .get('/platform/organisations')
    .set('Authorization', 'Bearer token')
    .expect(403);
  expect(findOrganisations).not.toHaveBeenCalled();

  assignments.mockResolvedValueOnce([
    { role: { slug: 'super_admin', rolePermissions: [] } },
  ]);
  await client
    .get('/platform/organisations?search=Mahallu&limit=2')
    .set('Authorization', 'Bearer token')
    .expect(200, { items: [], nextCursor: null });

  expect(findOrganisations).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        name: { contains: 'Mahallu', mode: 'insensitive' },
      }),
      take: 3,
    }),
  );
});

it('creates an onboarding workspace without granting the platform actor committee membership', async () => {
  assignments.mockResolvedValueOnce([
    { role: { slug: 'super_admin', rolePermissions: [] } },
  ]);
  const payload = {
    name: 'Example Mahallu',
    locality: 'Example Town',
    contact: { email: 'office@example.com' },
  };
  createOrganisation.mockResolvedValueOnce({
    id: orgId,
    name: payload.name,
    locality: payload.locality,
    contactEmail: payload.contact.email,
    status: 'ONBOARDING',
  });

  await request(app.getHttpServer())
    .post('/platform/organisations')
    .set('Authorization', 'Bearer token')
    .send(payload)
    .expect(201, { id: orgId, status: 'onboarding', ...payload });

  expect(createMembership).not.toHaveBeenCalled();
  expect(createAuditEvent).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ actorId: id, organizationId: orgId }),
    }),
  );
});

it('imports valid household CSV records atomically and reports invalid rows without writing', async () => {
  const membership = {
    id,
    organization: { id: orgId, name: 'Example Mahallu', slug: 'example' },
    roles: [
      {
        role: { slug: 'org_admin', scope: 'ORGANIZATION', rolePermissions: [] },
      },
    ],
  };
  const send = (csv: string) => {
    findMembership.mockResolvedValueOnce(membership);
    return request(app.getHttpServer())
      .post(`/organisations/${orgId}/households/import`)
      .set('Authorization', 'Bearer token')
      .attach('file', Buffer.from(csv), 'households.csv');
  };

  await send('name,address,email\nExample,Main Street,invalid\n')
    .expect(200)
    .expect(({ body }) => {
      expect(body).toMatchObject({
        importedCount: 0,
        errors: [{ row: 2, field: 'contact.email' }],
      });
    });
  await send('name,address\nExample,Main Street\nExample,Main Street\n')
    .expect(200)
    .expect(({ body }) => {
      expect(body).toMatchObject({
        importedCount: 0,
        errors: [{ row: 3, field: 'row' }],
      });
    });
  expect(importHouseholds).not.toHaveBeenCalled();

  await send(
    'name,address,email\nExample,Main Street,office@example.com\n',
  ).expect(200, { importedCount: 1, errors: [] });
  expect(importHouseholds).toHaveBeenCalledWith({
    data: [
      {
        organizationId: orgId,
        name: 'Example',
        address: 'Main Street',
        contactEmail: 'office@example.com',
        contactPhone: null,
      },
    ],
  });
});

it('imports a valid XLSX workbook through Fastify', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Households');
  sheet.addRow(['name', 'address', 'phone']);
  sheet.addRow(['Example', 'Main Street', '001234']);
  const file = Buffer.from(await workbook.xlsx.writeBuffer());
  findMembership.mockResolvedValueOnce({
    id,
    organization: { id: orgId, name: 'Example Mahallu', slug: 'example' },
    roles: [
      {
        role: { slug: 'org_admin', scope: 'ORGANIZATION', rolePermissions: [] },
      },
    ],
  });

  await request(app.getHttpServer())
    .post(`/organisations/${orgId}/households/import`)
    .set('Authorization', 'Bearer token')
    .attach('file', file, 'households.xlsx')
    .expect(200, { importedCount: 1, errors: [] });
  expect(importHouseholds).toHaveBeenLastCalledWith({
    data: [
      {
        organizationId: orgId,
        name: 'Example',
        address: 'Main Street',
        contactEmail: null,
        contactPhone: '001234',
      },
    ],
  });
});

it('scopes self-service registration to the authenticated applicant and the active programme', async () => {
  const client = request(app.getHttpServer());
  const route = `/organisations/${orgId}/programmes/${programme.id}/me/registration`;
  await client.get(route).expect(401);

  findProgramme.mockResolvedValueOnce(programme);
  await client.get(route).set('Authorization', 'Bearer token').expect(404);
  expect(findProgramme).toHaveBeenLastCalledWith({
    where: {
      id: programme.id,
      organizationId: orgId,
      status: { in: ['published', 'closed'] },
      organization: { status: 'ACTIVE' },
    },
  });
  expect(findRegistration).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        programmeId_applicantId: { programmeId: programme.id, applicantId: id },
      },
    }),
  );
});

it('checks registration capacity and snapshots the selected option price on submission', async () => {
  const optionId = 'e90f1181-45e6-4b8d-afb0-67242717dc95';
  const programmeWithWindow = {
    ...programme,
    registrationOpensAt: new Date(0),
    registrationClosesAt: new Date('9999-01-01T00:00:00Z'),
  };
  const submit = () =>
    request(app.getHttpServer())
      .post(
        `/organisations/${orgId}/programmes/${programme.id}/me/registration`,
      )
      .set('Authorization', 'Bearer token')
      .send({ optionId, shares: 2 });

  findProgramme.mockResolvedValueOnce(programmeWithWindow);
  countRegistrations.mockResolvedValueOnce(programme.registrationLimit);
  await submit().expect(409);
  expect(createRegistration).not.toHaveBeenCalled();

  findProgramme.mockResolvedValueOnce(programmeWithWindow);
  findApplicantHousehold.mockResolvedValueOnce({
    id,
    name: 'Example',
    address: 'Main Street',
    contactEmail: null,
    contactPhone: null,
  });
  findOption.mockResolvedValueOnce({
    id: optionId,
    name: 'Share',
    priceMinor: 12500,
    maxShares: 2,
  });
  createRegistration.mockImplementationOnce(async ({ data }) => ({
    ...data,
    id,
    status: 'submitted',
    applicant: { id, name: profile.name, email: profile.email },
  }));

  await submit()
    .expect(201)
    .expect(({ body }) => {
      expect(body).toMatchObject({
        status: 'submitted',
        shares: 2,
        fee: { amountMinor: 25000, currency: 'INR' },
      });
    });
  expect(createRegistration).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        applicantId: id,
        programmeId: programme.id,
        optionId,
        feeMinor: 25000,
      }),
    }),
  );
});
