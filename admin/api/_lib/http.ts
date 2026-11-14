// Mobilappen anropar API:et med Bearer-token (ingen cookie), så öppen CORS är ofarlig:
// cookie-inloggningen i admin skickas aldrig med anrop från andra ursprung.
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
};

/** Svar på CORS-förfrågan (preflight). Exporteras som OPTIONS i varje endpoint som appen använder. */
export const OPTIONS = async () => new Response(null, { status: 204, headers: CORS });

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS, ...headers },
  });
}

export const bad = (message: string, status = 400) => json({ error: message }, status);

export async function body<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

export const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
