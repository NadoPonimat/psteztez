// Общие типы CRM для клиента

export type UserRole = "ADMIN" | "STAFF";
export type DeviceType = "PLAYSTATION" | "VR";
export type PaymentMethod = "CASH" | "KASPI" | "MIXED";

export interface CurrentUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  theme?: string;
  alarmSound?: string;
  phone?: string | null;
}

// ---- Телефоны: звонок и WhatsApp ----

/** Нормализованные цифры номера для tel:/wa.me: «+7 (701) 123-45-67» → "77011234567" */
export function phoneDigits(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

/** Ссылка WhatsApp на номер: https://wa.me/77011234567 */
export function whatsappLink(phone: string | null | undefined): string {
  const digits = phoneDigits(phone);
  return digits ? `https://wa.me/${digits}` : "";
}

/** Ссылка звонка: tel:+77011234567 */
export function telLink(phone: string | null | undefined): string {
  const digits = phoneDigits(phone);
  return digits ? `tel:+${digits}` : "";
}

/** Маска для показа: оставляем как ввёл главный */
export function phonePretty(phone: string | null | undefined): string {
  return (phone ?? "").trim();
}

export interface ActiveSession {
  id: number;
  packageName: string;
  durationMinutes: number;
  startedAt: string; // ISO
  plannedEndAt: string; // ISO
  price: number;
  paymentMethod: PaymentMethod;
  cashAmount: number;
  kaspiAmount: number;
  notified: boolean;
  createdByName: string;
}

/** Расчёт цены сеанса с учётом акции и постоянного клиента (берётся лучшая скидка) */
export function computeSessionPrice(
  basePrice: number,
  promos: PromoItem[],
  deviceType: DeviceType | null,
  customer: CustomerItem | null,
  now: Date = new Date()
): { price: number; originalPrice: number | null; discountLabel: string | null; discount: number } {
  const promoApplied = activePromoDiscount(promos, deviceType, basePrice, now);
  const customerDiscount =
    customer && customer.discountPercent > 0
      ? Math.floor((basePrice * customer.discountPercent) / 100)
      : 0;

  const useCustomer = customerDiscount > 0 && customerDiscount >= (promoApplied?.discount ?? 0);
  const usePromo = promoApplied && !useCustomer;

  if (useCustomer && customer) {
    const label = `Постоянный клиент −${customer.discountPercent}%`;
    return {
      price: basePrice - customerDiscount,
      originalPrice: basePrice,
      discountLabel: label,
      discount: customerDiscount,
    };
  }
  if (usePromo && promoApplied) {
    return {
      price: promoApplied.finalPrice,
      originalPrice: basePrice,
      discountLabel: promoDiscountLabel(promoApplied.promo),
      discount: promoApplied.discount,
    };
  }
  return { price: basePrice, originalPrice: null, discountLabel: null, discount: 0 };
}

export interface DeviceWithSession {
  id: number;
  type: DeviceType;
  number: number;
  activeSession: ActiveSession | null;
}

export interface Pkg {
  id: number;
  name: string;
  durationMinutes: number;
  price: number;
  deviceType: DeviceType | null;
  active: boolean;
  sortOrder: number;
}

export interface AdminStats {
  todayRevenue: number;
  todayCash: number;
  todayKaspi: number;
  todaySessions: number;
}

export interface DashboardData {
  serverNow: string;
  clubName: string;
  devices: DeviceWithSession[];
  packages: Pkg[];
  promos: PromoItem[]; // активные акции (для превью скидки на кассе)
  customers: CustomerItem[]; // активные постоянные клиенты
  vrGames: VrGameItem[]; // активные VR-игры
  adminStats: AdminStats | null;
  user: CurrentUser;
}

export interface HistorySession {
  id: number;
  deviceType: string;
  deviceNumber: number;
  packageName: string;
  durationMinutes: number;
  startedAt: string;
  endedAt: string | null;
  plannedEndAt: string;
  price: number;
  originalPrice: number | null;
  discountLabel: string | null;
  paymentMethod: string;
  cashAmount: number;
  kaspiAmount: number;
  createdByName: string;
  completedByName: string | null;
}

export interface HistoryData {
  sessions: HistorySession[];
  totals: { revenue: number; cash: number; kaspi: number; count: number };
}

export interface StaffUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  active: boolean;
  phone?: string | null;
  dailyRate?: number;
  bonusPercent?: number;
  bonusThreshold?: number;
}

