const BASE = "http://localhost:3000";
const COOKIES: string[] = [];
async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(COOKIES.length ? { Cookie: COOKIES.join("; ") } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = res.headers.get("set-cookie");
  if (sc) COOKIES.push(sc.split(";")[0]);
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
async function main() {
  await call("POST", "/api/auth/login", { username: "e2e_tourney", password: "e2e12345" });
  const games = (await call("GET", "/api/tournament-games")).data as { games: { id: number; name: string }[] };
  const mk = games.games.find((g) => g.name.includes("Mortal Kombat 1"))!;
  const fc = games.games.find((g) => g.name.includes("EA SPORTS FC 25"))!;

  // Double elim 8 игроков, часть сыграна
  const d = (await call("POST", "/api/tournaments", { name: "EVO PlayZone · MK1", gameId: mk.id, format: "DOUBLE_ELIM", bestOf: 3, entryFee: 1000, prizeFund: 12000 })).data as { tournament: { id: number } };
  for (const name of ["Айдос", "Ерасыл", "Тимур", "Даурен", "Ислам", "Азамат", "Нурлан", "Санжар"])
    await call("POST", `/api/tournaments/${d.tournament.id}/participants`, { name });
  await call("POST", `/api/tournaments/${d.tournament.id}/start`, { shuffle: true });
  let det = (await call("GET", `/api/tournaments/${d.tournament.id}`)).data as any;
  let guard = 0;
  while (guard++ < 20) {
    det = (await call("GET", `/api/tournaments/${d.tournament.id}`)).data;
    const ready = det.matches.find((m: any) => m.status === "READY" && m.bracket !== "GF" && m.bracket !== "GF_RESET" && m.round <= (m.bracket === "UPPER" ? 2 : 2));
    if (!ready) break;
    await call("POST", `/api/tournaments/${d.tournament.id}/matches/${ready.id}`, { score1: 2, score2: ready.matchIndex % 2 });
  }

  // RR 5 игроков, 2 тура сыграно
  const r = (await call("POST", "/api/tournaments", { name: "Чемпионат по EA FC 25", gameId: fc.id, format: "ROUND_ROBIN", entryFee: 1500, prizeFund: 10000, prizeSplit: "70,30" })).data as { tournament: { id: number } };
  for (const name of ["Айдос", "Тимур", "Ислам", "Азамат", "Нурлан"])
    await call("POST", `/api/tournaments/${r.tournament.id}/participants`, { name });
  await call("POST", `/api/tournaments/${r.tournament.id}/start`, { shuffle: true });
  det = (await call("GET", `/api/tournaments/${r.tournament.id}`)).data;
  guard = 0;
  const scores = [[2,1],[0,3],[1,1],[4,2],[2,0],[2,2],[1,0],[3,1],[0,1],[3,0]];
  let i = 0;
  while (guard++ < 20 && i < 6) {
    det = (await call("GET", `/api/tournaments/${r.tournament.id}`)).data;
    const ready = det.matches.find((m: any) => m.status === "READY");
    if (!ready) break;
    const [s1, s2] = scores[i++];
    await call("POST", `/api/tournaments/${r.tournament.id}/matches/${ready.id}`, { score1: s1, score2: s2 });
  }
  console.log("OK: demo tournaments created, ids:", d.tournament.id, r.tournament.id);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
