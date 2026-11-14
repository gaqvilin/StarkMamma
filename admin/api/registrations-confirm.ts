// POST /api/registrations-confirm {decisions: [{id, groupIds: string[] | null}]}
// groupIds = platser i grupperna -> bekräftad, grupperna sparas, betalningskrav skapas och kontot aktiveras.
// groupIds = null -> väntelista. Personen får en notis i båda fallen.
import { requireTrainer } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { bad, body, isUuid, json } from './_lib/http.js';
import { sendNotice } from './_lib/notify.js';

const WD = ['', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag'];
const dm = (d: string | null) => (d ? `${Number(d.slice(8))}/${Number(d.slice(5, 7))}` : '');

export async function POST(request: Request) {
  const denied = await requireTrainer(request);
  if (denied) return denied;
  const { decisions } = await body<{ decisions?: { id: string; groupIds: string[] | null }[] }>(request);
  if (!Array.isArray(decisions) || !decisions.length) return bad('Inga beslut');
  const q = await db();
  let confirmed = 0;
  let waitlisted = 0;

  for (const d of decisions) {
    if (!isUuid(d.id)) continue;
    const [r] = await q<{
      person_id: string; round_id: string; round_name: string; per_week: number; installments: boolean; status: string;
      price: number; first_installment: number | null; pay_deadline: string | null; installment_deadline: string | null;
    }>(
      `select r.person_id, r.round_id, rd.name as round_name, r.per_week, r.installments, r.status,
         t.price, t.first_installment, to_char(rd.pay_deadline, 'YYYY-MM-DD') as pay_deadline,
         to_char(rd.installment_deadline, 'YYYY-MM-DD') as installment_deadline
       from registrations r join rounds rd on rd.id = r.round_id
       left join price_tiers t on t.round_id = r.round_id and t.per_week = r.per_week
       where r.id = $1`,
      [d.id],
    );
    if (!r || r.status === 'confirmed') continue;

    if (!d.groupIds || !d.groupIds.length) {
      await q(`update registrations set status = 'waitlist' where id = $1`, [d.id]);
      await sendNotice(
        q,
        { title: 'Du står på väntelistan', body: `Grupperna du valde i ${r.round_name} är fulla just nu. Du får en notis om en plats blir ledig.`, audience: `person:${r.person_id}` },
        [r.person_id],
      );
      waitlisted++;
      continue;
    }

    const groupIds = d.groupIds.filter(isUuid);
    const valid = await q<{ id: string; weekday: number; time: string; place: string }>(
      `select id, weekday, to_char(start_time, 'HH24.MI') as time, place from groups where round_id = $1 and id = any($2::uuid[]) order by weekday, start_time`,
      [r.round_id, groupIds],
    );
    if (!valid.length) continue;
    await q(`insert into group_members (group_id, person_id) select unnest($1::uuid[]), $2 on conflict do nothing`, [valid.map((g) => g.id), r.person_id]);
    await q(`update registrations set status = 'confirmed', assigned_group_ids = $2::uuid[] where id = $1`, [d.id, valid.map((g) => g.id)]);
    await q(`update people set status = 'active', activated_at = coalesce(activated_at, now()) where id = $1 and status = 'pending'`, [r.person_id]);

    const price = r.price ?? 0;
    const split = r.installments && r.first_installment && r.first_installment < price;
    if (price > 0) {
      if (split) {
        await q(
          `insert into charges (person_id, description, amount, due_on, kind, round_id, registration_id) values
             ($1, $2, $3, $4::date, 'installment', $6, $7), ($1, $5, $8, $9::date, 'installment', $6, $7)`,
          [r.person_id, `${r.round_name}, delbetalning 1 av 2`, r.first_installment, r.pay_deadline, `${r.round_name}, delbetalning 2 av 2`,
           r.round_id, d.id, price - r.first_installment!, r.installment_deadline],
        );
      } else {
        await q(
          `insert into charges (person_id, description, amount, due_on, kind, round_id, registration_id) values ($1, $2, $3, $4::date, 'round', $5, $6)`,
          [r.person_id, `${r.round_name}, ${r.per_week} gång${r.per_week > 1 ? 'er' : ''}/vecka`, price, r.pay_deadline, r.round_id, d.id],
        );
      }
    }
    const groupsText = valid.map((g) => `${WD[g.weekday]} ${g.time} i ${g.place}`).join(', ');
    const payText = split
      ? `${r.first_installment} kr senast ${dm(r.pay_deadline)} och ${price - r.first_installment!} kr senast ${dm(r.installment_deadline)}`
      : `${price} kr${r.pay_deadline ? ` senast ${dm(r.pay_deadline)}` : ''}`;
    await sendNotice(
      q,
      {
        title: 'Din plats är bekräftad',
        body: `Välkommen till ${r.round_name}: ${groupsText}. Tryck för betalning och info.`,
        audience: `person:${r.person_id}`,
        page: {
          heading: r.round_name,
          text: `Du tränar ${groupsText}.\n\nAtt betala: ${payText}. Du betalar enklast med Swish under Betala i appen.\n\nLämna återbud senast dagen innan så får du passet tillgodo.`,
        },
      },
      [r.person_id],
    );
    confirmed++;
  }
  return json({ confirmed, waitlisted });
}
export { OPTIONS } from './_lib/http.js';
