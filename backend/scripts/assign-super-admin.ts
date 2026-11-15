import { PrismaClient, RoleScope } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function run() {
  const user = await prisma.user.findUnique({ where: { email: 'admin@qurbanios.local' } });
  const role = await prisma.role.findFirst({ where: { slug: 'super_admin', scope: RoleScope.GLOBAL } });
  if (user && role) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      create: { userId: user.id, roleId: role.id },
      update: {}
    });
    console.log('Assigned super_admin role to admin@qurbanios.local');
  }
  await prisma.$disconnect();
  await pool.end();
}
run();