// ---- Постоянные клиенты ----

export interface CustomerItem {
  id: number;
  name: string;
  phone: string | null;
  discountPercent: number; // 0–100
  note: string | null;
  active: boolean;
}

// ---- VR-игры ----

export interface VrGameItem {
  id: number;
  number: number; // номер на стенде («№26»), 0 = без номера
  name: string;
  description: string; // «американские горки, ночью, хоррор»
  durationMinutes: number;
  minAge: number; // 0 = без ограничения
  price: number;
  active: boolean;
  sortOrder: number;
}

// ---- Турниры ----

export type TournamentFormat = "SINGLE_ELIM" | "DOUBLE_ELIM" | "ROUND_ROBIN";

export interface TournamentGameItem {
  id: number;
  name: string;
  genre: string;
  active: boolean;
  sortOrder: number;
  tournamentsCount: number;
}

export interface TournamentListItem {
  id: number;
  name: string;
  game: { name: string; genre: string };
  format: TournamentFormat;
  bestOf: number;
  entryFee: number;
  prizeFund: number;
  prizeSplit: string;
  status: "REGISTRATION" | "ONGOING" | "COMPLETED";
  maxParticipants: number;
  participantsCount: number;
  matchesCount: number;
  championName: string | null;
  startsAt: string | null;
  createdAt: string;
}

export interface TournamentDetailData {
  tournament: {
    id: number;
    name: string;
    game: { id: number; name: string; genre: string };
    format: TournamentFormat;
    bestOf: number;
    entryFee: number;
    prizeFund: number;
    prizeSplit: string;
    thirdPlace: boolean;
    maxParticipants: number;
    status: "REGISTRATION" | "ONGOING" | "COMPLETED";
    startsAt: string | null;
    championName: string | null;
    createdByName: string;
    createdAt: string;
  };
  participants: TournamentParticipantItem[];
  matches: TournamentMatchItem[];
}

export interface TournamentParticipantItem {
  id: number;
  tournamentId: number;
  name: string;
  phone: string | null;
  paid: boolean;
  seed: number;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  diff: number;
  eliminated: boolean;
  place: number | null;
}

export interface TournamentMatchItem {
  id: number;
  tournamentId: number;
  bracket: "UPPER" | "LOWER" | "GF" | "GF_RESET" | "THIRD" | "RR";
  round: number;
  matchIndex: number;
  p1Id: number | null;
  p1Name: string | null;
  p2Id: number | null;
  p2Name: string | null;
  score1: number | null;
  score2: number | null;
  winnerId: number | null;
  status: "PENDING" | "READY" | "DONE";
  roundLabel: string;
}

// ---- Зарплата и график ----

export interface EmployeeEarnings {
  userId: string;
  name: string;
  username: string;
  role: UserRole;
  dailyRate: number;
  bonusPercent: number;
  bonusThreshold: number;
  workDays: string[];
  dayRevenues: { day: string; revenue: number }[];
  rateEarned: number;
  bonusEarned: number;
  totalEarned: number;
}

export interface EarningsData {
  month: string;
  employees: EmployeeEarnings[];
}

// ---- Касса (журнал движений) ----

export type CashEntryKind =
  | "OPENING_CASH"
  | "OPENING_KASPI"
  | "SALE"
  | "ADVANCE_CASH"
  | "ADVANCE_KASPI"
  | "EXPENSE";

