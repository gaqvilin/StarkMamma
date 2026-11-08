// Mockdata för prototypen. Alla deltagarnamn är påhittade.

export type Place = 'Gymmet' | 'Ladan';

export interface Group {
  id: string;
  weekday: 1 | 2 | 3 | 4 | 5; // 1 = måndag
  time: string;
  place: Place;
  capacity: number;
}

export interface Occurrence {
  id: string;
  groupId: string;
  date: Date;
  time: string;
  place: Place;
  week: number;
  moved?: string; // förklaring om passet flyttats
}

export const MIN_PER_GROUP = 14;

// Prototypen låtsas att det är söndag 8/11 2026 kl 12.00.
export const NOW = new Date(2026, 10, 8, 12, 0);

export const groups: Group[] = [
  { id: 'man-1200', weekday: 1, time: '12.00', place: 'Gymmet', capacity: 16 },
  { id: 'man-1730', weekday: 1, time: '17.30', place: 'Ladan', capacity: 20 },
  { id: 'man-1845', weekday: 1, time: '18.45', place: 'Gymmet', capacity: 16 },
  { id: 'tis-0615', weekday: 2, time: '06.15', place: 'Gymmet', capacity: 16 },
  { id: 'tis-1730', weekday: 2, time: '17.30', place: 'Gymmet', capacity: 16 },
  { id: 'tis-1845', weekday: 2, time: '18.45', place: 'Gymmet', capacity: 16 },
  { id: 'tor-1620', weekday: 4, time: '16.20', place: 'Gymmet', capacity: 16 },
  { id: 'tor-1730', weekday: 4, time: '17.30', place: 'Ladan', capacity: 20 },
  { id: 'tor-1845', weekday: 4, time: '18.45', place: 'Ladan', capacity: 20 },
  { id: 'fre-0615', weekday: 5, time: '06.15', place: 'Gymmet', capacity: 16 },
];

export const groupById = (id: string) => groups.find((g) => g.id === id)!;

const DAY = ['sön', 'mån', 'tis', 'ons', 'tors', 'fre', 'lör'];
const DAY_LONG = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];

