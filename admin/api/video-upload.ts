// POST /api/video-upload {workoutId} -> skapar en film hos Bunny för passet och returnerar
// uppladdningsuppgifter, så att Emmas webbläsare laddar upp filen direkt till Bunny.
import { requireTrainer } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, body, isUuid, json } from './_lib/http.js';
import { createVideo, uploadAuth, videoConfigured } from './_lib/video.js';
export { OPTIONS } from './_lib/http.js';

export async function POST(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  if (!videoConfigured()) return bad('Filmuppladdning är inte påslagen än (Bunny Stream saknas)', 503);
  const { workoutId } = await body<{ workoutId?: string }>(request);
  if (!isUuid(workoutId)) return bad('Ogiltigt pass');
  const q = await db();
  const [w] = await q<{ title: string }>(`select title from workouts where id = $1`, [workoutId]);
  if (!w) return bad('Passet finns inte', 404);
  let videoId: string;
  try {
    videoId = await createVideo(w.title);
  } catch {
    return bad('Det gick inte att förbereda uppladdningen. Försök igen.', 502);
  }
  await q(`update workouts set video_provider = 'bunny', video_id = $2, video_status = 'uploading', video_url = null where id = $1`, [workoutId, videoId]);
  return json({ videoId, ...uploadAuth(videoId) });
}
