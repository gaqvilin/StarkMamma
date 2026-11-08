export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? 'Något gick fel', res.status);
  return data as T;
}

export interface Group {
  id: string;
  weekday: number;
  time: string;
  place: string;
  capacity: number;
  min_participants: number;
  members: number;
}

export interface Session {
  id: string;
  date: string;
  time: string;
  place: string;
  capacity: number;
  status: 'planned' | 'moved' | 'cancelled';
  kind: string;
  note: string | null;
  booked: number;
  attending: number;
  cancelled: number;
  queue: number;
}

export interface Person {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: 'pending' | 'active';
  signed_up_via: string | null;
  created: string;
  group_ids: string[];
}

export const WEEKDAYS = ['', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];
export const WD_SHORT = ['', 'Mån', 'Tis', 'Ons', 'Tors', 'Fre', 'Lör', 'Sön'];
export const groupLabel = (g: Group) => `${WD_SHORT[g.weekday]} ${g.time} ${g.place}`;

const parse = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
};
export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (d: string, n: number) => {
  const x = parse(d);
  x.setDate(x.getDate() + n);
  return iso(x);
};
export const mondayOf = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return iso(x);
};
export const isoWeek = (d: string) => {
  const x = parse(d);
  x.setDate(x.getDate() + 3 - ((x.getDay() + 6) % 7));
  const jan4 = new Date(x.getFullYear(), 0, 4);
  return 1 + Math.round(((x.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
};
export const dayLabel = (d: string) => {
  const x = parse(d);
  return `${WEEKDAYS[x.getDay() === 0 ? 7 : x.getDay()]} ${x.getDate()}/${x.getMonth() + 1}`;
};
export const shortDate = (d: string) => {
  const x = parse(d);
  return `${x.getDate()}/${x.getMonth() + 1}`;
};
