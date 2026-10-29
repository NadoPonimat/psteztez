// E2E: круговая система (очки/таблица) + откат результата в олимпийской сетке
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

type Det = {
  participants: { id: number; name: string; points: number; wins: number; draws: number; losses: number; diff: number; place: number | null }[];
  matches: { id: number; bracket: string; round: number; matchIndex: number; p1Name: string | null; p2Name: string | null; status: string; score1: number | null; score2: number | null }[];
};

async function main() {
  const login = await call("POST", "/api/auth/login", { username: "e2e_tourney", password: "e2e12345" });
  if (login.status !== 200) throw new Error("login failed");

  const games = (await call("GET", "/api/tournament-games")).data as { games: { id: number }[] };
  const gid = games.games[0].id;

  // ==== ROUND ROBIN: 4 игрока ====
  const t = (await call("POST", "/api/tournaments", {
    name: "E2E RR", gameId: gid, format: "ROUND_ROBIN", entryFee: 500, prizeFund: 2000, prizeSplit: "70,30",
  })).data as { tournament: { id: number } };
  const tid = t.tournament.id;

  const names = ["Ая", "Берик", "Вита", "Гриша"];
  for (const name of names) await call("POST", `/api/tournaments/${tid}/participants`, { name });
  const st = await call("POST", `/api/tournaments/${tid}/start`, { shuffle: false });
  if (st.status !== 200) throw new Error("RR start: " + JSON.stringify(st.data));

  let d = (await call("GET", `/api/tournaments/${tid}`)).data as Det;
  const rr = d.matches;
  console.log(`RR матчей: ${rr.length} (ожидается 6), туров: ${new Set(rr.map((m) => m.round)).size}`);

  // Счёт: все матчи по сценарию
  const scores: [number, number][] = [
    [2, 1], [1, 1], [3, 0], // тур 1
    [0, 2], [2, 2], [1, 0], // тур 2
  ];
  let i = 0;
  for (const m of rr.sort((a, b) => a.round - b.round || a.matchIndex - b.matchIndex)) {
    const [s1, s2] = scores[i++];
    const r = await call("POST", `/api/tournaments/${tid}/matches/${m.id}`, { score1: s1, score2: s2 });
    if (r.status !== 200) throw new Error("RR report: " + JSON.stringify(r.data));
  }
  d = (await call("GET", `/api/tournaments/${tid}`)).data as Det;
  console.log("Таблица после 6 матчей:");
  for (const p of [...d.participants].sort((a, b) => b.points - a.points))
    console.log(`  ${p.name}: ${p.points} очков (В${p.wins} Н${p.draws} П${p.losses}, ±${p.diff})`);

  // Проверка очков: Ая: 3+1+0=4? Считаем вручную ниже в логе
  // Меняем один результат (откат): Ая 2:1 → 0:5
  const first = rr.slice().sort((a, b) => a.round - b.round || a.matchIndex - b.matchIndex)[0];
  await call("POST", `/api/tournaments/${tid}/matches/${first.id}`, { score1: 0, score2: 5 });
  d = (await call("GET", `/api/tournaments/${tid}`)).data as Det;
  console.log("После изменения 1-го результата на 0:5:");
  for (const p of [...d.participants].sort((a, b) => b.points - a.points))
    console.log(`  ${p.name}: ${p.points} очков (В${p.wins} Н${p.draws} П${p.losses}, ±${p.diff})`);

  const fin = await call("POST", `/api/tournaments/${tid}/finish`);
  console.log("RR Finish:", JSON.stringify(fin.data));
  await call("DELETE", `/api/tournaments/${tid}`);

  // ==== Откат в сетке: single elim 4 игрока ====
  const t2 = (await call("POST", "/api/tournaments", {
    name: "E2E Rollback", gameId: gid, format: "SINGLE_ELIM", bestOf: 1,
  })).data as { tournament: { id: number } };
  const tid2 = t2.tournament.id;
  for (const name of ["Р1", "Р2", "Р3", "Р4"]) await call("POST", `/api/tournaments/${tid2}/participants`, { name });
  await call("POST", `/api/tournaments/${tid2}/start`, { shuffle: false });
  let d2 = (await call("GET", `/api/tournaments/${tid2}`)).data as Det;
  const semi = d2.matches.filter((m) => m.round === 1);
  // Полуфиналы: Р1>Р2, Р3>Р4 → финал Р1 vs Р3, играем его
  await call("POST", `/api/tournaments/${tid2}/matches/${semi[0].id}`, { score1: 1, score2: 0 });
  await call("POST", `/api/tournaments/${tid2}/matches/${semi[1].id}`, { score1: 1, score2: 0 });
  d2 = (await call("GET", `/api/tournaments/${tid2}`)).data as Det;
  const finalM = d2.matches.find((m) => m.round === 2)!;
  await call("POST", `/api/tournaments/${tid2}/matches/${finalM.id}`, { score1: 1, score2: 0 });
  d2 = (await call("GET", `/api/tournaments/${tid2}`)).data as Det;
  const fin2 = d2.matches.find((m) => m.round === 2)!;
  console.log(`Финал сыгран: ${fin2.p1Name} ${fin2.score1}:${fin2.score2} ${fin2.p2Name}`);

  // Откат полуфинала → финал должен очиститься
  await call("POST", `/api/tournaments/${tid2}/matches/${semi[0].id}`, { score1: null, score2: null });
  d2 = (await call("GET", `/api/tournaments/${tid2}`)).data as Det;
  const finAfter = d2.matches.find((m) => m.round === 2)!;
  const semi0After = d2.matches.find((m) => m.id === semi[0].id)!;
  console.log(`После отката полуфинала: полу=[${semi0After.status} ${semi0After.p1Name}-${semi0After.p2Name}], финал=[${finAfter.status} ${finAfter.p1Name ?? "—"}-${finAfter.p2Name ?? "—"}]`);
  // Слот 1 финала очищен (откатный полуфинал), слот 2 (из другого полуфинала) остаётся
  if (finAfter.status !== "PENDING" || finAfter.p1Name !== null || finAfter.p2Name !== "Р2")
    throw new Error("Откат не очистил слот финала!");
  console.log("OK: откат полуфинала корректно очистил финал");
  await call("DELETE", `/api/tournaments/${tid2}`);
  console.log("DONE");
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
