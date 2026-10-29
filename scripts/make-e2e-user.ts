// Создание временного E2E-аккаунта для проверки турнирного режима
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";

const db = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const username = "e2e_tourney";
  const existing = await db.user.findUnique({ where: { username } });
  if (existing) {
    await db.user.delete({ where: { username } });
  }
  await db.user.create({
    data: {
      username,
      passwordHash: hashPassword("e2e12345"),
      name: "QA Турниры",
      role: "ADMIN",
      active: true,
    },
  });
  console.log("OK: e2e_tourney / e2e12345 (ADMIN)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
