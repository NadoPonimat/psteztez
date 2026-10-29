import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const users = await db.user.findMany({ select: { id: true, username: true, name: true, role: true, theme: true, alarmSound: true, dailyRate: true, bonusPercent: true, bonusThreshold: true } });
console.log(JSON.stringify({ users, devices: await db.device.findMany({ select: { id: true, type: true, number: true } }), sessions: await db.session.findMany({ orderBy: { id: "desc" }, take: 3, select: { id: true, deviceId: true, status: true, price: true, paymentMethod: true } }), entries: await db.cashEntry.findMany({ orderBy: { id: "desc" }, take: 5 }) }, null, 1));
await db.$disconnect();