export const CASH_KIND_LABELS: Record<string, string> = {
  OPENING_CASH: "Открытие смены · наличные",
  OPENING_KASPI: "Открытие смены · Каспи",
  SALE: "Оплата сеанса",
  ADVANCE_CASH: "Аванс наличными из кассы",
  ADVANCE_KASPI: "Аванс переводом Каспи (от главного)",
  EXPENSE: "Расход",
};

export interface CashEntryItem {
  id: number;
  kind: CashEntryKind;
  amount: number;
  cashPart: number;
  kaspiPart: number;
  note: string | null;
  userName: string;
  createdAt: string; // ISO
}

export interface CashSummary {
  openingCash: number;
  openingKaspi: number;
  salesCash: number;
  salesKaspi: number;
  advancesCash: number;
  advancesKaspi: number;
  expensesCash: number; // оплачено из кассы наличных
}

export interface CashData {
  cashBalance: number;
  kaspiBalance: number;
  today: CashSummary;
  entries: CashEntryItem[];
  openingToday: { cash: boolean; kaspi: boolean };
}

// ---- Отчёты ----

export interface ReportSession {
  id: number;
  deviceType: string;
  deviceNumber: number;
  packageName: string;
  durationMinutes: number;
  startedAt: string;
  endedAt: string | null;
  price: number;
  paymentMethod: string;
  cashAmount: number;
  kaspiAmount: number;
  createdByName: string;
}

export interface ReportData {
  type: "day" | "period";
  from: string;
  to: string;
  clubName: string;
  generatedAt: string;
  generatedByName: string;
  generatedByRole: string;
  totals: {
    revenue: number;
    cash: number;
    kaspi: number;
    count: number;
    avgCheck: number;
  };
  byType: {
    PLAYSTATION: { revenue: number; count: number };
    VR: { revenue: number; count: number };
  };
  byDay: { day: string; revenue: number; cash: number; kaspi: number; count: number }[];
  sessions: ReportSession[];
  // Движение кассы за период (открытия, приход от сеансов, авансы, остаток на конец)
  cash?: CashSummary & { closingCash: number; closingKaspi: number };
  cashEntries?: CashEntryItem[];
  expenses?: ExpenseItem[];
  expensesTotal?: number; // все расходы за период (вкл. из своего кармана)
}

// ---- Акции и скидки ----

export type PromoDiscountType = "PERCENT" | "FIXED";

export interface PromoItem {
  id: number;
  name: string;
  discountType: PromoDiscountType;
  discountValue: number;
  timeFrom: string; // "HH:MM"
  timeTo: string; // "HH:MM"
  days: string; // CSV дней недели, 0=Вс .. 6=Сб
  deviceType: DeviceType | null;
  active: boolean;
}

/** Расчёт скидки активной акции для пакета (клиентская копия серверной логики) */
export function activePromoDiscount(
  promos: PromoItem[],
  deviceType: DeviceType | null,
  basePrice: number,
  now: Date = new Date()
): { promo: PromoItem; discount: number; finalPrice: number } | null {
  const dow = now.getDay(); // 0 = Вс
  const minutes = now.getHours() * 60 + now.getMinutes();
  let best: { promo: PromoItem; discount: number } | null = null;
  for (const p of promos) {
    if (!p.active) continue;
    if (p.deviceType && deviceType && p.deviceType !== deviceType) continue;
    if (p.deviceType && !deviceType) continue;
    const days = p.days.split(",").map((s) => s.trim()).filter(Boolean).map(Number);
    if (days.length > 0 && !days.includes(dow)) continue;
    const [fh, fm] = p.timeFrom.split(":").map(Number);
    const [th, tm] = p.timeTo.split(":").map(Number);
    const from = fh * 60 + fm;
    const to = th * 60 + tm;
    const inWindow = from <= to ? minutes >= from && minutes < to : minutes >= from || minutes < to;
    if (!inWindow) continue;
    const discount =
      p.discountType === "PERCENT"
        ? Math.floor((basePrice * p.discountValue) / 100)
        : Math.min(p.discountValue, basePrice);
    if (discount > 0 && (!best || discount > best.discount)) best = { promo: p, discount };
  }
  if (!best) return null;
  return { promo: best.promo, discount: best.discount, finalPrice: basePrice - best.discount };
}

