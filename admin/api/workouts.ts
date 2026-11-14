// POST /api/workouts {id?, programId, title, body?, videoUrl?, durationMin?, publishOn?, sort?, delete?: true}
// Skapa, ändra eller ta bort ett onlinepass. Ett pass har text, film eller båda.
import { requireTrainer } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, body, isUuid, json } from './_lib/http.js';
export { OPTIONS } from './_lib/http.js';

type Input = { id?: string; programId?: string; title?: string; body?: string; videoUrl?: string; durationMin?: number; publishOn?: string; sort?: number; delete?: boolean };

export async function POST(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  const b = await body<Input>(request);
  const q = await db();
  if (b.delete) {
    if (!isUuid(b.id)) return bad('Ogiltigt pass');
    await q(`delete from workouts where id = $1`, [b.id]);
    return json({ ok: true });
  }
  if (!isUuid(b.programId)) return bad('Ogiltigt program');
  const title = (b.title ?? '').trim();
  const text = (b.body ?? '').trim() || null;
  const video = (b.videoUrl ?? '').trim() || null;
  if (!title) return bad('Rubrik saknas');
  if (title.length > 200 || (text?.length ?? 0) > 20000 || (video?.length ?? 0) > 500) return bad('Texten är för lång');
  const [existing] = b.id && isUuid(b.id)
    ? await q<{ video_provider: string; video_id: string | null }>(`select video_provider, video_id from workouts where id = $1`, [b.id])
    : [];
  const hasUploaded = existing?.video_provider === 'bunny' && !!existing.video_id;
  if (!text && !video && !hasUploaded) return bad('Lägg till text eller en film');
  if (video && !/^https:\/\/\S+$/i.test(video)) return bad('Filmlänken måste börja med https://');
  if (b.publishOn && !/^\d{4}-\d{2}-\d{2}$/.test(b.publishOn)) return bad('Ogiltigt datum');
  const minutes = b.durationMin ? Math.round(Number(b.durationMin)) : null;
  const sort = Math.round(Number(b.sort ?? 0)) || 0;
  if (b.id) {
    if (!isUuid(b.id)) return bad('Ogiltigt pass');
    await q(
      `update workouts set title = $2, body = $3, duration_min = $5, publish_on = $6::date, sort = $7,
         video_url = $4::text,
         video_provider = case when $4::text is not null then 'link' else video_provider end
       where id = $1`,
      [b.id, title, text, video, minutes, b.publishOn || null, sort],
    );
    return json({ id: b.id });
  }
  const [w] = await q<{ id: string }>(
    `insert into workouts (program_id, title, body, video_url, duration_min, publish_on, sort)
     values ($1, $2, $3, $4, $5, $6::date, $7) returning id`,
    [b.programId, title, text, video, minutes, b.publishOn || null, sort],
  );
  return json({ id: w.id }, 201);
}
