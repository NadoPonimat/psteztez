// E2E API-тест двухсеточного турнира (double elimination) со сбросом гранд-финала
const BASE = "http://localhost:3000";
const COOKIES: string[] = [];

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(COOKIES.length ? { Cookie: COOKIES.join("; ") } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) COOKIES.push(setCookie.split(";")[0]);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  // 1. Логин
  const login = await call("POST", "/api/auth/login", {
    username: "e2e_tourney",
    password: "e2e12345",
  });
  if (login.status !== 200) throw new Error("login failed: " + JSON.stringify(login));

  // 2. Каталог игр
  const games = await call("GET", "/api/tournament-games");
  const game = (games.data as { games: { id: number; name: string }[] }).games[0];
  if (!game) throw new Error("нет игр в каталоге");

  // 3. Создание double-elim на 6 человек
  const created = await call("POST", "/api/tournaments", {
    name: "E2E Double Elim",
    gameId: game.id,
    format: "DOUBLE_ELIM",
    bestOf: 1,
    entryFee: 0,
    prizeFund: 0,
  });
  if (created.status !== 200) throw new Error("create failed: " + JSON.stringify(created.data));
  const tid = (created.data as { tournament: { id: number } }).tournament.id;

  // 4. Участники: 6
  const names = ["ИгрокА", "ИгрокБ", "ИгрокВ", "ИгрокГ", "ИгрокД", "ИгрокЕ"];
  const pids: number[] = [];
  for (const name of names) {
    const p = await call("POST", `/api/tournaments/${tid}/participants`, { name });
    pids.push((p.data as { participant: { id: number } }).participant.id);
  }

  // 5. Старт без жребия (порядок = список)
  const started = await call("POST", `/api/tournaments/${tid}/start`, { shuffle: false });
  if (started.status !== 200) throw new Error("start failed: " + JSON.stringify(started.data));

  // 6. Читаем сетку
  let detail = (await call("GET", `/api/tournaments/${tid}`)).data as {
    matches: {
      id: number; bracket: string; round: number; matchIndex: number;
      p1Name: string | null; p2Name: string | null; status: string; roundLabel: string;
    }[];
    participants: { name: string; eliminated: boolean }[];
  };
  const m = detail.matches;
  const ub = m.filter((x) => x.bracket === "UPPER");
  const lb = m.filter((x) => x.bracket === "LOWER");
  const gf = m.filter((x) => x.bracket === "GF");
  console.log(`UB matches: ${ub.length} (раунды: ${[...new Set(ub.map(x => x.round))].join(",")})`);
  console.log(`LB matches: ${lb.length} (раунды: ${[...new Set(lb.map(x => x.round))].join(",")})`);
  console.log(`GF: ${gf.length}; всего: ${m.length}`);
  console.log(`R1: ${ub.filter(x => x.round === 1).map(x => `${x.p1Name}-${x.p2Name ?? "бай"}${x.status === "DONE" ? "(бай)" : ""}`).join(", ")}`);
  const lbR1 = lb.filter(x => x.round === 1);
  console.log(`LB R1: ${lbR1.map(x => `${x.p1Name ?? "?"}-${x.p2Name ?? "?"}`).join(", ")}`);

  // 7. Играбельная функция: сыграть все готовые матчи по счёту из скрипта
  const script: Record<string, [number, number]> = {
    // (bracket, round, matchIndex)
  };
  let guard = 0;
  while (guard++ < 60) {
    detail = (await call("GET", `/api/tournaments/${tid}`)).data;
    const ready = detail.matches.find((x) => x.status === "READY" && !x.bracket.startsWith("GF"));
    if (!ready) break;
    // победитель — p1 (детерминированно), кроме специально заданных
    const key = `${ready.bracket}:${ready.round}:${ready.matchIndex}`;
    const [s1, s2] = script[key] ?? [1, 0];
    const res = await call("POST", `/api/tournaments/${tid}/matches/${ready.id}`, {
      score1: s1, score2: s2,
    });
    if (res.status !== 200) throw new Error(`report ${key} failed: ` + JSON.stringify(res.data));
  }
  console.log(`Сыграно низ сетки до GF за ${guard} итераций`);

  // 8. GF: нижняя сетка должна выиграть → нужен сброс. В моём цикле GF исключён.
  detail = (await call("GET", `/api/tournaments/${tid}`)).data;
  const gfMatch = detail.matches.find((x) => x.bracket === "GF");
  if (!gfMatch || gfMatch.status !== "READY") throw new Error("GF не готов");
  console.log(`GF: ${gfMatch.p1Name} (upper) vs ${gfMatch.p2Name} (lower)`);

  // Нижняя выигрывает 1:0 → должен создаться GF_RESET
  const r1 = await call("POST", `/api/tournaments/${tid}/matches/${gfMatch.id}`, { score1: 0, score2: 1 });
  console.log("GF #1:", (r1.data as { message?: string }).message);
  detail = (await call("GET", `/api/tournaments/${tid}`)).data;
  const reset = detail.matches.find((x) => x.bracket === "GF_RESET");
  if (!reset) throw new Error("GF_RESET не создан!");
  console.log(`GF_RESET создан: ${reset.p1Name} vs ${reset.p2Name}, статус ${reset.status}`);

  // 9. Сброс: upper берёт реванш 1:0 → чемпион
  const r2 = await call("POST", `/api/tournaments/${tid}/matches/${reset.id}`, { score1: 1, score2: 0 });
  console.log("GF_RESET:", (r2.data as { message?: string }).message);

  // 10. Финиш
  const fin = await call("POST", `/api/tournaments/${tid}/finish`);
  console.log("Finish:", JSON.stringify(fin.data));
  detail = (await call("GET", `/api/tournaments/${tid}`)).data;
  const places = detail.participants
    .map((p) => ({ n: p.name, place: (detail.matches.length, p as unknown as { place: number | null }).place }))
    .sort((a, b) => (a.place ?? 99) - (b.place ?? 99));
  console.log("Места:", places.map((p) => `${p.n}:${p.place ?? "-"}`).join(", "));

  // 11. Удаление тестового турнира
  const del = await call("DELETE", `/api/tournaments/${tid}`);
  console.log("Delete:", del.status);
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
