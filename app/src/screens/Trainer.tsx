// Emmas vyer i mobilappen, kopplade till samma API som admin på datorn.
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { WD, api, dayLabel, shortDate } from '../api';
import { useApi } from '../auth';
import { colors } from '../theme';
import { useToast } from '../toast';
import { Bar, Button, Card, Chip, H1, H2, P, Pill, Row } from '../ui';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const mondayOf = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return iso(x);
};
const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00`);
  x.setDate(x.getDate() + n);
  return iso(x);
};
const isoWeek = (d: string) => {
  const x = new Date(`${d}T12:00:00`);
  x.setDate(x.getDate() + 3 - ((x.getDay() + 6) % 7));
  const jan4 = new Date(x.getFullYear(), 0, 4);
  return 1 + Math.round(((x.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
};

function Loading({ error }: { error?: string }) {
  return <P muted style={{ marginTop: 20 }}>{error || 'Hämtar…'}</P>;
}

// ------------------------------------------------------------------ Pass

interface WeekSession {
  id: string; date: string; time: string; place: string; capacity: number; status: string; note: string | null;
  booked: number; attending: number; cancelled: number; queue: number;
}
interface Roster {
  notice: { id: string; title: string; recipients: number; acknowledged: number; missing: string[] } | null;
  session: WeekSession;
  roster: { id: string; name: string; phone: string | null; status: string; source: string }[];
  queue: { id: string; name: string }[];
}
interface PendingPerson { id: string; name: string; email: string; phone: string | null; status: string }

const ST: Record<string, [string, 'ok' | 'warn' | 'danger' | 'neutral']> = {
  booked: ['bokad', 'neutral'],
  attending: ['kommer', 'ok'],
  attended: ['närvarade', 'ok'],
  cancelled_in_time: ['återbud', 'danger'],
  cancelled_late: ['sent återbud', 'danger'],
  no_show: ['kom inte', 'warn'],
};

export function RosterScreen() {
  const [from, setFrom] = useState(() => mondayOf(new Date()));
  const [open, setOpen] = useState<string | null>(null);
  const week = useApi<{ sessions: WeekSession[] }>(`week?from=${from}`);
  const people = useApi<{ people: PendingPerson[] }>('people');
  const toast = useToast();
  const pending = (people.data?.people ?? []).filter((p) => p.status === 'pending');

  const byDay = new Map<string, WeekSession[]>();
  (week.data?.sessions ?? []).forEach((s) => byDay.set(s.date, [...(byDay.get(s.date) ?? []), s]));
  const free = (week.data?.sessions ?? []).filter((s) => s.status !== 'cancelled').reduce((a, s) => a + Math.max(0, s.capacity - s.booked), 0);
  const cancelled = (week.data?.sessions ?? []).reduce((a, s) => a + s.cancelled, 0);
  const queue = (week.data?.sessions ?? []).reduce((a, s) => a + s.queue, 0);

  return (
    <View>
      <H1>Pass</H1>

      {pending.length > 0 && (
        <Card style={{ borderColor: colors.accent }}>
          <H2>Nya konton att aktivera ({pending.length})</H2>
          {pending.map((p) => (
            <Row key={p.id} style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700' }}>{p.name || p.email}</Text>
                <Text style={{ color: colors.muted, fontSize: 13 }}>{p.phone ?? 'telefon saknas'}</Text>
              </View>
              <Button
                small
                title="Aktivera"
                disabled={!p.name}
                onPress={async () => {
                  try {
                    await api('people-activate', { method: 'POST', body: { id: p.id, action: 'activate' } });
                    toast({ title: 'Aktiverat', body: `${p.name} har fått en notis.` });
                    people.reload();
                  } catch (e) {
                    toast({ title: 'Det gick inte', body: (e as Error).message });
                  }
                }}
              />
            </Row>
          ))}
          <P muted style={{ fontSize: 13 }}>Grupper väljer du i admin på datorn eller när anmälan bekräftas.</P>
        </Card>
      )}

      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Button small variant="secondary" title="Föregående" onPress={() => { setFrom(addDays(from, -7)); setOpen(null); }} />
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontWeight: '800', fontSize: 16 }}>Vecka {isoWeek(from)}</Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            {shortDate(from)}–{shortDate(addDays(from, 6))}
          </Text>
        </View>
        <Button small variant="secondary" title="Nästa" onPress={() => { setFrom(addDays(from, 7)); setOpen(null); }} />
      </Row>

      <Row style={{ marginBottom: 16 }}>
        {[
          { n: free, label: 'lediga platser', color: colors.ok },
          { n: cancelled, label: 'återbud', color: colors.danger },
          { n: queue, label: 'i kö', color: colors.accent },
        ].map((x) => (
          <Card key={x.label} style={{ flex: 1, marginBottom: 0, paddingVertical: 10, alignItems: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: x.color }}>{x.n}</Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>{x.label}</Text>
          </Card>
        ))}
      </Row>

      {!week.data ? (
        <Loading error={week.error} />
      ) : (
        [...byDay.entries()].map(([date, sessions]) => (
          <View key={date} style={{ marginBottom: 14 }}>
            <Text style={{ fontWeight: '800', fontSize: 13, color: colors.muted, textTransform: 'uppercase', marginBottom: 6 }}>{dayLabel(date)}</Text>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {sessions.map((s, i) => (
                <View key={s.id} style={{ borderTopWidth: i ? 1 : 0, borderColor: colors.line }}>
                  <Pressable onPress={() => setOpen(open === s.id ? null : s.id)} style={{ padding: 14, opacity: s.status === 'cancelled' ? 0.5 : 1 }}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <Row>
                        <Text style={{ fontWeight: '800', fontSize: 17 }}>{s.time}</Text>
                        <Text style={{ color: colors.muted }}>{s.place}</Text>
                        {s.status === 'moved' ? <Pill tone="warn" text="flyttat" /> : null}
                        {s.status === 'cancelled' ? <Pill tone="danger" text="inställt" /> : null}
                      </Row>
                      <Text style={{ fontWeight: '700' }}>
                        {s.booked}/{s.capacity}
                      </Text>
                    </Row>
                    <Bar value={s.booked} max={s.capacity} />
                    <Row style={{ marginTop: 8, flexWrap: 'wrap' }}>
                      {s.attending ? <Text style={{ color: colors.ok, fontWeight: '700', fontSize: 13 }}>{s.attending} kommer</Text> : null}
                      {s.cancelled ? <Pill tone="danger" text={`${s.cancelled} återbud`} /> : null}
                      {s.capacity - s.booked > 0 ? <Pill tone="ok" text={`${s.capacity - s.booked} lediga`} /> : null}
                      {s.queue ? <Pill tone="accent" text={`${s.queue} i kö`} /> : null}
                    </Row>
                  </Pressable>
                  {open === s.id && <SessionDetail id={s.id} onChanged={week.reload} />}
                </View>
              ))}
            </Card>
          </View>
        ))
      )}
    </View>
  );
}

function SessionDetail({ id, onChanged }: { id: string; onChanged: () => void }) {
  const { data, reload } = useApi<Roster>(`session?id=${id}`);
  const toast = useToast();
  if (!data) return <Loading />;
  const s = data.session;

  const booking = async (personId: string, action: string) => {
    try {
      await api('booking', { method: 'POST', body: { sessionId: id, personId, action } });
      reload();
      onChanged();
    } catch (e) {
      toast({ title: 'Det gick inte', body: (e as Error).message });
    }
  };
  const update = async (body: Record<string, unknown>, done: string) => {
    try {
      const r = await api<{ notified: number }>('session', { method: 'PUT', body: { id, notify: true, ...body } });
      toast({ title: done, body: `${r.notified} har fått en notis.` });
      reload();
      onChanged();
    } catch (e) {
      toast({ title: 'Det gick inte', body: (e as Error).message });
    }
  };

  return (
    <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
      <Row style={{ flexWrap: 'wrap', marginBottom: 10 }}>
        {s.status !== 'cancelled' && (
          <>
            <Button small variant="secondary" title={`Byt till ${s.place === 'Gymmet' ? 'Ladan' : 'Gymmet'}`} onPress={() => update({ place: s.place === 'Gymmet' ? 'Ladan' : 'Gymmet' }, 'Lokalen är ändrad')} />
            <Button small variant="danger" title="Ställ in" onPress={() => update({ cancelled: true }, 'Passet är inställt')} />
          </>
        )}
        {s.status === 'cancelled' && <Button small variant="secondary" title="Kör passet ändå" onPress={() => update({ cancelled: false }, 'Passet körs')} />}
      </Row>
      {data.notice ? (
        <Card style={{ backgroundColor: data.notice.acknowledged >= data.notice.recipients ? colors.okSoft : colors.warnSoft, borderWidth: 0 }}>
          <Text style={{ fontWeight: '700' }}>
            {data.notice.acknowledged} av {data.notice.recipients} har bekräftat
          </Text>
          {data.notice.missing.length ? <P muted style={{ fontSize: 13 }}>Inte bekräftat: {data.notice.missing.join(', ')}</P> : null}
          {data.notice.missing.length ? (
            <Button
              small
              variant="secondary"
              title="Påminn dem"
              onPress={async () => {
                const r = await api<{ reminded: number }>('notice', { method: 'POST', body: { id: data.notice!.id, action: 'remind' } });
                toast({ title: 'Påminnelse skickad', body: `Till ${r.reminded} personer.` });
              }}
              style={{ alignSelf: 'flex-start', marginTop: 6 }}
            />
          ) : null}
        </Card>
      ) : null}
      {data.roster.map((r) => {
        const [label, tone] = ST[r.status] ?? [r.status, 'neutral'];
        const cancelled = r.status.startsWith('cancelled');
        return (
          <Row key={r.id} style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
            <Text style={{ flex: 1, fontSize: 15, color: cancelled ? colors.muted : colors.ink }}>
              {r.name}
              {r.source !== 'ordinary' ? ' (extra)' : ''}
            </Text>
            <Pill tone={tone} text={label} />
            <Button small variant="ghost" title={cancelled ? 'Ångra' : 'Återbud'} onPress={() => booking(r.id, cancelled ? 'restore' : 'cancel_in_time')} />
          </Row>
        );
      })}
      {data.queue.length > 0 && <P muted style={{ marginTop: 6 }}>Kö: {data.queue.map((q) => q.name).join(', ')}</P>}
    </View>
  );
}

// ------------------------------------------------------------------ Anmälningar

interface RoundItem { id: string; name: string; registration_opens_at: string | null; registrations: number }
interface RegData {
  groups: { id: string; weekday: number; time: string; place: string; capacity: number; min_participants: number }[];
  registrations: { id: string; name: string; per_week: number; status: string; priority: boolean; existing: boolean; created_at: string }[];
  suggestion: Record<string, { groupIds: (string | null)[] }>;
  fill: Record<string, number>;
}

export function RegistrationsScreen() {
  const rounds = useApi<{ rounds: RoundItem[] }>('rounds');
  const round = rounds.data?.rounds.find((r) => r.registration_opens_at);
  const regs = useApi<RegData>(round ? `registrations?roundId=${round.id}` : null);
  const toast = useToast();
  if (!rounds.data) return <Loading error={rounds.error} />;
  if (!round) return <View><H1>Anmälningar</H1><Card><P>Ingen omgång har anmälan öppen. Skapa nästa omgång i admin på datorn.</P></Card></View>;
  if (!regs.data) return <Loading error={regs.error} />;
  const { groups, registrations, suggestion, fill } = regs.data;
  const pending = registrations.filter((r) => r.status === 'pending');
  const byId = new Map(groups.map((g) => [g.id, g]));

  return (
    <View>
      <H1>Anmälningar</H1>
      <P muted style={{ marginBottom: 12 }}>{round.name} · {registrations.length} anmälda</P>
      <Card>
        <H2>Platser med förslaget</H2>
        {groups.map((g) => (
          <View key={g.id} style={{ marginBottom: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '600' }}>{WD[g.weekday]} {g.time} · {g.place}</Text>
              <Text style={{ fontWeight: '700', color: fill[g.id] < g.min_participants ? colors.warn : colors.muted }}>
                {fill[g.id]}/{g.capacity}
              </Text>
            </Row>
            <Bar value={fill[g.id]} max={g.capacity} min={g.min_participants} />
          </View>
        ))}
      </Card>
      <H2>Att bekräfta ({pending.length})</H2>
      {pending.slice(0, 50).map((r) => (
        <Card key={r.id} style={{ paddingVertical: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '700' }}>{r.name}</Text>
            {r.priority ? <Pill tone="accent" text="förtur" /> : r.existing ? <Pill text="tränar nu" /> : <Pill tone="ok" text="ny" />}
          </Row>
          <P muted style={{ fontSize: 13 }}>
            {r.created_at} → {(suggestion[r.id]?.groupIds ?? []).map((id) => (id ? `${WD[byId.get(id)!.weekday]} ${byId.get(id)!.time}` : 'väntelista')).join(', ')}
          </P>
        </Card>
      ))}
      <Button
        title={pending.length ? `Bekräfta ${pending.length} enligt förslaget` : 'Alla är klara'}
        disabled={!pending.length}
        onPress={async () => {
          const decisions = pending.map((r) => {
            const ids = (suggestion[r.id]?.groupIds ?? []).filter(Boolean) as string[];
            return { id: r.id, groupIds: ids.length ? ids : null };
          });
          const res = await api<{ confirmed: number; waitlisted: number }>('registrations-confirm', { method: 'POST', body: { decisions } });
          toast({ title: 'Klart', body: `${res.confirmed} bekräftade, ${res.waitlisted} på väntelistan. Alla har fått besked.` });
          regs.reload();
        }}
        style={{ marginBottom: 8 }}
      />
      <P muted style={{ marginBottom: 20 }}>Vill du ändra enskilda platser gör du det i admin på datorn.</P>
    </View>
  );
}

// ------------------------------------------------------------------ Skicka notis

type Template = { label: string; title: string; body: string; page?: { heading: string; text: string; link?: string } };
const TEMPLATES: Template[] = [
  { label: 'Ändrad lokal', title: 'Ändrad lokal ikväll', body: 'Vi kör i Gymmet i stället för Ladan pga vädret. Rena inomhusskor!' },
  { label: 'Extrapass', title: 'SöndagsFYS igen?', body: 'Extrapass på söndag kl 17.00 om tillräckligt många anmäler sig. 140 kr eller ett klipp.' },
  { label: 'Lediga platser', title: 'Lediga platser kommande vecka', body: 'Det finns lediga platser kommande vecka. Boka med ditt tillgodo-pass i appen!' },
  { label: 'Anmälan öppen', title: 'Anmälan öppen till nästa omgång', body: 'Du som tränar nu har förtur. Anmäl dig i appen under Anmälan.' },
  {
    label: 'Gruppbeställning',
    title: 'Ny chans att beställa från ICIW',
    body: '30 % rabatt för StarkMamma. Tryck för att läsa hur du beställer.',
    page: {
      heading: 'Gruppbeställning från ICIW',
      text: 'Titta på hemsidan och skicka mig det du vill ha. Jag ser till att kläderna levereras hit, och du hämtar och betalar direkt till StarkMamma.\n\nDu får 30 % rabatt på ordinarie pris och 10 % på rea och outlet.',
      link: 'https://www.icaniwill.se',
    },
  },
];

export function PushScreen() {
  const round = useApi<{ groups: { id: string; weekday: number; time: string; place: string; members: number }[] }>('round');
  const toast = useToast();
  const [audience, setAudience] = useState('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [withPage, setWithPage] = useState(false);
  const [requireAck, setRequireAck] = useState(false);
  const [heading, setHeading] = useState('');
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const input = { borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 10, backgroundColor: colors.card } as const;

  const use = (t: Template) => {
    setTitle(t.title);
    setBody(t.body);
    setWithPage(!!t.page);
    setHeading(t.page?.heading ?? '');
    setText(t.page?.text ?? '');
    setLink(t.page?.link ?? '');
  };

  return (
    <View>
      <H1>Skicka notis</H1>
      <P muted style={{ marginBottom: 12 }}>Når deltagarna direkt i mobilen. Den som inte har appen får ett mejl.</P>
      <H2>Mottagare</H2>
      <Row style={{ flexWrap: 'wrap', marginBottom: 14 }}>
        <Chip label="Alla" active={audience === 'all'} onPress={() => setAudience('all')} />
        <Chip label="Ej betalt" active={audience === 'unpaid'} onPress={() => setAudience('unpaid')} />
        {(round.data?.groups ?? []).map((g) => (
          <Chip key={g.id} label={`${WD[g.weekday]} ${g.time}`} active={audience === `group:${g.id}`} onPress={() => setAudience(`group:${g.id}`)} />
        ))}
      </Row>
      <H2>Mallar</H2>
      <Row style={{ flexWrap: 'wrap', marginBottom: 14 }}>
        {TEMPLATES.map((t) => (
          <Chip key={t.label} label={t.label} active={title === t.title} onPress={() => use(t)} />
        ))}
      </Row>
      <TextInput placeholder="Rubrik" placeholderTextColor={colors.muted} value={title} onChangeText={setTitle} style={[input, { fontWeight: '700' }]} />
      <TextInput placeholder="Meddelande" placeholderTextColor={colors.muted} value={body} onChangeText={setBody} multiline style={[input, { minHeight: 70, textAlignVertical: 'top' }]} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <H2>Informationssida</H2>
            <P muted>Öppnas när man trycker på notisen.</P>
          </View>
          <Chip label={withPage ? 'På' : 'Av'} active={withPage} onPress={() => setWithPage(!withPage)} />
        </Row>
        {withPage && (
          <View style={{ marginTop: 12 }}>
            <TextInput placeholder="Sidans rubrik" placeholderTextColor={colors.muted} value={heading} onChangeText={setHeading} style={[input, { fontWeight: '700' }]} />
            <TextInput placeholder="Text" placeholderTextColor={colors.muted} value={text} onChangeText={setText} multiline style={[input, { minHeight: 120, textAlignVertical: 'top' }]} />
            <TextInput placeholder="Länk (valfri), https://…" placeholderTextColor={colors.muted} value={link} onChangeText={setLink} autoCapitalize="none" style={input} />
          </View>
        )}
      </Card>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <H2>Kräv bekräftelse</H2>
            <P muted>Mottagarna trycker "Jag har läst", och du ser vilka som gjort det.</P>
          </View>
          <Chip label={requireAck ? 'På' : 'Av'} active={requireAck} onPress={() => setRequireAck(!requireAck)} />
        </Row>
      </Card>
      <Button
        title="Skicka"
        disabled={!title || !body || (withPage && (!heading || !text))}
        onPress={async () => {
          try {
            const r = await api<{ recipients: number }>('notices', {
              method: 'POST',
              body: { audience, title, body, requireAck, page: withPage ? { heading, text, link } : undefined },
            });
            toast({ title: 'Notisen är skickad', body: `Till ${r.recipients} personer.` });
            use({ label: '', title: '', body: '' });
            setRequireAck(false);
          } catch (e) {
            toast({ title: 'Det gick inte', body: (e as Error).message });
          }
        }}
        style={{ marginBottom: 20 }}
      />
    </View>
  );
}

// ------------------------------------------------------------------ Betalningar

interface AdminCharge { id: string; name: string; description: string; amount: number; due_on: string | null; status: string }

export function TrainerPayScreen() {
  const { data, error, reload } = useApi<{ charges: AdminCharge[] }>('charges?status=unpaid');
  const toast = useToast();
  if (!data) return <Loading error={error} />;
  const total = data.charges.reduce((a, c) => a + c.amount, 0);
  return (
    <View>
      <H1>Betalningar</H1>
      <Card>
        <P muted>Utestående</P>
        <H2 style={{ fontSize: 24, color: colors.warn }}>{total.toLocaleString('sv-SE')} kr</H2>
        <P muted>{data.charges.length} obetalda</P>
      </Card>
      <Button
        variant="secondary"
        title="Påminn alla som inte betalat"
        disabled={!data.charges.length}
        onPress={async () => {
          const r = await api<{ recipients: number }>('notices', {
            method: 'POST',
            body: { audience: 'unpaid', title: 'Påminnelse om betalning', body: 'Du har en obetald avgift hos StarkMamma. Betala enkelt med Swish under Betala i appen.' },
          });
          toast({ title: 'Påminnelse skickad', body: `Till ${r.recipients} personer.` });
        }}
        style={{ marginBottom: 14 }}
      />
      {data.charges.map((c) => (
        <Card key={c.id} style={{ paddingVertical: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700' }}>{c.name}</Text>
              <P muted style={{ fontSize: 13 }}>
                {c.description} · {c.amount} kr{c.due_on ? ` · ${shortDate(c.due_on)}` : ''}
              </P>
            </View>
            <Button
              small
              title="Betald"
              onPress={async () => {
                await api('charges-pay', { method: 'POST', body: { id: c.id, method: 'swish' } });
                reload();
              }}
            />
          </Row>
        </Card>
      ))}
    </View>
  );
}
