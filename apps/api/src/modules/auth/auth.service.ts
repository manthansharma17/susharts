import { prisma } from '@susharts/db';

interface SyncUserInput {
  firebaseUid: string;
  email: string;
  displayName?: string | undefined;
  photoUrl?: string | undefined;
}

export async function syncUser(input: SyncUserInput) {
  const { firebaseUid, email, displayName, photoUrl } = input;

  const user = await prisma.user.upsert({
    where: { firebaseUid },
    update: {
      email,
      displayName: displayName ?? null,
      photoUrl: photoUrl ?? null,
      lastLoginAt: new Date(),
    },
    create: {
      firebaseUid,
      email,
      displayName: displayName ?? null,
      photoUrl: photoUrl ?? null,
      role: 'CUSTOMER',
      lastLoginAt: new Date(),
    },
  });

  return user;
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}
