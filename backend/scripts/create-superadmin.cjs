const { Client } = require('pg');
const argon2 = require('argon2');
const crypto = require('crypto');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@localhost:51214/auth_dev?sslmode=disable',
  });

  await client.connect();
  console.log('Connected to PostgreSQL on 51214.');

  const email = 'muhammedparad0485@gmail.com';
  const plainPassword = 'mohd@123';
  const name = 'Muhammed Parad';
  const firstName = 'Muhammed';
  const lastName = 'Parad';

  console.log(`Hashing password with Argon2id...`);
  const passwordHash = await argon2.hash(plainPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  // 1. Get or create super_admin role
  let roleRes = await client.query(`SELECT id FROM roles WHERE slug = 'super_admin' LIMIT 1`);
  let roleId;
  if (roleRes.rows.length === 0) {
    roleId = crypto.randomUUID();
    await client.query(
      `INSERT INTO roles (id, name, slug, description, scope, is_system, created_at, updated_at)
       VALUES ($1, 'Super Admin', 'super_admin', 'Platform super administrator', 'GLOBAL', true, NOW(), NOW())`,
      [roleId]
    );
    console.log(`Created super_admin role with id: ${roleId}`);
  } else {
    roleId = roleRes.rows[0].id;
    console.log(`Found super_admin role with id: ${roleId}`);
  }

  // 2. Check if user already exists
  let userRes = await client.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [email]);
  let userId;
  if (userRes.rows.length === 0) {
    userId = crypto.randomUUID();
    await client.query(
      `INSERT INTO users (id, email, name, first_name, last_name, password_hash, status, email_verified_at, email_verification_exempt, token_version, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', NOW(), true, 1, NOW(), NOW())`,
      [userId, email, name, firstName, lastName, passwordHash]
    );
    console.log(`Created user ${email} with id: ${userId}`);
  } else {
    userId = userRes.rows[0].id;
    await client.query(
      `UPDATE users 
       SET name = $1, first_name = $2, last_name = $3, password_hash = $4, status = 'ACTIVE', email_verified_at = NOW(), email_verification_exempt = true, updated_at = NOW()
       WHERE id = $5`,
      [name, firstName, lastName, passwordHash, userId]
    );
    console.log(`Updated user ${email} (id: ${userId}) with new password and ACTIVE status`);
  }

  // 3. Link user_roles
  await client.query(
    `INSERT INTO user_roles (id, user_id, role_id, created_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id, role_id) DO NOTHING`,
    [crypto.randomUUID(), userId, roleId]
  );
  console.log(`Linked user ${userId} to super_admin role ${roleId}`);

  // 4. Verify user record
  const verifyRes = await client.query(
    `SELECT u.id, u.email, u.name, u.status, u.email_verified_at, r.slug as role
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE u.email = $1`,
    [email]
  );
  console.log('Verified superadmin record:', verifyRes.rows);

  await client.end();
  console.log('SUCCESS: Superadmin user muhammedparad0485@gmail.com is ready!');
}

main().catch((err) => {
  console.error('Error creating superadmin:', err);
  process.exit(1);
});
