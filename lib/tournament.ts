// ==== Турнирный движок ====
// Форматы как на настоящих официальных турнирах (EVO, EA Sports FC Pro и т.п.):
//  - SINGLE_ELIM  — олимпийская система (на вылет), посев, «bays», матч за 3-е место
//  - DOUBLE_ELIM  — двухсеточная (upper/lower bracket + гранд-финал + сброс)
//  - ROUND_ROBIN  — круговая система (каждый с каждым), очки 3/1/0

export type TournamentFormat = "SINGLE_ELIM" | "DOUBLE_ELIM" | "ROUND_ROBIN";

export const FORMAT_LABELS: Record<string, string> = {
  SINGLE_ELIM: "Олимпийская система (на вылет)",
  DOUBLE_ELIM: "Двухсеточная (double elimination)",
  ROUND_ROBIN: "Круговая (каждый с каждым)",
};

export const FORMAT_SHORT: Record<string, string> = {
  SINGLE_ELIM: "На вылет",
  DOUBLE_ELIM: "Double elim",
  ROUND_ROBIN: "Круговая",
};

export const FORMAT_HINTS: Record<string, string> = {
  SINGLE_ELIM:
    "Классика EVO и кубков: проиграл — вылетел. Быстро (log₂ раундов), драматично. Матч за 3-е место — по желанию.",
  DOUBLE_ELIM:
    "Формат EVO для файтингов: у каждого право на одно поражение. Проигравшие верхней сетки падают в нижнюю и пробиваются обратно в гранд-финал.",
  ROUND_ROBIN:
    "Как чемпионат мира по футболу: каждый играет с каждым, очки (победа 3 / ничья 1 / поражение 0). Итог — таблица standings.",
};

/** Скольких побед достаточно в матче: Bo1→1, Bo3→2, Bo5→3 */
export function winsNeeded(bestOf: number): number {
  return Math.max(1, Math.ceil(bestOf / 2));
}

/** Следующая степень двойки (2 → 2, 5 → 8) */
export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return Math.max(2, p);
}

/**
 * Классический посев (как в теннисе/FIFA): для size=8 → [1,8,4,5,2,7,3,6].
 * Возвращает номера посевов (1-based) по слотам первой сетки.
 */
export function seedOrder(size: number): number[] {
  let arr = [1, 2];
  while (arr.length < size) {
    const n = arr.length * 2 + 1;
    const next: number[] = [];
    for (const x of arr) {
      next.push(x);
      next.push(n - x);
    }
    arr = next;
  }
  return arr.slice(0, size);
}

export type Bracket = "UPPER" | "LOWER" | "GF" | "GF_RESET" | "THIRD" | "RR";
export type GenRef = { bracket: Bracket; round: number; matchIndex: number };

export type GenMatch = {
  bracket: Bracket;
  round: number;
  matchIndex: number;
  p1Seed: number | null; // индекс участника в слоте 1 (null = пусто/бай)
  p2Seed: number | null;
  nextRef: GenRef | null; // куда идёт победитель
  nextSlot: number | null;
  losersRef: GenRef | null; // куда падает проигравший (UPPER)
  losersSlot: number | null;
};

type SeedSlot = { seed: number | null; participantIndex: number | null };

/** Раскладка участников по слотам первой сетки с учётом баёв */
export function distributeSeeds(
  participants: { id: number; seed: number }[],
  size: number
): SeedSlot[] {
  // Фактические посевы: явные (seed > 0) сохраняют место, остальные получают
  // номера по порядку регистрации.
  const sorted = participants
    .map((p, i) => ({ ...p, order: i }))
    .sort((a, b) => {
      const sa = a.seed > 0 ? a.seed : Number.MAX_SAFE_INTEGER;
      const sb = b.seed > 0 ? b.seed : Number.MAX_SAFE_INTEGER;
      return sa - sb || a.order - b.order;
    });
  const bySeed = new Map<number, number>(); // seed → index в participants
  let auto = 0;
  for (const p of sorted) {
    let s = p.seed > 0 ? p.seed : ++auto;
    while (bySeed.has(s)) s = ++auto; // защита от дублей
    bySeed.set(s, p.order);
  }
  const order = seedOrder(size);
  return order.map((seed) => ({
    seed,
    participantIndex: bySeed.get(seed) ?? null,
  }));
}

