// Реестр звуков уведомлений (данные без обращения к window — безопасно
// импортировать и на сервере для валидации выбора).

export type WaveType = "square" | "sine" | "triangle" | "sawtooth";

export interface SoundNote {
  f: number; // частота, Гц
  d: number; // длительность, сек
  t: number; // задержка от начала, сек
  type?: WaveType; // по умолчанию square
}

export interface SoundDef {
  id: string;
  name: string;
  loopMs: number; // интервал повтора при непрерывной сирене
  notes: SoundNote[];
}

export const SOUNDS: SoundDef[] = [
  {
    id: "siren",
    name: "Сирена (по умолчанию)",
    loopMs: 2600,
    notes: [
      { f: 988, d: 0.15, t: 0 },
      { f: 988, d: 0.15, t: 0.22 },
      { f: 1319, d: 0.35, t: 0.44 },
    ],
  },
  {
    id: "classic",
    name: "Классический",
    loopMs: 2400,
    notes: [
      { f: 880, d: 0.35, t: 0 },
      { f: 660, d: 0.45, t: 0.5 },
    ],
  },
  {
    id: "chime",
    name: "Мелодичный",
    loopMs: 3000,
    notes: [
      { f: 659, d: 0.3, t: 0, type: "sine" },
      { f: 784, d: 0.3, t: 0.25, type: "sine" },
      { f: 1047, d: 0.55, t: 0.5, type: "sine" },
    ],
  },
  {
    id: "urgent",
    name: "Тревожный",
    loopMs: 1800,
    notes: [
      { f: 1200, d: 0.1, t: 0 },
      { f: 1200, d: 0.1, t: 0.18 },
      { f: 1200, d: 0.1, t: 0.36 },
      { f: 1200, d: 0.25, t: 0.54 },
    ],
  },
  {
    id: "buzzer",
    name: "Низкий гудок",
    loopMs: 2200,
    notes: [
      { f: 220, d: 0.4, t: 0, type: "sawtooth" },
      { f: 180, d: 0.5, t: 0.55, type: "sawtooth" },
    ],
  },
  {
    id: "arcade",
    name: "Аркадный",
    loopMs: 3200,
    notes: [
      { f: 523, d: 0.12, t: 0, type: "triangle" },
      { f: 659, d: 0.12, t: 0.14, type: "triangle" },
      { f: 784, d: 0.12, t: 0.28, type: "triangle" },
      { f: 1047, d: 0.4, t: 0.42, type: "triangle" },
    ],
  },
];

export function soundById(id: string): SoundDef | undefined {
  return SOUNDS.find((s) => s.id === id);
}

export const DEFAULT_SOUND_ID = "siren";
