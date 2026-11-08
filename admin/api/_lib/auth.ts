// Gemensam inloggning för mobilappen och admin: mobilnummer eller e-post + engångskod.
// Efter verifiering utfärdas en signerad token (personId.utgång.signatur) som webben
// får som cookie och mobilappen som Bearer-token. Rollen läses från databasen vid
// varje anrop, så Emma (role = 'trainer') får admin var hon än loggar in.
import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { db } from './db.js';
import { bad } from './http.js';

const COOKIE = 'sm_session';
const MAX_AGE = 90 * 24 * 3600;

const secret = () => process.env.AUTH_SECRET || (process.env.DEMO_DB ? 'demo-secret' : '');
const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** 070-123 45 67, +46 70 123 45 67 och 0046701234567 blir alla 0701234567. */
export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('0046')) d = '0' + d.slice(4);
  else if (d.startsWith('46') && d.length >= 11) d = '0' + d.slice(2);
  return d.length >= 8 ? d : null;
}

export function parseIdentifier(raw: unknown): { email: string } | { phone: string } | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  if (v.includes('@')) return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? { email: v.toLowerCase() } : null;
  const phone = normalizePhone(v);
  return phone ? { phone } : null;
}

export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
export const hashCode = (personId: string, code: string) =>
  createHash('sha256').update(`${secret()}:${personId}:${code}`).digest('hex');

export function issueToken(personId: string): string {
  const payload = `${personId}.${Math.floor(Date.now() / 1000) + MAX_AGE}`;
  return `${payload}.${sign(payload)}`;
}

export function sessionCookie(token: string): string {
  const secure = process.env.DEMO_DB ? '' : '; Secure';
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

function tokenFrom(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  const c = (request.headers.get('cookie') || '').split(';').map((x) => x.trim()).find((x) => x.startsWith(`${COOKIE}=`));
  return c ? c.slice(COOKIE.length + 1) : null;
}

export interface User {
  id: string;
  name: string;
  role: 'participant' | 'trainer';
}

export async function currentUser(request: Request): Promise<User | null> {
  if (!secret()) return null;
  const token = tokenFrom(request);
  if (!token) return null;
  const [id, exp, sig] = token.split('.');
  if (!id || !exp || !sig || !safeEqual(sig, sign(`${id}.${exp}`)) || Number(exp) < Date.now() / 1000) return null;
  const q = await db();
  const [user] = await q<User & Record<string, unknown>>(`select id, name, role from people where id = $1`, [id]);
  return user ?? null;
}

/** Svarar 401/403 om anroparen inte är inloggad som tränare, annars null. */
export async function requireTrainer(request: Request): Promise<Response | null> {
  const user = await currentUser(request);
  if (!user) return bad('Inte inloggad', 401);
  if (user.role !== 'trainer') return bad('Bara för tränaren', 403);
  return null;
}
