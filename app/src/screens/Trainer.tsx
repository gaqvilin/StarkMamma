import React, { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  ME,
  MIN_PER_GROUP,
  NOW,
  Occurrence,
  Registration,
  dateLabel,
  groupById,
  groups,
  occurrences,
  roster,
  startOf,
} from '../data';
import { preFilled, useStore } from '../store';
import { colors } from '../theme';
import { Bar, Button, Card, Chip, H1, H2, P, Pill, Row } from '../ui';

// ------------------------------------------------------------------ Passlista

type Status = 'kommer' | 'återbud' | 'inget svar';
type Store = ReturnType<typeof useStore>;

const DAY_MS = 24 * 3600 * 1000;
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Svar på "kommer du?" efterfrågas dagen innan, så närvaro visas bara för pass idag och imorgon. */
const asksAttendance = (o: Occurrence) => dayStart(o.date).getTime() - dayStart(NOW).getTime() <= DAY_MS;

// Deterministisk låtsasstatus för deltagarna så att prototypen ser levande ut.
function sessionPeople(s: Store, o: Occurrence) {
  let h = 0;
  for (const c of o.id) h = (h * 31 + c.charCodeAt(0)) % 1009;
  const cap = s.capacity(o);
  const booked = Math.min(cap, s.bookedCount(o));
  const cancelIdx = h % 4 === 0 ? [5, 9] : h % 4 === 1 ? [5] : [];
  const list: { name: string; status: Status }[] = [];
  roster.slice(0, Math.min(roster.length, booked + (s.cancelled[o.id] ? 1 : 0))).forEach((name, i) => {
    let status: Status = (i + h) % 5 === 3 ? 'inget svar' : 'kommer';
    if (cancelIdx.includes(i)) status = 'återbud';
    if (name === ME.name) {
      if (!ME.groups.includes(o.groupId) && !s.extra[o.id]) return;
      status = s.cancelled[o.id] ? 'återbud' : s.attending[o.id] ? 'kommer' : 'inget svar';
    }
    list.push({ name, status });
  });
  const free = cap - booked;
  const queue = free > 0 ? 0 : 1 + (h % 2);
  return {
    people: list,
    booked,
    cap,
    free,
    queue,
    coming: list.filter((p) => p.status === 'kommer').length,
    noAnswer: list.filter((p) => p.status === 'inget svar').length,
    cancelled: list.filter((p) => p.status === 'återbud').length,
  };
}

const WEEK_DATES: Record<number, string> = {
  45: '2–8/11', 46: '9–15/11', 47: '16–22/11', 48: '23–29/11', 49: '30/11–6/12', 50: '7–13/12', 51: '14–20/12',
};

