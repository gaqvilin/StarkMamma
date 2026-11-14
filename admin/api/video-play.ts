// GET /api/video-play?workoutId= -> länk till filmen för den som har tillgång till passet.
// Filmer hos Bunny får en signerad länk som slutar gälla efter några timmar.
import { requireUser } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, isUuid, json } from './_lib/http.js';
import { playUrl, videoConfigured, videoStatus } from './_lib/video.js';
export { OPTIONS } from './_lib/http.js';

export async function GET(request: Request) {
  const user = await requireUser(request, { active: true });
  if (user instanceof Response) return user;
  const id = new URL(request.url).searchParams.get('workoutId');
  if (!isUuid(id)) return bad('Ogiltigt pass');
  const q = await db();
  const [w] = await q<{ video_provider: string; video_id: string | null; video_url: string | null; video_status: string | null; allowed: boolean }>(
    `select w.video_provider, w.video_id, w.video_url, w.video_status,
       ($2 or exists (select 1 from online_access a where a.program_id = w.program_id and a.person_id = $1)) as allowed
     from workouts w where w.id = $3`,
    [user.id, user.role === 'trainer', id],
  );
  if (!w || !w.allowed) return bad('Du har inte tillgång till filmen', 403);
  if (w.video_provider === 'link') return w.video_url ? json({ url: w.video_url }) : bad('Passet har ingen film', 404);
  if (!w.video_id || !videoConfigured()) return bad('Filmen är inte tillgänglig', 404);
  if (w.video_status !== 'ready') {
    const status = await videoStatus(w.video_id);
    await q(`update workouts set video_status = $2 where id = $1`, [id, status]);
    if (status !== 'ready') return bad(status === 'failed' ? 'Filmen gick inte att bearbeta' : 'Filmen bearbetas fortfarande. Försök igen om en stund.', 409);
  }
  return json({ url: playUrl(w.video_id) });
}
