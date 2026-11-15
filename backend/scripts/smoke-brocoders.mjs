import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { EMAIL_DISPATCHER } from '../dist/email/interfaces/email-job.interface.js';

const db = new PGlite();
const server = new PGLiteSocketServer({ db, port: 0, host: '127.0.0.1' });
let app;
let pool;
let prisma;
const summary = [];
try {
  const entries = await readdir('prisma/migrations', { withFileTypes: true });
  for (const name of entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()) {
    await db.exec(
      await readFile('prisma/migrations/' + name + '/migration.sql', 'utf8'),
    );
  }
  await server.start();
  const connection =
    'postgresql://postgres:postgres@' + server.getServerConn() + '/postgres';
  Object.assign(process.env, {
    NODE_ENV: 'test',
    AUTH_MODE: 'brocoders',
    API_PREFIX: 'api/v1',
    DATABASE_URL: connection,
    DIRECT_URL: connection,
    DATABASE_SSL: 'false',
    JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
    FRONTEND_URL: 'http://localhost:5173',
    GOOGLE_OAUTH_ENABLED: 'true',
    GOOGLE_CLIENT_ID: 'synthetic.apps.googleusercontent.com',
    EMAIL_ENABLED: 'false',
    SMTP_ENABLED: 'false',
    ENABLE_ORGANIZATIONS: 'true',
    ALLOWED_AUTH_PROVIDERS: 'local,google',
    DEFAULT_USER_ROLE: 'customer',
    FEATURE_EF_01: 'off',
    FEATURE_EF_02: 'off',
    FEATURE_EF_03: 'off',
    FEATURE_EF_04: 'off',
    FEATURE_EF_05: 'off',
  });

  const { AppModule } = await import('../dist/app.module.js');
  const { configureFastifyApp, setupSwagger } = await import('../dist/main.js');
  const { GoogleOAuthService } =
    await import('../dist/auth/google-oauth.service.js');
  const { PrismaService } = await import('../dist/prisma/prisma.service.js');
  pool = new pg.Pool({ connectionString: connection, max: 1 });
  prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  prisma.checkHealth = async () => {
    await prisma.$queryRawUnsafe('SELECT 1');
    return true;
  };
  const messages = [];
  const testModule = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(EMAIL_DISPATCHER)
    .useValue({
      dispatch: async (message) => {
        messages.push(message);
      },
    })
    .compile();
  app = testModule.createNestApplication(new FastifyAdapter(), {
    logger: ['error'],
  });
  const config = await configureFastifyApp(app);
  setupSwagger(app, config);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  await prisma.role.createMany({
    data: [
      {
        name: 'Regular User',
        slug: 'customer',
        scope: 'GLOBAL',
        isSystem: true,
      },
      {
        name: 'Super Admin',
        slug: 'super_admin',
        scope: 'GLOBAL',
        isSystem: true,
      },
      {
        name: 'Committee Admin',
        slug: 'org_admin',
        scope: 'ORGANIZATION',
        isSystem: true,
      },
    ],
  });
  const google = app.get(GoogleOAuthService);
  google.verifyGoogleIdToken = async (idToken) => {
    if (idToken === 'fake-invalid') throw new Error('invalid');
    return {
      sub: idToken,
      email:
        idToken === 'collision'
          ? 'updated@example.test'
          : 'google@example.test',
      emailVerified: true,
      name: 'Google Example',
      picture: null,
    };
  };

  async function hit(method, path, status, payload, accessToken) {
    const response = await app.inject({
      method,
      url: '/api/v1' + path,
      payload,
      headers: accessToken ? { authorization: 'Bearer ' + accessToken } : {},
    });
    assert.equal(
      response.statusCode,
      status,
      method +
        ' ' +
        path +
        ' expected ' +
        status +
        ', got ' +
        response.statusCode +
        (response.statusCode < 400 ? '' : ' ' + response.body),
    );
    return response.body ? response.json() : undefined;
  }

  async function hashFrom(email, path) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const message = messages.find(
        (item) => item.to === email && item.text.includes(path),
      );
      const match = message?.text.match(
        new RegExp(path + '\\?hash=([A-Za-z0-9_-]+)'),
      );
      if (match) return match[1];
      await delay(20);
    }
    throw new Error('No synthetic confirmation link for ' + path);
  }

  await hit('GET', '/health', 200);
  await hit('POST', '/auth/email/register', 422, { email: 'bad' });
  const credentials = { email: 'test@example.test', password: 'pass12' };
  await hit('POST', '/auth/email/register', 204, {
    ...credentials,
    firstName: 'Synthetic',
    lastName: 'Test User',
  });
  await hit('POST', '/auth/email/login', 403, credentials);
  await hit('POST', '/auth/email/confirm', 204, {
    hash: await hashFrom(credentials.email, '/confirm-email'),
  });
  const session = await hit('POST', '/auth/email/login', 200, credentials);
  assert.equal(session.user.lastName, 'Test User');
  assert.equal(session.user.role.id, 2);
  assert.ok(session.tokenExpires > Date.now());
  const profile = await hit('GET', '/auth/me', 200, undefined, session.token);
  assert.equal(profile.email, credentials.email);
  assert.deepEqual(profile.organisations, []);
  const rotated = await hit(
    'POST',
    '/auth/refresh',
    200,
    undefined,
    session.refreshToken,
  );
  assert.notEqual(rotated.refreshToken, session.refreshToken);
  await hit('POST', '/auth/logout', 204, undefined, rotated.token);
  await hit('GET', '/auth/me', 401, undefined, rotated.token);
  summary.push(
    'Email register, confirm, login, protected profile, refresh and logout',
  );

  await hit('POST', '/auth/forgot/password', 204, { email: credentials.email });
  await hit('POST', '/auth/reset/password', 204, {
    hash: await hashFrom(credentials.email, '/password-change'),
    password: 'new123',
  });
  await hit('POST', '/auth/email/login', 401, credentials);
  const resetSession = await hit('POST', '/auth/email/login', 200, {
    ...credentials,
    password: 'new123',
  });
  await hit(
    'POST',
    '/auth/email/change',
    204,
    { email: 'updated@example.test', password: 'new123' },
    resetSession.token,
  );
  const newEmailHash = await hashFrom(
    'updated@example.test',
    '/confirm-new-email',
  );
  await hit('POST', '/auth/email/confirm/new', 204, { hash: newEmailHash });
  await hit('POST', '/auth/email/confirm/new', 400, { hash: newEmailHash });
  await hit('GET', '/auth/me', 401, undefined, resetSession.token);
  await hit('POST', '/auth/email/login', 200, {
    email: 'updated@example.test',
    password: 'new123',
  });
  summary.push('Password reset, email change and session revocation');

  const firstGoogle = await hit('POST', '/auth/google/login', 200, {
    idToken: 'fake-google',
  });
  const nextGoogle = await hit('POST', '/auth/google/login', 200, {
    idToken: 'fake-google',
  });
  assert.equal(firstGoogle.user.id, nextGoogle.user.id);
  await hit('POST', '/auth/google/login', 401, { idToken: 'fake-invalid' });
  const collision = await hit('POST', '/auth/google/login', 409, {
    idToken: 'collision',
  });
  assert.equal(collision.code, 'ACCOUNT_LINK_REQUIRED');
  summary.push(
    'Google login path with stubbed Google verification, stable identity and rejection',
  );

  const superAdmin = await prisma.role.findFirstOrThrow({
    where: { slug: 'super_admin', scope: 'GLOBAL' },
  });
  await prisma.userRole.create({
    data: { userId: session.user.id, roleId: superAdmin.id },
  });
  const admin = await hit('POST', '/auth/email/login', 200, {
    email: 'updated@example.test',
    password: 'new123',
  });
  assert.equal(admin.user.role.id, 1);
  const onboardPayload = {
    name: 'Synthetic Mahallu',
    locality: 'Example Town',
    contact: { email: 'admin@example.test' },
  };
  await hit(
    'POST',
    '/platform/organisations',
    403,
    onboardPayload,
    firstGoogle.token,
  );
  await hit(
    'POST',
    '/platform/organisations',
    201,
    onboardPayload,
    admin.token,
  );
  const create = {
    email: 'regular@example.test',
    password: 'pass12',
    firstName: 'Regular',
    lastName: 'User',
    role: { id: 2 },
    status: { id: 1 },
  };
  await hit('POST', '/users', 403, create, firstGoogle.token);
  await hit('POST', '/users', 201, create, admin.token);
  const regular = await hit('POST', '/auth/email/login', 200, {
    email: create.email,
    password: create.password,
  });
  assert.equal(regular.user.role.id, 2);
  assert.equal(regular.user.emailVerifiedAt, null);
  summary.push(
    'Super Admin guards, organisation creation, admin provisioning and immediate regular login',
  );

  async function signUp(email, name) {
    const credentials = { email, password: 'pass12' };
    await hit('POST', '/auth/email/register', 204, {
      ...credentials,
      firstName: name,
      lastName: 'Smoke',
    });
    await hit('POST', '/auth/email/confirm', 204, {
      hash: await hashFrom(email, '/confirm-email'),
    });
    return hit('POST', '/auth/email/login', 200, credentials);
  }

  const tenant = await hit(
    'POST',
    '/platform/organisations',
    201,
    { ...onboardPayload, name: 'Workflow Mahallu' },
    admin.token,
  );
  const other = await hit(
    'POST',
    '/platform/organisations',
    201,
    { ...onboardPayload, name: 'Other Mahallu' },
    admin.token,
  );
  const committeeEmail = 'committee@example.test';
  const committee = await signUp(committeeEmail, 'Committee');
  await hit(
    'POST',
    '/platform/organisations/' + tenant.id + '/invitations',
    201,
    { name: 'Committee', email: committeeEmail },
    admin.token,
  );
  await delay(50);
  const invitationMessage = messages.find(
    (message) =>
      message.to === committeeEmail &&
      message.text.includes('/invitations/accept'),
  );
  const invitationToken = invitationMessage?.text.match(
    /[?&]token=([A-Za-z0-9_-]+)/,
  )?.[1];
  assert.ok(invitationToken);
  await hit(
    'POST',
    '/organisations/invitations/accept',
    403,
    { token: invitationToken },
    nextGoogle.token,
  );
  await hit(
    'POST',
    '/organisations/invitations/accept',
    200,
    { token: invitationToken },
    committee.token,
  );
  const base = '/organisations/' + tenant.id + '/programmes';
  await hit('GET', base, 403, undefined, committee.token);
  await hit(
    'PATCH',
    '/platform/organisations/' + tenant.id,
    200,
    { status: 'active' },
    admin.token,
  );
  await hit(
    'PATCH',
    '/platform/organisations/' + other.id,
    200,
    { status: 'active' },
    admin.token,
  );
  const committeeProfile = await hit(
    'GET',
    '/auth/me',
    200,
    undefined,
    committee.token,
  );
  assert.equal(committeeProfile.activeOrganisationId, tenant.id);
  assert.ok(committeeProfile.organisation.roles.includes('org_admin'));
  await hit(
    'GET',
    '/organisations/' + other.id + '/programmes',
    403,
    undefined,
    committee.token,
  );

  const annual = await hit(
    'POST',
    base,
    201,
    { year: 2027, title: 'Annual Smoke Programme' },
    committee.token,
  );
  const programmePath = base + '/' + annual.id;
  const publicPath = '/public/organisations/' + tenant.id + '/programmes/2027';
  await hit('GET', publicPath, 404);
  const start = new Date(Date.now() - 86400_000).toISOString();
  const end = new Date(Date.now() + 86400_000).toISOString();
  const price = { amountMinor: 600, currency: 'INR' };
  await hit(
    'PATCH',
    programmePath,
    200,
    {
      description: 'Workflow sample',
      guidelines: 'Read the requirements',
      publicContact: { email: committeeEmail },
      registrationOpensAt: start,
      registrationClosesAt: end,
      registrationLimit: 10,
      price,
      faqs: [{ question: 'Where?', answer: 'Example Hall' }],
    },
    committee.token,
  );
  await hit(
    'POST',
    programmePath + '/publish',
    200,
    undefined,
    committee.token,
  );
  const publicProgramme = await hit('GET', publicPath, 200);
  assert.equal(publicProgramme.faqs[0].answer, 'Example Hall');
  await hit('GET', '/platform/dashboard', 200, undefined, admin.token);
  await hit(
    'PATCH',
    '/platform/organisations/' + tenant.id + '/features',
    200,
    { enabledFeatures: ['EF-01'] },
    admin.token,
  );
  const features = await hit(
    'GET',
    '/platform/organisations/' + tenant.id + '/features',
    200,
    undefined,
    admin.token,
  );
  assert.deepEqual(features.enabledFeatures, ['EF-01']);
  const options = await hit(
    'PUT',
    programmePath + '/participation-options',
    200,
    {
      items: [{ name: 'One share', price, maxShares: 2 }],
    },
    committee.token,
  );

  const beneficiaryEmail = 'beneficiary@example.test';
  const household = await hit(
    'POST',
    '/organisations/' + tenant.id + '/households',
    201,
    {
      name: 'Recipient Household',
      address: 'Example Road',
      contact: { email: beneficiaryEmail },
    },
    committee.token,
  );
  const applicant = nextGoogle;
  await hit(
    'PUT',
    programmePath + '/me/household',
    200,
    {
      name: 'Applicant Household',
      address: 'Applicant Road',
      contact: {},
    },
    applicant.token,
  );
  const registration = await hit(
    'POST',
    programmePath + '/me/registration',
    201,
    {
      optionId: options.items[0].id,
      shares: 2,
    },
    applicant.token,
  );
  await hit(
    'GET',
    programmePath + '/me/registration',
    404,
    undefined,
    regular.token,
  );
  await hit(
    'POST',
    programmePath + '/registrations/' + registration.id + '/decision',
    200,
    { action: 'approve' },
    committee.token,
  );
  const registrationReceipts = await hit(
    'GET',
    programmePath + '/me/receipts',
    200,
    undefined,
    applicant.token,
  );
  assert.equal(registrationReceipts.items[0].kind, 'registration');
  const notices = await hit(
    'GET',
    programmePath + '/me/notifications',
    200,
    undefined,
    applicant.token,
  );
  assert.equal(notices.items[0].title, 'Registration updated');
  summary.push(
    'Committee onboarding, tenant isolation, publication, household creation and registration review',
  );

  const animal = await hit(
    'POST',
    programmePath + '/animals',
    201,
    { reference: 'animal-1', shareCapacity: 2 },
    committee.token,
  );
  const group = await hit(
    'POST',
    programmePath + '/groups',
    201,
    { name: 'Group A', animalId: animal.id },
    committee.token,
  );
  await hit(
    'POST',
    programmePath + '/share-allocations',
    201,
    { groupId: group.id, registrationId: registration.id, shares: 2 },
    committee.token,
  );
  const workerEmail = 'worker@example.test';
  const worker = await signUp(workerEmail, 'Volunteer');
  const volunteer = await hit(
    'POST',
    programmePath + '/volunteers',
    201,
    {
      name: 'Volunteer',
      email: workerEmail,
      departments: ['finance', 'slaughter', 'processing', 'distribution'],
    },
    committee.token,
  );
  await hit(
    'GET',
    programmePath + '/volunteer/workspace',
    200,
    undefined,
    worker.token,
  );
  const cashTask = await hit(
    'POST',
    programmePath + '/tasks',
    201,
    {
      title: 'Collect cash',
      department: 'finance',
      assigneeId: volunteer.id,
      resourceId: registration.id,
    },
    committee.token,
  );
  const cashPayload = {
    assignmentId: cashTask.id,
    amount: { amountMinor: 1200, currency: 'INR' },
    receivedAt: start,
  };
  const payment = await hit(
    'POST',
    programmePath + '/volunteer/cash-submissions',
    201,
    cashPayload,
    worker.token,
  );
  const retry = await hit(
    'POST',
    programmePath + '/volunteer/cash-submissions',
    201,
    cashPayload,
    worker.token,
  );
  assert.equal(payment.id, retry.id);
  await hit(
    'POST',
    programmePath + '/payments/' + payment.id + '/verification',
    403,
    { action: 'verify' },
    worker.token,
  );
  const verified = await hit(
    'POST',
    programmePath + '/payments/' + payment.id + '/verification',
    200,
    { action: 'verify' },
    committee.token,
  );
  assert.ok(verified.receiptId);
  const payments = await hit(
    'GET',
    programmePath + '/me/payments',
    200,
    undefined,
    applicant.token,
  );
  assert.equal(payments.outstanding.amountMinor, 0);

  const scheduleRequest = {
    animalId: animal.id,
    startsAt: start,
    endsAt: end,
    location: 'Example Hall',
    teamMemberIds: [volunteer.id],
  };
  const slaughter = await hit(
    'POST',
    programmePath + '/schedules',
    201,
    { ...scheduleRequest, department: 'slaughter' },
    committee.token,
  );
  const processing = await hit(
    'POST',
    programmePath + '/schedules',
    201,
    { ...scheduleRequest, department: 'processing' },
    committee.token,
  );
  const progress = (operation, inputs, expected = 200) =>
    hit(
      'POST',
      programmePath + '/volunteer/operations/' + operation.id + '/progress',
      expected,
      inputs,
      worker.token,
    );
  await progress(processing, { status: 'in_progress', stage: 'cutting' }, 409);
  await progress(slaughter, { status: 'in_progress' });
  await progress(slaughter, { status: 'completed' });
  await progress(processing, { status: 'in_progress', stage: 'cutting' });
  await progress(processing, {
    status: 'in_progress',
    stage: 'weighing',
    measuredGrams: 1000,
  });
  await progress(processing, {
    status: 'completed',
    stage: 'packaging',
    packageCount: 2,
  });
  summary.push(
    'Animal allocation, volunteer access, idempotent cash verification and measured processing',
  );

  const beneficiarySession = await signUp(beneficiaryEmail, 'Beneficiary');
  const recipient = await hit(
    'POST',
    programmePath + '/beneficiaries',
    201,
    { householdId: household.id },
    committee.token,
  );
  await hit(
    'POST',
    programmePath + '/beneficiaries/' + recipient.id + '/eligibility',
    200,
    { action: 'approve' },
    committee.token,
  );
  await hit(
    'POST',
    programmePath + '/beneficiaries/' + recipient.id + '/access',
    201,
    undefined,
    committee.token,
  );
  await delay(50);
  const beneficiaryMessage = messages.find(
    (message) =>
      message.to === beneficiaryEmail &&
      message.text.includes('/beneficiary/access'),
  );
  const beneficiaryToken = beneficiaryMessage?.text.match(
    /#token=([a-f0-9]{64})/,
  )?.[1];
  assert.ok(beneficiaryToken);
  await hit(
    'POST',
    programmePath + '/me/beneficiary-access/accept',
    200,
    { token: beneficiaryToken },
    beneficiarySession.token,
  );

  await hit(
    'PUT',
    programmePath + '/distribution/policy',
    200,
    {
      participant: { enabled: true, gramsPerShare: 300 },
      public: {
        enabled: true,
        gramsPerHousehold: 400,
        guidance: 'Bring your collection reference.',
      },
    },
    committee.token,
  );
  const window = await hit(
    'POST',
    programmePath + '/distribution/collection-windows',
    201,
    {
      location: 'Example Hall',
      startsAt: start,
      endsAt: end,
      instructions: 'Use the main entrance.',
    },
    committee.token,
  );
  const distributionPath = programmePath + '/distribution/allocations';
  const allocationInputs = [
    {
      recipientType: 'participant',
      recipientId: registration.id,
      quantityGrams: 600,
    },
    {
      recipientType: 'beneficiary',
      recipientId: recipient.id,
      quantityGrams: 400,
    },
  ];
  for (const input of allocationInputs) {
    const allocation = await hit(
      'POST',
      distributionPath,
      201,
      { ...input, collectionWindowId: window.id },
      committee.token,
    );
    await hit(
      'POST',
      distributionPath + '/' + allocation.id + '/transition',
      200,
      { action: 'confirm' },
      committee.token,
    );
    await hit(
      'POST',
      distributionPath + '/' + allocation.id + '/transition',
      200,
      { action: 'pack' },
      committee.token,
    );
    await hit(
      'POST',
      programmePath + '/tasks',
      201,
      {
        title: 'Hand off package',
        department: 'distribution',
        assigneeId: volunteer.id,
        resourceId: allocation.id,
      },
      committee.token,
    );
    const ownAllocation =
      input.recipientType === 'participant'
        ? (
            await hit(
              'GET',
              programmePath + '/me/participation',
              200,
              undefined,
              applicant.token,
            )
          ).distribution
        : (
            await hit(
              'GET',
              programmePath + '/me/beneficiary/distribution',
              200,
              undefined,
              beneficiarySession.token,
            )
          ).allocation;
    const handoff =
      programmePath +
      '/volunteer/distribution/allocations/' +
      allocation.id +
      '/handoff';
    await hit(
      'POST',
      handoff,
      403,
      { outcome: 'collected', recipientProof: randomUUID() },
      worker.token,
    );
    await hit(
      'POST',
      handoff,
      200,
      {
        outcome: 'collected',
        recipientProof: ownAllocation.collectionReference,
      },
      worker.token,
    );
  }
  const inventory = await hit(
    'GET',
    programmePath + '/distribution/inventory',
    200,
    undefined,
    committee.token,
  );
  assert.deepEqual(inventory, {
    recordedGrams: 1000,
    allocatedGrams: 1000,
    availableGrams: 0,
  });
  const counts = await hit(
    'GET',
    programmePath + '/dashboard',
    200,
    undefined,
    committee.token,
  );
  assert.equal(counts.totalParticipants, 1);
  await hit(
    'GET',
    programmePath + '/reports/financial',
    200,
    undefined,
    committee.token,
  );
  await hit('POST', programmePath + '/close', 200, undefined, committee.token);
  await hit('GET', publicPath, 404);
  await hit(
    'POST',
    programmePath + '/animals',
    409,
    { reference: 'rejected', shareCapacity: 1 },
    committee.token,
  );
  await hit(
    'GET',
    programmePath + '/reports/financial',
    200,
    undefined,
    committee.token,
  );
  summary.push(
    'Verified beneficiary access, stock reservation, private handoff proof, reports and archive',
  );

  for (const item of summary) console.log('PASS ' + item);
} finally {
  await app?.close();
  await prisma?.$disconnect();
  await pool?.end();
  await server.stop();
  await db.close();
}
