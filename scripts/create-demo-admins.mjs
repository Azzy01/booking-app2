import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
const prisma = new PrismaClient({ adapter });

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const digest = crypto
    .scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })
    .toString("hex");
  return `s2$${salt}$${digest}`;
}

async function upsertUser({ name, login, email, phone, password }) {
  const passwordHash = hashPassword(password);

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ login }, { email }, { phone }],
    },
  });

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        name,
        login,
        email,
        phone,
        status: "ACTIVE",
        passwordHash,
      },
    });
  }

  return prisma.user.create({
    data: {
      name,
      login,
      email,
      phone,
      status: "ACTIVE",
      passwordHash,
    },
  });
}

async function upsertMembership({ userId, clubId, role }) {
  const existing = await prisma.clubMembership.findFirst({
    where: { userId, clubId },
  });

  if (existing) {
    return prisma.clubMembership.update({
      where: { id: existing.id },
      data: {
        role,
        status: "ACTIVE",
      },
    });
  }

  return prisma.clubMembership.create({
    data: {
      userId,
      clubId,
      role,
      status: "ACTIVE",
    },
  });
}

async function upsertPlatformAdmin(userId) {
  try {
    const existing = await prisma.platformAdminUser.findFirst({
      where: { userId },
    });

    if (existing) {
      return prisma.platformAdminUser.update({
        where: { id: existing.id },
        data: {
          role: "PLATFORM_ADMIN",
          status: "ACTIVE",
        },
      });
    }

    return prisma.platformAdminUser.create({
      data: {
        userId,
        role: "PLATFORM_ADMIN",
        status: "ACTIVE",
      },
    });
  } catch (error) {
    console.log("Platform admin skipped:", error.message);
  }
}

async function main() {
  const club = await prisma.club.findFirst();

  if (!club) {
    throw new Error("В базе нет клуба. Сначала создай хотя бы один club.");
  }

  const password = "12345678";

  const hostAdmin = await upsertUser({
    name: "Host Admin",
    login: "host_admin",
    email: "host_admin@example.com",
    phone: "+77010000002",
    password,
  });

  const clubOwner = await upsertUser({
    name: "Club Owner",
    login: "club_owner",
    email: "club_owner@example.com",
    phone: "+77010000003",
    password,
  });

  const systemOwner = await upsertUser({
    name: "System Owner",
    login: "system_owner",
    email: "system_owner@example.com",
    phone: "+77010000004",
    password,
  });

  await upsertMembership({
    userId: hostAdmin.id,
    clubId: club.id,
    role: "HOST_ADMIN",
  });

  await upsertMembership({
    userId: clubOwner.id,
    clubId: club.id,
    role: "TECH_ADMIN",
  });

  await upsertMembership({
    userId: systemOwner.id,
    clubId: club.id,
    role: "TECH_ADMIN",
  });

  await upsertPlatformAdmin(systemOwner.id);

  console.log("Готово:");
  console.log("host_admin / 12345678");
  console.log("club_owner / 12345678");
  console.log("system_owner / 12345678");
}

main()
  .catch((error) => {
    console.error("Ошибка:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
