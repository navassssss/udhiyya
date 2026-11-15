import { PrismaClient } from '../src/generated/prisma/index.js';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const email = 'muhammedparad0485@gmail.com';
  const plainPassword = 'mohd@123';
  const name = 'Muhammed Parad';

  console.log(`Hashing password for ${email}...`);
  const passwordHash = await argon2.hash(plainPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  console.log('Finding or creating super_admin role...');
  let role = await prisma.role.findFirst({
    where: { slug: 'super_admin' },
  });

  if (!role) {
    role = await prisma.role.create({
      data: {
        name: 'Super Admin',
        slug: 'super_admin',
        description: 'Global platform super administrator',
        scope: 'GLOBAL',
        isSystem: true,
      },
    });
    console.log(`Created super_admin role: ${role.id}`);
  } else {
    console.log(`Found super_admin role: ${role.id}`);
  }

  console.log(`Upserting superadmin user ${email}...`);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      firstName: 'Muhammed',
      lastName: 'Parad',
      passwordHash,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      emailVerificationExempt: true,
    },
    create: {
      email,
      name,
      firstName: 'Muhammed',
      lastName: 'Parad',
      passwordHash,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      emailVerificationExempt: true,
    },
  });

  console.log(`User ID: ${user.id}`);

  // Link UserRole
  const userRole = await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: role.id,
    },
  });

  console.log(`Linked super_admin role to user: ${userRole.id}`);
  console.log('SUCCESS: Superadmin user ready.');
}

main()
  .catch((err) => {
    console.error('Failed to create superadmin:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
