// Создаёт главного администратора (admin / admin), если его ещё нет.
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const exists = await prisma.user.findUnique({ where: { username: "admin" } });
  if (!exists) {
    await prisma.user.create({
      data: {
        username: "admin",
        passwordHash: hashPassword("admin"),
        name: "Главный администратор",
        role: "ADMIN",
      },
    });
    console.log("Создан аккаунт: admin / admin");
  } else {
    console.log("Аккаунт admin уже есть");
  }
}

main().finally(() => prisma.$disconnect());
