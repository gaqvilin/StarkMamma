// Anrop till StarkMamma-API:et (samma server som Emmas admin, se ../admin/api).
// Adressen sätts med EXPO_PUBLIC_API_URL, t.ex. https://admin.starkmamma.com.
// Inloggningen sparas som en token: i säker lagring på mobilen, i localStorage på webben.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
const KEY = 'starkmamma_token';

export async function loadToken(): Promise<string | null> {
  try {
    return Platform.OS === 'web' ? localStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function saveToken(token: string | null) {
  try {
    if (Platform.OS === 'web') {
      if (token) localStorage.setItem(KEY, token);
      else localStorage.removeItem(KEY);
    } else if (token) await SecureStore.setItemAsync(KEY, token);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    /* utan lagring får man logga in igen nästa gång */
  }
}

let current: string | null = null;
export const setCurrentToken = (t: string | null) => {
  current = t;
};

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        ...(current ? { authorization: `Bearer ${current}` } : {}),
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError('Ingen kontakt med servern. Kontrollera din uppkoppling.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? 'Något gick fel', res.status);
  return data as T;
}

// ---- Typer från API:et ----

export interface User {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: 'participant' | 'trainer';
  status: 'pending' | 'active' | 'rejected';
  needs_profile: boolean;
}

export interface MySession {
  id: string;
  date: string;
  time: string;
  place: string;
  status: 'planned' | 'moved' | 'cancelled';
  note: string | null;
  kind: string;
  in_time: boolean;
  ordinary: boolean;
  my_status: string;
  source: string | null;
}

export interface Bookable {
  id: string;
  date: string;
  time: string;
  place: string;
  status: string;
  kind: string;
  capacity: number;
  booked: number;
  price: number | null;
  mine: boolean;
  queued: boolean;
  source: string | null;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  page_heading: string | null;
  page_text: string | null;
  page_link: string | null;
  read: boolean;
  sent_at: string;
  /** Mottagaren ska bekräfta att hon läst (t.ex. inställt pass eller event). */
  requires_ack: boolean;
  acknowledged: boolean;
}

export interface Charge {
  id: string;
  description: string;
  amount: number;
  status: 'unpaid' | 'paid';
  kind: string;
  due_on: string | null;
  receipt_number: number | null;
  paid_on: string | null;
}

// ---- Datum ----

const DAYS = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
const parse = (d: string) => new Date(`${d}T12:00:00`);
export const dayLabel = (d: string) => {
  const x = parse(d);
  return `${DAYS[x.getDay()]} ${x.getDate()}/${x.getMonth() + 1}`;
};
export const shortDate = (d: string) => {
  const x = parse(d);
  return `${x.getDate()}/${x.getMonth() + 1}`;
};
export const WD = ['', 'Mån', 'Tis', 'Ons', 'Tors', 'Fre', 'Lör', 'Sön'];
export const WD_LONG = ['', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];
