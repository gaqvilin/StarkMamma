// Vilka som hör till ett pass: medlemmar i passets grupp (ordinarie) plus de som
// bokat in sig extra. En rad i bookings för en ordinarie medlem anger status
// (återbud, kommer, närvarande). Utan rad räknas medlemmen som bokad.
export const ROSTER_CTE = `
  roster as (
    select s.id as session_id, gm.person_id, coalesce(b.status, 'booked') as status, 'ordinary' as source
    from s
    join group_members gm on gm.group_id = s.group_id
    left join bookings b on b.session_id = s.id and b.person_id = gm.person_id
    union all
    select b.session_id, b.person_id, b.status, b.source
    from bookings b
    join s on s.id = b.session_id
    where not exists (
      select 1 from group_members gm where gm.group_id = s.group_id and gm.person_id = b.person_id
    )
  )`;

export const ACTIVE = `('booked', 'attending', 'attended')`;