export function RosterScreen() {
  const s = useStore();
  const [week, setWeek] = useState(46);
  const [open, setOpen] = useState<string | null>(null);

  const weekOccs = occurrences.filter((o) => o.week === week);
  const stats = new Map(weekOccs.map((o) => [o.id, sessionPeople(s, o)]));
  const upcomingStats = weekOccs.filter((o) => startOf(o) > NOW).map((o) => stats.get(o.id)!);
  const totalFree = upcomingStats.reduce((a, x) => a + Math.max(0, x.free), 0);
  const totalCancelled = upcomingStats.reduce((a, x) => a + x.cancelled, 0);
  const totalQueue = upcomingStats.reduce((a, x) => a + x.queue, 0);

  const byDay = new Map<string, Occurrence[]>();
  weekOccs.forEach((o) => {
    const k = dayStart(o.date).toISOString();
    byDay.set(k, [...(byDay.get(k) ?? []), o]);
  });

  const relDay = (d: Date) => {
    const diff = Math.round((dayStart(d).getTime() - dayStart(NOW).getTime()) / DAY_MS);
    return diff === 0 ? 'idag' : diff === 1 ? 'imorgon' : '';
  };

  return (
    <View>
      <H1>Pass</H1>

      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Button small variant="secondary" title="Föregående" disabled={week <= 45} onPress={() => { setWeek(week - 1); setOpen(null); }} />
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontWeight: '800', fontSize: 16 }}>Vecka {week}</Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>{WEEK_DATES[week]}</Text>
        </View>
        <Button small variant="secondary" title="Nästa" disabled={week >= 51} onPress={() => { setWeek(week + 1); setOpen(null); }} />
      </Row>

      <Row style={{ marginBottom: 16 }}>
        {[
          { n: totalFree, label: 'lediga platser', color: colors.ok },
          { n: totalCancelled, label: 'återbud', color: colors.danger },
          { n: totalQueue, label: 'i kö', color: colors.accent },
        ].map((x) => (
          <Card key={x.label} style={{ flex: 1, marginBottom: 0, paddingVertical: 10, alignItems: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: x.color }}>{x.n}</Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>{x.label}</Text>
          </Card>
        ))}
      </Row>

      {[...byDay.entries()].map(([k, occs]) => {
        const d = occs[0].date;
        const rel = relDay(d);
        return (
          <View key={k} style={{ marginBottom: 14 }}>
            <Row style={{ marginBottom: 6 }}>
              <Text style={{ fontWeight: '800', fontSize: 13, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{dateLabel(d)}</Text>
              {rel ? <Pill tone="accent" text={rel} /> : null}
            </Row>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {occs.map((o, idx) => {
                const st = stats.get(o.id)!;
                const past = startOf(o) <= NOW;
                const isOpen = open === o.id;
                return (
                  <View key={o.id} style={{ borderTopWidth: idx ? 1 : 0, borderColor: colors.line }}>
                    <Pressable onPress={() => setOpen(isOpen ? null : o.id)} style={{ padding: 14, opacity: past ? 0.45 : 1 }}>
                      <Row style={{ justifyContent: 'space-between' }}>
                        <Row>
                          <Text style={{ fontWeight: '800', fontSize: 17, fontVariant: ['tabular-nums'] }}>{o.time}</Text>
                          <Text style={{ color: colors.muted, fontSize: 14 }}>{o.place}</Text>
                          {o.moved ? <Pill tone="warn" text="flyttat" /> : null}
                        </Row>
                        <Text style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>{st.booked}/{st.cap}</Text>
                      </Row>
                      <Bar value={st.booked} max={st.cap} />
                      <Row style={{ marginTop: 8, flexWrap: 'wrap' }}>
                        {past ? (
                          <Text style={{ color: colors.muted, fontSize: 13 }}>Genomfört</Text>
                        ) : (
                          <>
                            {asksAttendance(o) ? (
                              <Text style={{ fontSize: 13, color: colors.muted }}>
                                <Text style={{ color: colors.ok, fontWeight: '700' }}>{st.coming} kommer</Text>
                                {st.noAnswer ? <Text style={{ color: colors.warn, fontWeight: '700' }}>{`  ·  ${st.noAnswer} inget svar`}</Text> : null}
                              </Text>
                            ) : null}
                            {st.cancelled ? <Pill tone="danger" text={`${st.cancelled} återbud`} /> : null}
                            {st.free > 0 ? <Pill tone="ok" text={`${st.free} ledig${st.free > 1 ? 'a' : ''}`} /> : null}
                            {st.queue ? <Pill tone="accent" text={`${st.queue} i kö`} /> : null}
                          </>
                        )}
                      </Row>
                    </Pressable>

                    {isOpen && (
                      <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                        {!past && (
                          <Row style={{ flexWrap: 'wrap', marginBottom: 10 }}>
                            {asksAttendance(o) && st.noAnswer > 0 && (
                              <Button small title={`Påminn ${st.noAnswer} som inte svarat`} onPress={() => s.dispatch({ type: 'push', title: `Kommer du ${dateLabel(o.date).toLowerCase()} ${o.time}?`, body: `Svara "Jag kommer" eller lämna återbud i appen. ${o.place === 'Gymmet' ? 'Rena inomhusskor.' : 'Klä dig varmt, vi kör i Ladan.'}` })} />
                            )}
                            {st.cancelled > 0 && (
                              <Button small variant="secondary" title="Erbjud platsen till kön" onPress={() => s.dispatch({ type: 'push', title: `Ledig plats ${dateLabel(o.date).toLowerCase()} ${o.time}`, body: `Det finns en ledig plats på ${o.place} ${o.time}. Den som först trycker "Boka" får platsen.` })} />
                            )}
                          </Row>
                        )}
                        {st.people.map((p) => (
                          <Row key={p.name} style={{ justifyContent: 'space-between', paddingVertical: 7 }}>
                            <Text style={{ fontSize: 15, fontWeight: p.name === ME.name ? '800' : '500' }}>{p.name}</Text>
                            {asksAttendance(o) || p.status === 'återbud' ? (
                              <Pill tone={p.status === 'kommer' ? 'ok' : p.status === 'återbud' ? 'danger' : 'warn'} text={p.status} />
                            ) : null}
                          </Row>
                        ))}
                        {st.queue ? <P muted style={{ marginTop: 6 }}>Kö: {['Petra Hed', 'Linnea Ros'].slice(0, st.queue).join(', ')}</P> : null}
                      </View>
                    )}
                  </View>
                );
              })}
            </Card>
          </View>
        );
      })}
    </View>
  );
}