export const groupLabel = (g: Group) => `${DAY_LONG[g.weekday]} ${g.time} · ${g.place}`;
export const dayShort = (d: Date) => DAY[d.getDay()];
export const dateLabel = (d: Date) => `${DAY_LONG[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;

// Omgång v 45–51 2026. Måndag v 45 = 2/11 2026.
const WEEK45_MONDAY = new Date(2026, 10, 2);

function buildOccurrences(): Occurrence[] {
  const out: Occurrence[] = [];
  for (let w = 0; w < 7; w++) {
    const week = 45 + w;
    for (const g of groups) {
      let date = new Date(WEEK45_MONDAY);
      date.setDate(date.getDate() + w * 7 + (g.weekday - 1));
      let moved: string | undefined;
      // Undantag från infobladet
      if (week === 47 && (g.weekday === 4 || g.weekday === 5)) {
        date = new Date(2026, 10, 18);
        moved = `Flyttat från ${DAY_LONG[g.weekday].toLowerCase()} v 47`;
      }
      if (week === 51 && g.weekday === 5) {
        date = new Date(2026, 11, 16);
        moved = 'Flyttat från fredag v 51';
      }
      out.push({ id: `${g.id}-v${week}`, groupId: g.id, date, time: g.time, place: g.place, week, moved });
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime() || a.time.localeCompare(b.time));
}

export const occurrences = buildOccurrences();
export const occById = (id: string) => occurrences.find((o) => o.id === id)!;

export const startOf = (o: Occurrence) => {
  const [h, m] = o.time.split('.').map(Number);
  const d = new Date(o.date);
  d.setHours(h, m, 0, 0);
  return d;
};

/** Återbud ger tillgodo om det lämnas senast dagen innan (före midnatt). */
export const creditDeadline = (o: Occurrence) => {
  const d = new Date(o.date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Deterministiskt "antal bokade" per tillfälle så att prototypen ser levande ut.
export function baseBooked(o: Occurrence): number {
  const g = groupById(o.groupId);
  let h = 0;
  for (const c of o.id) h = (h * 31 + c.charCodeAt(0)) % 997;
  const delta = (h % 5) - 1; // -1..3 lediga
  return Math.max(MIN_PER_GROUP - 2, g.capacity - delta);
}

// ---- Deltagare (påhittade) ----
export const ME = { id: 'p0', name: 'Sara Lind', groups: ['tis-1845'], perWeek: 1 };

export const roster = [
  'Sara Lind', 'Anna Berg', 'Johanna Ek', 'Lisa Holm', 'Maria Strand', 'Karin Sjö', 'Elin Dahl',
  'Frida Lund', 'Malin Ås', 'Hanna Vik', 'Ida Norr', 'Klara Ström', 'Sofia Mark', 'Emma Fors',
  'Linnea Ros', 'Petra Hed',
];

// ---- Anmälningar till nästa omgång (v 2–8 2027) ----
export interface Registration {
  id: string;
  name: string;
  existing: boolean;
  perWeek: 1 | 2 | 3;
  choices: string[][]; // per pass/vecka: [förstahand, andrahand]
  friend?: string;
  at: Date;
  status: 'väntar' | 'bekräftad' | 'väntelista';
  installments: boolean;
}

const t = (min: number, sec: number) => new Date(2026, 10, 7, 18, min, sec);

export const initialRegistrations: Registration[] = [
  { id: 'r1', name: 'Anna Berg', existing: true, perWeek: 2, choices: [['tis-1845', 'man-1845'], ['tor-1845', 'tor-1730']], at: t(0, 4), status: 'väntar', installments: true },
  { id: 'r2', name: 'Johanna Ek', existing: true, perWeek: 1, choices: [['tis-1845', 'tor-1845']], friend: 'Lisa Holm', at: t(0, 7), status: 'väntar', installments: false },
  { id: 'r3', name: 'Lisa Holm', existing: true, perWeek: 1, choices: [['tis-1845', 'tor-1845']], friend: 'Johanna Ek', at: t(0, 9), status: 'väntar', installments: false },
  { id: 'r4', name: 'Maria Strand', existing: true, perWeek: 3, choices: [['man-1200', 'man-1730'], ['tis-0615', 'tis-1730'], ['fre-0615', 'tor-1620']], at: t(0, 12), status: 'väntar', installments: true },
  { id: 'r5', name: 'Karin Sjö', existing: true, perWeek: 1, choices: [['fre-0615', 'tis-0615']], at: t(0, 18), status: 'väntar', installments: false },
  { id: 'r6', name: 'Elin Dahl', existing: true, perWeek: 2, choices: [['man-1730', 'man-1845'], ['tor-1730', 'tor-1845']], at: t(0, 25), status: 'väntar', installments: false },
  { id: 'r7', name: 'Frida Lund', existing: true, perWeek: 1, choices: [['tis-1845', 'tis-1730']], at: t(0, 41), status: 'väntar', installments: false },
  { id: 'r8', name: 'Malin Ås', existing: true, perWeek: 1, choices: [['tor-1620', 'man-1200']], at: t(1, 3), status: 'väntar', installments: false },
  { id: 'r9', name: 'Hanna Vik', existing: false, perWeek: 1, choices: [['tis-1845', 'man-1845']], at: t(2, 30), status: 'väntar', installments: false },
  { id: 'r10', name: 'Ida Norr', existing: false, perWeek: 2, choices: [['man-1845', 'man-1730'], ['tor-1845', 'tor-1730']], at: t(3, 15), status: 'väntar', installments: true },
];

// Redan bekräftade platser i nästa omgång (förtursanmälningar som behandlats tidigare)
export const preFilled: Record<string, number> = {
  'man-1200': 12, 'man-1730': 17, 'man-1845': 15, 'tis-0615': 13, 'tis-1730': 14,
  'tis-1845': 13, 'tor-1620': 10, 'tor-1730': 18, 'tor-1845': 19, 'fre-0615': 15,
};

// ---- Betalningar ----
export interface Payment {
  id: string;
  name: string;
  what: string;
  amount: number;
  due: string;
  paid: boolean;
}

export const initialPayments: Payment[] = [
  { id: 'pay1', name: 'Sara Lind', what: 'CT-omgång v 45–51, 1 gång/v', amount: 699, due: '27/10', paid: true },
  { id: 'pay2', name: 'Anna Berg', what: 'Delbetalning 2 av 2', amount: 600, due: '27/11', paid: false },
  { id: 'pay3', name: 'Maria Strand', what: 'Delbetalning 2 av 2', amount: 1100, due: '27/11', paid: false },
  { id: 'pay4', name: 'Elin Dahl', what: 'CT-omgång v 45–51, 2 gånger/v', amount: 1299, due: '27/10', paid: true },
  { id: 'pay5', name: 'Karin Sjö', what: 'Extrapass SöndagsFYS 8/11', amount: 140, due: '8/11', paid: false },
  { id: 'pay6', name: 'Sara Lind', what: 'AdventsFYS & AdventsMYS (tröja M)', amount: 280, due: '20/11', paid: false },
];

export const PRICES = { 1: 699, 2: 1299, 3: 1799 } as const;