/** Олимпийская система: раунды, байи, опциональный матч за 3-е место */
export function generateSingleElim(
  participantCount: number,
  thirdPlace: boolean
): GenMatch[] {
  const size = nextPow2(participantCount);
  const slots = distributeSeeds(
    Array.from({ length: participantCount }, (_, i) => ({ id: i, seed: 0 })),
    size
  );
  const k = Math.log2(size);
  const matches: GenMatch[] = [];

  for (let r = 1; r <= k; r++) {
    const count = size / 2 ** r;
    for (let m = 0; m < count; m++) {
      const isLast = r === k;
      const isSemi = thirdPlace && r === k - 1; // проигравшие в полуфинале → матч за 3-е
      matches.push({
        bracket: "UPPER",
        round: r,
        matchIndex: m,
        p1Seed: r === 1 ? slots[m * 2].participantIndex : null,
        p2Seed: r === 1 ? slots[m * 2 + 1].participantIndex : null,
        nextRef: isLast ? null : { bracket: "UPPER", round: r + 1, matchIndex: Math.floor(m / 2) },
        nextSlot: isLast ? null : (m % 2 === 0 ? 1 : 2),
        losersRef: isSemi ? { bracket: "THIRD", round: 1, matchIndex: 0 } : null,
        losersSlot: isSemi ? m + 1 : null,
      });
    }
  }

  // Полуфинальные проигравшие → матч за 3-е место
  if (thirdPlace && k >= 2) {
    matches.push({
      bracket: "THIRD",
      round: 1,
      matchIndex: 0,
      p1Seed: null,
      p2Seed: null,
      nextRef: null,
      nextSlot: null,
      losersRef: null,
      losersSlot: null,
    });
  }
  return matches;
}

/** Двухсеточная: upper + lower + гранд-финал (сброс генерируется динамически) */
export function generateDoubleElim(participantCount: number): GenMatch[] {
  const size = nextPow2(participantCount);
  const slots = distributeSeeds(
    Array.from({ length: participantCount }, (_, i) => ({ id: i, seed: 0 })),
    size
  );
  const k = Math.log2(size);
  const lbRounds = 2 * (k - 1);
  const matches: GenMatch[] = [];

  // Верхняя сетка
  for (let r = 1; r <= k; r++) {
    const count = size / 2 ** r;
    for (let m = 0; m < count; m++) {
      const isLast = r === k;
      // Проигравшие: R1 → LB R1 (парный раунд); r≥2 → LB round 2r-2, тот же индекс;
      // финал UB → LB-финал (последний раунд LB); 2 игрока — сразу в гранд-финал.
      let losersRef: GenMatch["losersRef"] = null;
      let losersSlot: number | null = null;
      if (r === 1 && lbRounds >= 1) {
        losersRef = { bracket: "LOWER", round: 1, matchIndex: Math.floor(m / 2) };
        losersSlot = (m % 2) + 1;
      } else if (r >= 2 && !isLast) {
        const lbRound = Math.min(2 * r - 2, lbRounds);
        losersRef = { bracket: "LOWER", round: lbRound, matchIndex: m };
        losersSlot = 1;
      } else if (isLast && lbRounds >= 1) {
        losersRef = { bracket: "LOWER", round: lbRounds, matchIndex: 0 };
        losersSlot = 1;
      } else if (isLast && lbRounds === 0) {
        losersRef = { bracket: "GF", round: 1, matchIndex: 0 };
        losersSlot = 2;
      }
      matches.push({
        bracket: "UPPER",
        round: r,
        matchIndex: m,
        p1Seed: r === 1 ? slots[m * 2].participantIndex : null,
        p2Seed: r === 1 ? slots[m * 2 + 1].participantIndex : null,
        nextRef: { bracket: "GF", round: 1, matchIndex: 0 },
        nextSlot: isLast ? 1 : m % 2 === 0 ? 1 : 2,
        losersRef,
        losersSlot,
      });
      if (!isLast) {
        matches[matches.length - 1].nextRef = { bracket: "UPPER", round: r + 1, matchIndex: Math.floor(m / 2) };
      }
    }
  }

  // Нижняя сетка: чередование «пара выживших» (нечётные) / «против вылетевших из upper» (чётные)
  for (let L = 1; L <= lbRounds; L++) {
    const isMinor = L === 1 || L % 2 === 1;
    // количество матчей: убывает вдвое каждые 2 раунда
    const count = Math.max(1, size / 2 ** (Math.floor((L + 1) / 2) + 1));
    for (let m = 0; m < count; m++) {
      const isLbFinal = L === lbRounds;
      let nextRef: GenMatch["nextRef"];
      let nextSlot: number | null;
      if (isLbFinal) {
        nextRef = { bracket: "GF", round: 1, matchIndex: 0 }; // гранд-финал
        nextSlot = 2;
      } else if (isMinor) {
        // выживший попадает в major-раунд против вылетевшего из upper (слот 2)
        nextRef = { bracket: "LOWER", round: L + 1, matchIndex: m };
        nextSlot = 2;
      } else {
        // парный раунд: победители делятся пополам
        nextRef = { bracket: "LOWER", round: L + 1, matchIndex: Math.floor(m / 2) };
        nextSlot = (m % 2) + 1;
      }
      matches.push({
        bracket: "LOWER",
        round: L,
        matchIndex: m,
        p1Seed: null,
        p2Seed: null,
        nextRef,
        nextSlot,
        losersRef: null,
        losersSlot: null,
      });
    }
  }

  // Гранд-финал: победитель upper (слот 1) vs победитель lower (слот 2)
  matches.push({
    bracket: "GF",
    round: 1,
    matchIndex: 0,
    p1Seed: null,
    p2Seed: null,
    nextRef: null,
    nextSlot: null,
    losersRef: null,
    losersSlot: null,
  });
  return matches;
}