// ------------------------------------------------------------------ Anmälningar

type Plan = Record<string, { groups: (string | null)[]; status: 'bekräftad' | 'väntelista' }>;

function suggest(regs: Registration[]): { plan: Plan; fill: Record<string, number> } {
  const fill: Record<string, number> = { ...preFilled };
  const plan: Plan = {};
  // Förtur för nuvarande deltagare, sedan exakt anmälningstid
  const order = [...regs].sort((a, b) => Number(b.existing) - Number(a.existing) || a.at.getTime() - b.at.getTime());
  for (const r of order) {
    const assigned = r.choices.map(([first, second]) => {
      for (const gid of [first, second]) {
        if (gid && fill[gid] < groupById(gid).capacity) {
          fill[gid] += 1;
          return gid;
        }
      }
      return null;
    });
    plan[r.id] = { groups: assigned, status: assigned.every(Boolean) ? 'bekräftad' : 'väntelista' };
  }
  return { plan, fill };
}

const short = (gid: string) => {
  const g = groupById(gid);
  return `${['', 'Mån', 'Tis', 'Ons', 'Tors', 'Fre'][g.weekday]} ${g.time}`;
};

export function RegistrationsScreen() {
  const s = useStore();
  const { plan, fill } = useMemo(() => suggest(s.registrations), [s.registrations]);
  const pending = s.registrations.filter((r) => r.status === 'väntar');

  return (
    <View>
      <H1>Anmälningar</H1>
      <P muted style={{ marginBottom: 12 }}>CT-omgång v 2–8 2027 · förtur till 10/11 20.00 · {s.registrations.length} nya anmälningar</P>

      <Card>
        <H2>Beläggning per grupp</H2>
        {groups.map((g) => (
          <View key={g.id} style={{ marginBottom: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '600' }}>{short(g.id)} · {g.place}</Text>
              <Text style={{ color: fill[g.id] < MIN_PER_GROUP ? colors.warn : colors.muted, fontWeight: '700' }}>
                {fill[g.id]}/{g.capacity}{fill[g.id] < MIN_PER_GROUP ? ` · under ${MIN_PER_GROUP}` : ''}
              </Text>
            </Row>
            <Bar value={fill[g.id]} max={g.capacity} min={MIN_PER_GROUP} />
          </View>
        ))}
      </Card>

      <H2>Förslag på fördelning</H2>
      {s.registrations.map((r) => {
        const p = plan[r.id];
        return (
          <Card key={r.id} style={{ paddingVertical: 12 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '700', fontSize: 15 }}>{r.name}</Text>
              {r.status !== 'väntar' ? (
                <Pill tone={r.status === 'bekräftad' ? 'ok' : 'warn'} text={r.status} />
              ) : (
                <Pill tone={p.status === 'bekräftad' ? 'accent' : 'warn'} text={p.status === 'bekräftad' ? 'förslag: plats' : 'förslag: väntelista'} />
              )}
            </Row>
            <Row style={{ flexWrap: 'wrap', marginTop: 6 }}>
              {r.existing ? <Pill text="förtur" /> : <Pill tone="accent" text="ny" />}
              <Pill text={`${r.perWeek}/v`} />
              {r.installments && <Pill text="delbetalning" />}
              {r.friend && <Pill text={`med ${r.friend}`} />}
              <Pill text={`${r.at.getHours()}.${String(r.at.getMinutes()).padStart(2, '0')}.${String(r.at.getSeconds()).padStart(2, '0')}`} />
            </Row>
            {r.choices.map(([a, b], i) => (
              <P key={i} muted style={{ marginTop: 4 }}>
                Pass {i + 1}: önskar {short(a)}{b ? ` (alt. ${short(b)})` : ''} →{' '}
                <Text style={{ color: p.groups[i] ? (p.groups[i] === a ? colors.ok : colors.warn) : colors.danger, fontWeight: '700' }}>
                  {p.groups[i] ? short(p.groups[i]!) : 'fullt'}
                </Text>
              </P>
            ))}
          </Card>
        );
      })}
      <Button
        title={pending.length ? `Bekräfta ${pending.length} & skicka push` : 'Alla är bekräftade'}
        disabled={!pending.length}
        onPress={() => s.dispatch({ type: 'confirmRegistrations', decisions: Object.fromEntries(pending.map((r) => [r.id, plan[r.id].status])) })}
        style={{ marginBottom: 20 }}
      />
    </View>
  );
}

// ------------------------------------------------------------------ Push

