// Inloggning för Emma. Ett lösenord (ADMIN_PASSWORD) ger en signerad cookie
// som gäller i 30 dagar. Signeringsnyckeln är ADMIN_SECRET.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { bad } from './http.js';

const COOKIE = 'sm_admin';
const MAX_AGE = 30 * 24 * 3600;

const secret = () => process.env.ADMIN_SECRET || (process.env.DEMO_DB ? 'demo-secret' : '');
const password = () => process.env.ADMIN_PASSWORD || (process.env.DEMO_DB ? 'demo' : '');

const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkPassword(candidate: unknown): boolean {
  return typeof candidate === 'string' && !!password() && !!secret() && safeEqual(candidate, password());
}

export function sessionCookie(): string {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  const secure = process.env.DEMO_DB ? '' : '; Secure';
  return `${COOKIE}=${exp}.${sign(exp)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`;
}

export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export function isAdmin(request: Request): boolean {
  if (!secret()) return false;
  const raw = (request.headers.get('cookie') || '')
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE}=`));
  if (!raw) return false;
  const [exp, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!exp || !sig || !safeEqual(sig, sign(exp))) return false;
  return Number(exp) > Date.now() / 1000;
}

/** Returnerar ett 401-svar om anropet inte kommer från Emma, annars null. */
export const requireAdmin = (request: Request) => (isAdmin(request) ? null : bad('Inte inloggad', 401));
