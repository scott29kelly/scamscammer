import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@scamscrammer.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'changeme123';

  // Check if admin user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingUser) {
    console.log(`Admin user already exists: ${adminEmail}`);
    return;
  }

  // Create admin user
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const user = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      name: 'Admin',
      role: 'ADMIN',
    },
  });

  console.log(`Created admin user: ${user.email}`);
  console.log('IMPORTANT: Change the default password immediately!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