const TEMPLATES = [
  { label: 'Ändrad lokal', title: 'Ändrad lokal ikväll', body: 'Torsdag 17.30 kör vi i Gymmet i stället för Ladan pga vädret. Rena inomhusskor!' },
  { label: 'Extrapass', title: 'SöndagsFYS igen?', body: 'Extrapass sön 15/11 kl 17.00 om minst 8 anmäler sig. 140 kr eller ett klipp. Tryck för att anmäla intresse!' },
  { label: 'Uppsamling', title: 'Lediga platser kommande vecka', body: 'Det finns lediga platser mån 12.00, tis 06.15 och fre 06.15. Boka med ditt tillgodo-pass i appen!' },
  { label: 'Anmälan öppen', title: 'Anmälan öppen – CT v 2–8 2027', body: 'Förtur för dig som tränar nu fram till tis 10/11 kl 20.00. Anmäl dig i appen!' },
];

export function PushScreen() {
  const s = useStore();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [aud, setAud] = useState('Alla deltagare');
  const audiences = ['Alla deltagare', 'Tis 18.45', 'Ej betalt', 'Kö-listor', 'Intresseanmälda'];

  return (
    <View>
      <H1>Skicka notis</H1>
      <P muted style={{ marginBottom: 12 }}>Når alla direkt på mobilen – även de som inte är på Facebook (e-post/sms som reserv).</P>

      <H2>Mottagare</H2>
      <Row style={{ flexWrap: 'wrap', marginBottom: 14 }}>
        {audiences.map((a) => (
          <Chip key={a} label={a} active={aud === a} onPress={() => setAud(a)} />
        ))}
      </Row>

      <H2>Mallar</H2>
      <Row style={{ flexWrap: 'wrap', marginBottom: 14 }}>
        {TEMPLATES.map((t) => (
          <Chip key={t.label} label={t.label} active={title === t.title} onPress={() => { setTitle(t.title); setBody(t.body); }} />
        ))}
      </Row>

      <Card>
        <TextInput placeholder="Rubrik" value={title} onChangeText={setTitle} style={{ fontSize: 17, fontWeight: '700', paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.line }} />
        <TextInput placeholder="Meddelande" value={body} onChangeText={setBody} multiline style={{ fontSize: 15, minHeight: 90, paddingTop: 10, textAlignVertical: 'top' }} />
      </Card>
      <Button
        title={`Skicka till ${aud.toLowerCase()}`}
        disabled={!title || !body}
        onPress={() => { s.dispatch({ type: 'push', title, body }); setTitle(''); setBody(''); }}
      />
    </View>
  );
}

// ------------------------------------------------------------------ Betalningar

export function TrainerPayScreen() {
  const s = useStore();
  const unpaid = s.payments.filter((p) => !p.paid);
  const total = s.payments.filter((p) => p.paid).reduce((a, p) => a + p.amount, 0);
  const outstanding = unpaid.reduce((a, p) => a + p.amount, 0);
  return (
    <View>
      <H1>Betalningar</H1>
      <Row style={{ marginBottom: 14 }}>
        <Card style={{ flex: 1, marginBottom: 0 }}>
          <P muted>Inbetalt</P>
          <H2 style={{ fontSize: 22, color: colors.ok }}>{total.toLocaleString('sv-SE')} kr</H2>
        </Card>
        <Card style={{ flex: 1, marginBottom: 0 }}>
          <P muted>Utestående</P>
          <H2 style={{ fontSize: 22, color: colors.warn }}>{outstanding.toLocaleString('sv-SE')} kr</H2>
        </Card>
      </Row>
      <Button
        variant="secondary"
        title={`Påminn ${unpaid.length} som inte betalat`}
        disabled={!unpaid.length}
        onPress={() => s.dispatch({ type: 'push', title: 'Påminnelse om betalning', body: 'Du har en obetald avgift hos StarkMamma. Tryck för att betala direkt med Swish.' })}
        style={{ marginBottom: 14 }}
      />
      {s.payments.map((p) => (
        <Card key={p.id} style={{ paddingVertical: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700' }}>{p.name}</Text>
              <P muted>{p.what} · {p.amount} kr · {p.due}</P>
            </View>
            <Chip label={p.paid ? 'Betald' : 'Markera betald'} active={p.paid} onPress={() => s.dispatch({ type: 'togglePaid', id: p.id })} />
          </Row>
        </Card>
      ))}
      <P muted style={{ marginBottom: 20 }}>Senare: automatisk avstämning med Swish Handel, och kvitton skickas automatiskt.</P>
    </View>
  );
}
