import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

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

async function seedCalls() {
  // Check if calls already exist
  const existingCalls = await prisma.call.count();
  if (existingCalls > 0) {
    console.log(`${existingCalls} calls already exist, skipping call seed`);
    return;
  }

  const scammerPhrases = [
    "Hello, this is Microsoft Tech Support. Your computer has a virus.",
    "We've detected suspicious activity on your account.",
    "You've won a free cruise! Just need your credit card for the booking fee.",
    "This is the IRS. You owe back taxes and must pay immediately.",
    "Your Social Security number has been compromised.",
    "We're calling about your car's extended warranty.",
    "This is Amazon. There's a problem with your recent order.",
    "Your grandson is in jail and needs bail money.",
  ];

  const earlPhrases = [
    "What's that now? You'll have to speak up, sonny.",
    "Oh my, that reminds me of the time I fixed Elvis's refrigerator back in '72.",
    "Hold on, I need to find my reading glasses. Have you seen my reading glasses?",
    "General Patton - that's my parakeet - he's been acting up lately.",
    "Back in Tulsa, we never had these computer doohickeys.",
    "My late wife Mildred always said I was too trusting. God rest her soul.",
    "Now which button do I press? The red one or the blue one?",
    "Oh dear, I think I left the stove on. Can you hold for just a moment?",
    "You know, you sound just like my nephew Gerald. Are you Gerald?",
    "I'm sorry, what company did you say you were from again?",
  ];

  const calls = [
    // Completed calls with various durations and ratings
    { status: 'COMPLETED', duration: 1847, rating: 5, tags: ['epic', 'confused'], daysAgo: 1 },
    { status: 'COMPLETED', duration: 923, rating: 4, tags: ['funny'], daysAgo: 2 },
    { status: 'COMPLETED', duration: 654, rating: 3, tags: ['tech-support'], daysAgo: 3 },
    { status: 'COMPLETED', duration: 1205, rating: 5, tags: ['irs-scam', 'epic'], daysAgo: 4 },
    { status: 'COMPLETED', duration: 432, rating: 2, tags: [], daysAgo: 5 },
    { status: 'COMPLETED', duration: 789, rating: 4, tags: ['warranty'], daysAgo: 6 },
    { status: 'COMPLETED', duration: 1567, rating: 5, tags: ['epic', 'elvis-story'], daysAgo: 7 },
    { status: 'COMPLETED', duration: 234, rating: 2, tags: [], daysAgo: 8 },
    { status: 'COMPLETED', duration: 876, rating: 3, tags: ['amazon'], daysAgo: 10 },
    { status: 'COMPLETED', duration: 1432, rating: 4, tags: ['grandparent-scam'], daysAgo: 12 },
    // More recent calls
    { status: 'COMPLETED', duration: 567, rating: 3, tags: ['crypto'], daysAgo: 0 },
    { status: 'COMPLETED', duration: 2103, rating: 5, tags: ['epic', 'longest'], daysAgo: 0 },
    // Other statuses
    { status: 'FAILED', duration: null, rating: null, tags: [], daysAgo: 1 },
    { status: 'NO_ANSWER', duration: null, rating: null, tags: [], daysAgo: 2 },
    { status: 'NO_ANSWER', duration: null, rating: null, tags: [], daysAgo: 5 },
    { status: 'IN_PROGRESS', duration: null, rating: null, tags: [], daysAgo: 0 },
  ];

  const phoneNumbers = [
    '+12125551234', '+13105559876', '+14155551111', '+17185552222',
    '+12025553333', '+13125554444', '+14045555555', '+15035556666',
    '+16175557777', '+12065558888', '+18185559999', '+19175550000',
    '+14155551212', '+12125559090', '+13105558080', '+17325557070',
  ];

  console.log('Seeding test calls...');

  for (let i = 0; i < calls.length; i++) {
    const callData = calls[i];
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - callData.daysAgo);
    createdAt.setHours(Math.floor(Math.random() * 12) + 8); // 8am - 8pm
    createdAt.setMinutes(Math.floor(Math.random() * 60));

    const call = await prisma.call.create({
      data: {
        twilioSid: `CA${Date.now()}${Math.random().toString(36).substring(2, 15)}`,
        fromNumber: phoneNumbers[i % phoneNumbers.length],
        toNumber: process.env.TWILIO_PHONE_NUMBER || '+18005551234',
        status: callData.status as 'COMPLETED' | 'FAILED' | 'NO_ANSWER' | 'IN_PROGRESS' | 'RINGING',
        duration: callData.duration,
        rating: callData.rating,
        tags: callData.tags,
        notes: callData.rating === 5 ? 'Earl was in top form!' : null,
        createdAt,
        updatedAt: createdAt,
      },
    });

    // Add transcript segments for completed calls
    if (callData.status === 'COMPLETED' && callData.duration) {
      const segmentCount = Math.min(Math.floor(callData.duration / 30), 20);
      for (let j = 0; j < segmentCount; j++) {
        const isScammer = j % 2 === 0;
        await prisma.callSegment.create({
          data: {
            callId: call.id,
            speaker: isScammer ? 'SCAMMER' : 'EARL',
            text: isScammer
              ? scammerPhrases[Math.floor(Math.random() * scammerPhrases.length)]
              : earlPhrases[Math.floor(Math.random() * earlPhrases.length)],
            timestamp: j * 30 + Math.floor(Math.random() * 15),
          },
        });
      }
    }

    console.log(`  Created call ${i + 1}/${calls.length}: ${callData.status} (${callData.duration ? callData.duration + 's' : 'no duration'})`);
  }

  console.log(`Created ${calls.length} test calls with transcripts`);
}

main()
  .then(() => seedCalls())
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
