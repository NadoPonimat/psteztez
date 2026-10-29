import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const qa = await db.user.findUnique({ where: { username: "testqa" } });
console.log("workdays:", await db.workDay.findMany({ where: { userId: qa!.id } }));
console.log("shifts:", await db.shift.findMany({ where: { userId: qa!.id } }));
console.log("all shifts this week:", await db.shift.findMany({ where: { day: { gte: "2026-10-26", lte: "2026-11-01" } } }));
await db.$disconnect();
