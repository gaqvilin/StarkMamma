// POST /api/charges-pay {id, method?: 'swish'|'bank'|'cash'|'other', undo?: boolean}
// Markerar ett betalningskrav som betalt (ger ett kvittonummer) eller ångrar markeringen.
// Köper någon ett 10-kort skapas kortet när betalningen markeras, och onlineträning ger tillgång till passen.
import { requireTrainer } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, body, isUuid, json } from './_lib/http.js';

export async function POST(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  const b = await body<{ id?: string; method?: string; undo?: boolean }>(request);
  if (!isUuid(b.id)) return bad('Ogiltig betalning');
  const q = await db();
  if (b.undo) {
    const [c] = await q<{ person_id: string; online_program_id: string | null; kind: string }>(
      `select person_id, online_program_id, kind from charges where id = $1 and status = 'paid'`,
      [b.id],
    );
    if (!c) return json({ ok: true });
    if (c.kind === 'punch_card') {
      const [used] = await q(`select 1 from punch_cards where charge_id = $1 and remaining < total`, [b.id]);
      if (used) return bad('Klippkortet har redan använts och kan inte ångras');
      await q(`delete from punch_cards where charge_id = $1`, [b.id]);
    }
    const [back] = await q(`update charges set status = 'unpaid' where id = $1 and status = 'paid' returning id`, [b.id]);
    if (!back) return json({ ok: true });
    await q(`delete from payments where charge_id = $1`, [b.id]);
    if (c.online_program_id) {
      await q(`delete from online_access where program_id = $1 and person_id = $2 and source in ('paid', 'reported')`, [c.online_program_id, c.person_id]);
    }
    return json({ ok: true });
  }
  // Ta "betald" atomiskt först, så att ett dubbelklick inte ger två kvitton eller två klippkort.
  const [c] = await q<{ amount: number; kind: string; person_id: string; online_program_id: string | null }>(
    `update charges set status = 'paid' where id = $1 and status = 'unpaid' returning amount, kind, person_id, online_program_id`,
    [b.id],
  );
  if (!c) {
    const [exists] = await q(`select 1 from charges where id = $1`, [b.id]);
    return exists ? json({ ok: true }) : bad('Betalningen finns inte', 404);
  }
  const method = ['swish', 'bank', 'cash', 'other'].includes(b.method ?? '') ? b.method : 'swish';
  const [p] = await q<{ receipt_number: number }>(
    `insert into payments (charge_id, amount, method) values ($1, $2, $3) returning receipt_number`,
    [b.id, c.amount, method],
  );
  if (c.online_program_id) {
    // Onlineträning: betald = tillgång till passen.
    await q(
      `insert into online_access (program_id, person_id, source) values ($1, $2, 'paid')
       on conflict (program_id, person_id) do update set source = 'paid' where online_access.source = 'reported'`,
      [c.online_program_id, c.person_id],
    );
  }
  if (c.kind === 'punch_card') {
    await q(
      `insert into punch_cards (person_id, kind, total, remaining, valid_until, charge_id)
       values ($1, '10-kort', 10, 10, current_date + interval '12 months', $2) on conflict do nothing`,
      [c.person_id, b.id],
    );
  }
  return json({ ok: true, receipt_number: p.receipt_number });
}
export { OPTIONS } from './_lib/http.js';
