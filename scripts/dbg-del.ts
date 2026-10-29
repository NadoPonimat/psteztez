import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const t = await db.tournament.findFirst({ where: { name: "E2E Double Elim" } });
if (t) { await db.tournament.delete({ where: { id: t.id } }); console.log("deleted", t.id); }
else console.log("none");
process.exit(0);