/** Круговая система: все пары, распределение по турам методом «карусели» */
export function generateRoundRobin(participantCount: number): GenMatch[] {
  const ids = Array.from({ length: participantCount }, (_, i) => i);
  const n = ids.length + (ids.length % 2 === 1 ? 1 : 0);
  const arr = [...ids];
  while (arr.length < n) arr.push(-1); // бай (ничья с «призраком»)
  const matches: GenMatch[] = [];
  const rounds = n - 1;
  for (let r = 0; r < rounds; r++) {
    let mi = 0;
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a !== -1 && b !== -1) {
        matches.push({
          bracket: "RR",
          round: r + 1,
          matchIndex: mi++,
          p1Seed: r % 2 === 0 ? a : b,
          p2Seed: r % 2 === 0 ? b : a,
          nextRef: null,
          nextSlot: null,
          losersRef: null,
          losersSlot: null,
        });
      }
    }
    // карусель: первый фиксирован
    arr.splice(1, 0, arr.pop() as number);
  }
  return matches;
}

export function generateBracket(
  format: TournamentFormat,
  participantCount: number,
  thirdPlace: boolean
): GenMatch[] {
  if (format === "SINGLE_ELIM") return generateSingleElim(participantCount, thirdPlace);
  if (format === "DOUBLE_ELIM") return generateDoubleElim(participantCount);
  return generateRoundRobin(participantCount);
}

/** Название раунда для отображения */
export function roundLabel(bracket: string, round: number, totalUpperRounds: number): string {
  switch (bracket) {
    case "UPPER": {
      const left = totalUpperRounds - round + 1;
      if (left === 1) return "Финал";
      if (left === 2) return "Полуфинал";
      return `1/${2 ** (left - 1)} финала`;
    }
    case "LOWER":
      return `Нижняя сетка · Раунд ${round}`;
    case "GF":
      return "Гранд-финал";
    case "GF_RESET":
      return "Гранд-финал · Сброс";
    case "THIRD":
      return "Матч за 3-е место";
    case "RR":
      return `Тур ${round}`;
    default:
      return `Раунд ${round}`;
  }
}

/** Распределение призового фонда по местам (split: "60,30,10") */
export function prizeForPlace(prizeFund: number, split: string, place: number): number {
  const parts = split
    .split(",")
    .map((s) => Number(s.trim()) || 0)
    .filter((v) => v > 0);
  if (prizeFund <= 0 || parts.length === 0) return 0;
  const pct = parts[place - 1] ?? 0;
  return Math.round((prizeFund * pct) / 100);
}

/** Проверка счётаelim-матча: без ничьей, победа ровно до нужного числа побед */
export function validateElimScore(
  s1: number,
  s2: number,
  bestOf: number
): { ok: true; winner: 1 | 2 } | { ok: false; error: string } {
  if (!Number.isInteger(s1) || !Number.isInteger(s2) || s1 < 0 || s2 < 0) {
    return { ok: false, error: "Счёт должен быть неотрицательным" };
  }
  if (s1 === s2) return { ok: false, error: "Ничья невозможна — нужен победитель" };
  const need = winsNeeded(bestOf);
  const winnerScore = Math.max(s1, s2);
  const loserScore = Math.min(s1, s2);
  if (winnerScore !== need) {
    return { ok: false, error: `Матч до ${need} побед (Bo${bestOf}): победитель должен набрать ровно ${need}` };
  }
  if (loserScore >= need) {
    return { ok: false, error: `Проигравший не может набрать ${need} и больше` };
  }
  return { ok: true, winner: s1 > s2 ? 1 : 2 };
}