export function promoDiscountLabel(p: PromoItem): string {
  return p.discountType === "PERCENT" ? `${p.name} −${p.discountValue}%` : `${p.name} −${p.discountValue} ₸`;
}

// ---- Тепловая карта продаж ----

export interface HeatmapCell {
  dow: number; // 0 = Пн .. 6 = Вс (порядок отображения)
  hour: number; // 0..23
  revenue: number;
  count: number;
}

export interface HeatmapData {
  days: number; // период агрегации
  maxRevenue: number;
  totalRevenue: number;
  totalCount: number;
  cells: HeatmapCell[];
}

// ---- Расходы ----

export interface ExpenseItem {
  id: number;
  name: string;
  amount: number;
  source: "CASH" | "POCKET";
  note: string | null;
  userName: string;
  createdAt: string; // ISO
}

export const EXPENSE_SOURCE_LABELS: Record<string, string> = {
  CASH: "из кассы наличных",
  POCKET: "из своего кармана",
};

export const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Наличные",
  KASPI: "Каспи",
  MIXED: "Смешанная",
};

export function formatTenge(n: number): string {
  return `${n.toLocaleString("ru-RU")} ₸`;
}

export function deviceLabel(type: string, number: number): string {
  return type === "VR" ? `VR ${number}` : `PS ${number}`;
}

// ---- График смен ----

export interface ScheduleShift {
  id: string;
  day: string; // YYYY-MM-DD
  slot: number; // 1 | 2
  isFullDay: boolean;
  userId: string | null;
  userName: string | null;
  startsAt: string; // "HH:MM"
  endsAt: string; // "HH:MM"
}

export interface ScheduleEmployee {
  id: string;
  name: string;
  role: UserRole;
  active: boolean;
}

export interface ScheduleData {
  from: string;
  to: string;
  shifts: ScheduleShift[];
  employees: ScheduleEmployee[];
}

export interface ShiftDraft {
  userId: string;
  startsAt: string;
  endsAt: string;
}

export interface DayDraft {
  mode: "off" | "full" | "split";
  full: ShiftDraft;
  s1: ShiftDraft;
  s2: ShiftDraft;
}

// ---- Хелперы дат ----

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function currentMonth(): string {
  return todayStr().slice(0, 7);
}

export function monthNameRU(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const names = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
  ];
  return `${names[(m ?? 1) - 1]} ${y}`;
}

export function dateRU(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ---- Хелперы графика смен ----

/** Дата в YYYY-MM-DD из компонентов */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** Понедельник недели, к которой относится дата YYYY-MM-DD */
export function weekStart(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dow = (date.getDay() + 6) % 7; // 0 = Пн
  date.setDate(date.getDate() - dow);
  return ymd(date);
}

/** Прибавить n дней к дате YYYY-MM-DD */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d + n);
  return ymd(date);
}

/** 7 дат недели, начиная с понедельника */
export function weekDays(from: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(from, i));
}

const WD_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** Короткое имя дня недели: "Пн" */
export function weekdayShort(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return WD_SHORT[(new Date(y, m - 1, d).getDay() + 6) % 7];
}

/** Число месяца без ведущего нуля: "27" */
export function dayNum(day: string): string {
  return String(Number(day.slice(8, 10)));
}

/** Длительность смены в минутах (end <= start = через полночь) */
export function shiftMinutes(startsAt: string, endsAt: string): number {
  const [sh, sm] = startsAt.split(":").map(Number);
  const [eh, em] = endsAt.split(":").map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  return mins;
}

/** "12 ч 30 мин" из минут */
export function minutesHuman(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
}
