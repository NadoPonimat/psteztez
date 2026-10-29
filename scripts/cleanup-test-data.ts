// Очистка тестовых данных: сеансы и тестовый пакет
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const sessions = await prisma.session.deleteMany({});
  console.log(`✓ Удалено тестовых сеансов: ${sessions.count}`);
  const removed = await prisma.package.deleteMany({
    where: { name: "Тест 1 мин" },
  });
  console.log(`✓ Удалено тестовых пакетов: ${removed.count}`);
  const pkgs = await prisma.package.findMany({ select: { name: true, deviceType: true } });
  console.log("Оставшиеся пакеты:", JSON.stringify(pkgs));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
