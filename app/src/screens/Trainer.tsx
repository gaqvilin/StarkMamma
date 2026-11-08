import React, { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import {
  ME,
  MIN_PER_GROUP,
  NOW,
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

export function RosterScreen() {
  const s = useStore();
  const upcoming = useMemo(() => occurrences.filter((o) => startOf(o) > NOW).slice(0, 8), []);
  const [selId, setSelId] = useState(upcoming.find((o) => ME.groups.includes(o.groupId))!.id);
  const occ = upcoming.find((o) => o.id === selId)!;
  const booked = s.bookedCount(occ);
  const cap = s.capacity(occ);

  // Deterministisk låtsasstatus för de andra deltagarna
  const people = roster.slice(0, Math.min(roster.length, booked + (s.cancelled[occ.id] ? 1 : 0))).map((name, i) => {
    let status: 'kommer' | 'återbud' | 'inget svar' = i % 4 === 3 ? 'inget svar' : 'kommer';
    if (i === 6) status = 'återbud';
    if (name === ME.name) {
      if (!ME.groups.includes(occ.groupId) && !s.extra[occ.id]) return null;
      status = s.cancelled[occ.id] ? 'återbud' : s.attending[occ.id] ? 'kommer' : 'inget svar';
    }
    return { name, status };
  }).filter(Boolean) as { name: string; status: string }[];

  const coming = people.filter((p) => p.status === 'kommer').length;
  const noAnswer = people.filter((p) => p.status === 'inget svar').length;
  const freed = people.filter((p) => p.status === 'återbud').length;

  return (
    <View>
      <H1>Pass</H1>
      <Row style={{ flexWrap: 'wrap', marginBottom: 14 }}>
        {upcoming.map((o) => (
          <Chip key={o.id} label={`${['sön', 'mån', 'tis', 'ons', 'tors', 'fre', 'lör'][o.date.getDay()]} ${o.date.getDate()}/${o.date.getMonth() + 1} ${o.time}`} active={o.id === selId} onPress={() => setSelId(o.id)} />
        ))}
      </Row>

      <Card>
        <H2 style={{ fontSize: 20 }}>{dateLabel(occ.date)} · {occ.time} · {occ.place}</H2>
        <Row style={{ flexWrap: 'wrap' }}>
          <Pill tone="ok" text={`${coming} kommer`} />
          <Pill tone="warn" text={`${noAnswer} inget svar`} />
          <Pill tone="danger" text={`${freed} återbud`} />
          <Pill text={`${booked}/${cap} bokade`} />
        </Row>
        <Bar value={booked} max={cap} />
        <Row style={{ marginTop: 14, flexWrap: 'wrap' }}>
          <Button small title="Påminn de som inte svarat" onPress={() => s.dispatch({ type: 'push', title: `Kommer du ${dateLabel(occ.date).toLowerCase()} ${occ.time}?`, body: `Svara "Jag kommer" eller lämna återbud i appen. ${occ.place === 'Gymmet' ? 'Rena inomhusskor!' : 'Klä dig varmt – vi kör i Ladan.'}` })} />
          {freed > 0 && (
            <Button small variant="secondary" title={`Erbjud ${freed} plats till kön`} onPress={() => s.dispatch({ type: 'push', title: `Ledig plats ${occ.time} idag! ⚡`, body: `Det finns ${freed} ledig plats på ${occ.place} ${occ.time}. Först att trycka "Boka" får platsen.` })} />
          )}
        </Row>
      </Card>

      {people.map((p) => (
        <Row key={p.name} style={{ justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.line }}>
          <Text style={{ fontSize: 15, fontWeight: p.name === ME.name ? '800' : '500' }}>{p.name}</Text>
          <Pill tone={p.status === 'kommer' ? 'ok' : p.status === 'återbud' ? 'danger' : 'warn'} text={p.status} />
        </Row>
      ))}
      <P muted style={{ marginTop: 12 }}>Kö: Petra Hed, Linnea Ros</P>
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
        title={pending.length ? `Bekräfta ${pending.length} & skicka push` : 'Alla bekräftade ✓'}
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
  { label: 'Extrapass', title: 'SöndagsFYS igen? 🍁', body: 'Extrapass sön 15/11 kl 17.00 om minst 8 anmäler sig. 140 kr eller ett klipp. Tryck för att anmäla intresse!' },
  { label: 'Uppsamling', title: 'Lediga platser kommande vecka', body: 'Det finns lediga platser mån 12.00, tis 06.15 och fre 06.15. Boka med ditt tillgodo-pass i appen!' },
  { label: 'Anmälan öppen', title: '🔥 Anmälan öppen – CT v 2–8 2027', body: 'Förtur för dig som tränar nu fram till tis 10/11 kl 20.00. Anmäl dig i appen!' },
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
      <P muted style={{ marginTop: 10 }}>Tips: byt till "Deltagare" uppe till höger för att se notisen i deltagarens inkorg.</P>
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
        onPress={() => s.dispatch({ type: 'push', title: 'Påminnelse om betalning', body: 'Du har en obetald avgift hos StarkMamma. Tryck för att betala direkt med Swish 😊' })}
        style={{ marginBottom: 14 }}
      />
      {s.payments.map((p) => (
        <Card key={p.id} style={{ paddingVertical: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700' }}>{p.name}</Text>
              <P muted>{p.what} · {p.amount} kr · {p.due}</P>
            </View>
            <Chip label={p.paid ? '✓ Betald' : 'Markera betald'} active={p.paid} onPress={() => s.dispatch({ type: 'togglePaid', id: p.id })} />
          </Row>
        </Card>
      ))}
      <P muted style={{ marginBottom: 20 }}>Senare: automatisk avstämning med Swish Handel, och kvitton skickas automatiskt.</P>
    </View>
  );
}
