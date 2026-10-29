import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const t = await db.tournament.findFirst({ where: { name: "E2E Double Elim" } });
if (!t) { console.log("not found"); process.exit(0); }
const ms = await db.tournamentMatch.findMany({
  where: { tournamentId: t.id },
  orderBy: [{ bracket: "asc" }, { round: "asc" }, { matchIndex: "asc" }],
});
for (const m of ms) {
  console.log(`${m.bracket.padEnd(5)} R${m.round} M${m.matchIndex} [${m.status}] p1=${m.p1Name ?? "—"} ${m.score1 ?? "-"}:${m.score2 ?? "-"} ${m.p2Name ?? "—"} next=${m.nextMatchId}/${m.nextSlot} lose=${m.losersMatchId}/${m.losersSlot}`);
}
process.exit(0);
