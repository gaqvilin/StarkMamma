// Deltagarens vyer, kopplade till API:et.
import React, { useState } from 'react';
import { Linking, Platform, Text, TextInput, View } from 'react-native';
import { Bookable, Charge, MySession, Notice, User, WD, WD_LONG, api, dayLabel, shortDate } from '../api';
import { useApi, useAuth } from '../auth';
import { colors } from '../theme';
import { useToast } from '../toast';
import { Bar, Button, Card, Chip, H1, H2, P, Pill, Row } from '../ui';

const placeInfo = (place: string) =>
  place === 'Ladan'
    ? 'Ladan: klä dig i lager-på-lager. Fodrade handskar rekommenderas när det är kallt.'
    : 'Gymmet: endast rena inomhusskor. Ta med svetthandduk och vattenflaska.';

function Loading({ error }: { error?: string }) {
  return <P muted style={{ marginTop: 20 }}>{error || 'Hämtar…'}</P>;
}

const STATUS_LABEL: Record<string, [string, 'ok' | 'warn' | 'danger' | 'accent' | 'neutral']> = {
  attending: ['Du kommer', 'ok'],
  attended: ['Närvarade', 'ok'],
  cancelled_in_time: ['Återbud · tillgodo', 'ok'],
  cancelled_late: ['Sent återbud', 'danger'],
};

// ------------------------------------------------------------------ Hem

interface Schedule {
  user: User;
  sessions: MySession[];
  credits: number;
  punch: number;
  punch_valid: string | null;
}

export function HomeScreen() {
  const { data, error, reload } = useApi<Schedule>('my-schedule');
  const toast = useToast();
  if (!data) return <Loading error={error} />;
  const upcoming = data.sessions;
  const next = upcoming.find((s) => !s.my_status.startsWith('cancelled') && s.status !== 'cancelled');

  const act = async (s: MySession, action: 'cancel' | 'undo' | 'attend') => {
    try {
      const r = await api<{ status?: string; credit?: boolean }>('my-booking', { method: 'POST', body: { sessionId: s.id, action } });
      if (action === 'cancel')
        toast(
          r.credit
            ? { title: 'Återbud registrerat', body: 'Du lämnade återbud i tid. Passet ligger tillgodo och kan användas på ett annat pass i omgången.' }
            : { title: 'Sent återbud', body: 'Återbud samma dag ger inget tillgodo. Platsen erbjuds till kön.' },
        );
      reload();
    } catch (e) {
      toast({ title: 'Det gick inte', body: (e as Error).message });
    }
  };

  return (
    <View>
      <H1>Hej {data.user.name.split(' ')[0]}!</H1>
      <Row style={{ marginBottom: 14, flexWrap: 'wrap', marginTop: 6 }}>
        <Pill tone="accent" text={`${data.credits} pass tillgodo`} />
        {data.punch > 0 ? <Pill text={`Klippkort: ${data.punch} klipp kvar`} /> : null}
      </Row>

      {next ? (
        <Card style={{ borderColor: colors.ink, borderWidth: 2 }}>
          <P muted>Nästa pass</P>
          <H2 style={{ fontSize: 22, marginTop: 2 }}>
            {dayLabel(next.date)} · {next.time}
          </H2>
          <Row style={{ marginBottom: 8, flexWrap: 'wrap' }}>
            <Pill text={next.place} />
            {next.status === 'moved' ? <Pill text={next.note ?? 'Flyttat'} tone="warn" /> : null}
            {!next.ordinary ? <Pill text="Extrapass" tone="accent" /> : null}
          </Row>
          <P muted style={{ marginBottom: 12 }}>{placeInfo(next.place)}</P>
          {next.my_status === 'attending' ? (
            <Row style={{ justifyContent: 'space-between' }}>
              <Pill tone="ok" text="Du har svarat att du kommer" />
              <Button small variant="ghost" title="Kommer inte" onPress={() => act(next, 'cancel')} />
            </Row>
          ) : (
            <Row>
              <Button title="Jag kommer" onPress={() => act(next, 'attend')} style={{ flex: 1 }} />
              <Button title="Kommer inte" variant="secondary" onPress={() => act(next, 'cancel')} style={{ flex: 1 }} />
            </Row>
          )}
        </Card>
      ) : (
        <Card>
          <P>Du har inga kommande pass just nu.</P>
        </Card>
      )}

      <H2 style={{ marginTop: 8 }}>Mina kommande pass</H2>
      {upcoming.map((s) => {
        const cancelled = s.my_status.startsWith('cancelled');
        const [label, tone] = STATUS_LABEL[s.my_status] ?? ['', 'neutral'];
        return (
          <Card key={s.id} style={{ paddingVertical: 12 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 15, color: cancelled || s.status === 'cancelled' ? colors.muted : colors.ink, textDecorationLine: cancelled || s.status === 'cancelled' ? 'line-through' : 'none' }}>
                  {dayLabel(s.date)} · {s.time}
                </Text>
                <Row style={{ marginTop: 4, flexWrap: 'wrap' }}>
                  <Pill text={s.place} />
                  {s.status === 'cancelled' ? <Pill text="Inställt" tone="danger" /> : null}
                  {s.status === 'moved' ? <Pill text="Flyttat" tone="warn" /> : null}
                  {!s.ordinary ? <Pill text="Extra" tone="accent" /> : null}
                  {label ? <Pill text={label} tone={tone} /> : null}
                </Row>
              </View>
              {s.status === 'cancelled' ? null : cancelled ? (
                s.ordinary && s.my_status === 'cancelled_in_time' ? <Button small variant="ghost" title="Ångra" onPress={() => act(s, 'undo')} /> : null
              ) : (
                <Button small variant="secondary" title={s.ordinary ? 'Återbud' : 'Avboka'} onPress={() => act(s, 'cancel')} />
              )}
            </Row>
          </Card>
        );
      })}
      <P muted style={{ marginTop: 4, marginBottom: 12 }}>Lämna återbud senast dagen innan så får du passet tillgodo.</P>
    </View>
  );
}

// ------------------------------------------------------------------ Boka

export function BookScreen() {
  const list = useApi<{ sessions: Bookable[] }>('bookable');
  const me = useApi<Schedule>('my-schedule');
  const toast = useToast();
  if (!list.data || !me.data) return <Loading error={list.error || me.error} />;
  const { credits, punch } = me.data;

  const act = async (s: Bookable, action: string, source?: string) => {
    try {
      await api('my-booking', { method: 'POST', body: { sessionId: s.id, action, source } });
      if (action === 'book') toast({ title: 'Bokat', body: `${dayLabel(s.date)} kl ${s.time} i ${s.place}.` });
      if (action === 'queue') toast({ title: 'Du står i kö', body: 'Du får en notis om en plats blir ledig.' });
      list.reload();
      me.reload();
    } catch (e) {
      toast({ title: 'Det gick inte', body: (e as Error).message });
    }
  };

  const byDate = new Map<string, Bookable[]>();
  list.data.sessions.forEach((s) => byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]));

  return (
    <View>
      <H1>Boka pass</H1>
      <P muted style={{ marginBottom: 12 }}>
        Boka med ett tillgodo-pass (gäller ordinarie pass i omgången), ett klipp eller drop-in för 140 kr. Är passet fullt kan du ställa dig i kö.
      </P>
      <Row style={{ marginBottom: 14 }}>
        <Pill tone="accent" text={`${credits} tillgodo`} />
        <Pill text={`${punch} klipp`} />
      </Row>
      {[...byDate.entries()].map(([date, sessions]) => (
        <View key={date} style={{ marginBottom: 6 }}>
          <Text style={{ fontWeight: '800', fontSize: 13, color: colors.muted, marginBottom: 6, textTransform: 'uppercase' }}>{dayLabel(date)}</Text>
          {sessions.map((s) => {
            const free = s.capacity - s.booked;
            const source = s.kind === 'ordinary' && credits > 0 ? 'credit' : punch > 0 ? 'punch_card' : 'drop_in';
            const bookLabel = { credit: 'Boka (tillgodo)', punch_card: 'Boka (klipp)', drop_in: `Boka ${s.price ?? 140} kr` }[source];
            return (
              <Card key={s.id} style={{ paddingVertical: 12 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', fontSize: 15 }}>
                      {s.time} · {s.place}
                    </Text>
                    <Text style={{ color: free > 0 && !s.mine ? colors.ok : colors.muted, fontSize: 13, marginTop: 2 }}>
                      {s.mine ? 'Du är bokad' : free > 0 ? `${free} ledig${free > 1 ? 'a' : ''} plats${free > 1 ? 'er' : ''}` : s.queued ? 'Du står i kö' : 'Fullt'}
                      {s.kind !== 'ordinary' ? ' · extrapass' : ''}
                    </Text>
                  </View>
                  {s.mine ? (
                    <Button small variant="secondary" title="Avboka" onPress={() => act(s, 'cancel')} />
                  ) : free > 0 ? (
                    <Button small title={bookLabel} onPress={() => act(s, 'book', source)} />
                  ) : s.queued ? (
                    <Button small variant="ghost" title="Lämna kön" onPress={() => act(s, 'unqueue')} />
                  ) : (
                    <Button small variant="secondary" title="Ställ i kö" onPress={() => act(s, 'queue')} />
                  )}
                </Row>
              </Card>
            );
          })}
        </View>
      ))}
      {!list.data.sessions.length && <P muted>Inga pass att boka de närmaste två veckorna.</P>}
    </View>
  );
}

// ------------------------------------------------------------------ Anmälan

interface RegGroup {
  id: string;
  weekday: number;
  time: string;
  place: string;
}
interface RegInfo {
  round: null | {
    id: string; name: string; phase: 'not_open' | 'priority' | 'open'; eligible: boolean; existing: boolean;
    opens_at: string | null; priority_until: string | null; pay_deadline: string | null; starts_on: string; ends_on: string;
  };
  groups: RegGroup[];
  prices: { per_week: 1 | 2 | 3; price: number; first_installment: number | null }[];
  registration: null | {
    id: string; per_week: number; status: string; created_at: string; friend_name: string | null; installments: boolean;
    assigned_group_ids: string[] | null; choices: { slot: number; rank: number; group_id: string }[];
  };
}

const glabel = (g?: RegGroup) => (g ? `${WD_LONG[g.weekday]} ${g.time} · ${g.place}` : '');

export function SignupScreen() {
  const { data, error, reload } = useApi<RegInfo>('my-registration');
  const [editing, setEditing] = useState(false);
  if (!data) return <Loading error={error} />;
  const { round, registration } = data;
  if (!round)
    return (
      <View>
        <H1>Anmälan</H1>
        <Card>
          <P>Ingen anmälan är öppen just nu. Du får en notis när nästa omgång öppnar.</P>
        </Card>
      </View>
    );
  const byId = new Map(data.groups.map((g) => [g.id, g]));

  if (registration && !editing) {
    const st = registration.status;
    return (
      <View>
        <H1>Din anmälan</H1>
        <Card>
          <H2>{round.name}</H2>
          <Pill
            tone={st === 'confirmed' ? 'ok' : st === 'waitlist' ? 'warn' : 'accent'}
            text={st === 'confirmed' ? 'Bekräftad' : st === 'waitlist' ? 'Väntelista' : 'Väntar på Emmas bekräftelse'}
          />
          <P style={{ marginTop: 10 }}>
            Mottagen <Text style={{ fontWeight: '800' }}>{registration.created_at}</Text>. Exakt tid avgör ordningen.
          </P>
          {st === 'confirmed' && registration.assigned_group_ids ? (
            <View style={{ marginTop: 10 }}>
              <Text style={{ fontWeight: '700' }}>Dina grupper</Text>
              {registration.assigned_group_ids.map((id) => (
                <P key={id}>{glabel(byId.get(id))}</P>
              ))}
            </View>
          ) : (
            Array.from({ length: registration.per_week }, (_, slot) => {
              const c = registration.choices.filter((x) => x.slot === slot).sort((a, b) => a.rank - b.rank);
              return (
                <View key={slot} style={{ marginTop: 10 }}>
                  <Text style={{ fontWeight: '700' }}>Pass {slot + 1}</Text>
                  <P>1:a hand: {glabel(byId.get(c[0]?.group_id))}</P>
                  {c[1] ? <P muted>2:a hand: {glabel(byId.get(c[1].group_id))}</P> : null}
                </View>
              );
            })
          )}
          {registration.friend_name ? <P style={{ marginTop: 10 }}>Tillsammans med: {registration.friend_name}</P> : null}
        </Card>
        {st === 'pending' && <Button variant="secondary" title="Ändra önskemål" onPress={() => setEditing(true)} />}
      </View>
    );
  }

  if (!round.eligible)
    return (
      <View>
        <H1>Anmälan</H1>
        <Card style={{ backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }}>
          <H2>{round.name}</H2>
          <P>
            {round.phase === 'not_open'
              ? `Anmälan öppnar ${round.opens_at}.`
              : `Just nu har de som redan tränar förtur, fram till ${round.priority_until}. Därefter kan du anmäla dig.`}
          </P>
        </Card>
      </View>
    );

  return <SignupForm info={data} onDone={() => { setEditing(false); reload(); }} />;
}

function SignupForm({ info, onDone }: { info: RegInfo; onDone: () => void }) {
  const toast = useToast();
  const round = info.round!;
  const existing = info.registration;
  const [perWeek, setPerWeek] = useState<1 | 2 | 3>((existing?.per_week as 1 | 2 | 3) ?? 1);
  const initial = existing
    ? Array.from({ length: existing.per_week }, (_, slot) =>
        [1, 2].map((rank) => existing.choices.find((c) => c.slot === slot && c.rank === rank)?.group_id ?? ''),
      )
    : [['', '']];
  const [choices, setChoices] = useState<string[][]>(initial);
  const [friend, setFriend] = useState(existing?.friend_name ?? '');
  const [installments, setInstallments] = useState(existing?.installments ?? false);
  const [busy, setBusy] = useState(false);
  const tier = info.prices.find((p) => p.per_week === perWeek);

  const setPer = (n: 1 | 2 | 3) => {
    setPerWeek(n);
    setChoices((c) => Array.from({ length: n }, (_, i) => c[i] ?? ['', '']));
    if (n === 1) setInstallments(false);
  };
  const pick = (slot: number, rank: 0 | 1, gid: string) =>
    setChoices((c) => c.map((pair, i) => (i === slot ? pair.map((v, r) => (r === rank ? (v === gid ? '' : gid) : v)) : pair)));
  const valid = choices.every((p) => p[0]) && new Set(choices.map((p) => p[0])).size === perWeek;

  return (
    <View>
      <H1>Anmälan</H1>
      <Card style={{ backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }}>
        <H2>{round.name}</H2>
        <P>
          {shortDate(round.starts_on)} – {shortDate(round.ends_on)}.{' '}
          {round.phase === 'priority' ? `Du har förtur fram till ${round.priority_until}.` : 'Anmälan är öppen för alla.'}
        </P>
        <P muted style={{ marginTop: 6 }}>Inget är klart förrän Emma bekräftat din plats.</P>
      </Card>

      <H2>Hur ofta vill du träna?</H2>
      <Row style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        {info.prices.map((p) => (
          <Chip key={p.per_week} label={`${p.per_week} gång${p.per_week > 1 ? 'er' : ''}/v · ${p.price} kr`} active={perWeek === p.per_week} onPress={() => setPer(p.per_week)} />
        ))}
      </Row>

      {choices.map((pair, slot) => (
        <Card key={slot}>
          <H2>Pass {slot + 1}</H2>
          {([0, 1] as const).map((rank) => (
            <View key={rank} style={{ marginBottom: 10 }}>
              <Text style={{ fontWeight: '700', color: colors.muted, marginBottom: 6 }}>{rank === 0 ? 'Förstahandsval' : 'Andrahandsval (om fullt)'}</Text>
              <Row style={{ flexWrap: 'wrap' }}>
                {info.groups.map((g) => (
                  <Chip key={g.id} label={`${WD[g.weekday]} ${g.time}`} active={pair[rank] === g.id} onPress={() => pick(slot, rank, g.id)} />
                ))}
              </Row>
            </View>
          ))}
        </Card>
      ))}

      <Card>
        <H2>Träna med en kompis?</H2>
        <TextInput
          placeholder="Kompisens namn (valfritt)"
          placeholderTextColor={colors.muted}
          value={friend}
          onChangeText={setFriend}
          style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, fontSize: 15 }}
        />
        <P muted style={{ marginTop: 6 }}>Ni hamnar i samma grupp i mån av plats.</P>
      </Card>

      {perWeek > 1 && tier?.first_installment ? (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <H2>Delbetala</H2>
              <P muted>{tier.first_installment} kr först, resten senare.</P>
            </View>
            <Chip label={installments ? 'Ja' : 'Nej'} active={installments} onPress={() => setInstallments(!installments)} />
          </Row>
        </Card>
      ) : null}

      <Button
        title={existing ? 'Spara ändringar' : 'Skicka anmälan'}
        disabled={!valid || busy}
        onPress={async () => {
          setBusy(true);
          try {
            await api('my-registration', {
              method: 'POST',
              body: { roundId: round.id, perWeek, choices: choices.map((p) => p.filter(Boolean)), friendName: friend, installments },
            });
            toast({ title: 'Anmälan mottagen', body: 'Du får en notis när Emma bekräftat din plats.' });
            onDone();
          } catch (e) {
            toast({ title: 'Det gick inte', body: (e as Error).message });
          } finally {
            setBusy(false);
          }
        }}
        style={{ marginBottom: 20 }}
      />
    </View>
  );
}

// ------------------------------------------------------------------ Betala

/**
 * Öppnar Swish-appen med mottagare, belopp och meddelande ifyllda och låsta.
 * Swish tillåter högst 50 tecken i meddelandet och bara vissa tecken.
 */
export function swishUrl(payee: string, amount: number, message: string) {
  const clean = message.replace(/[–—]/g, '-').replace(/[^A-Za-zÅÄÖåäöÉéÜü0-9 .,:;!?()\-+/&%'"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 50);
  const data = {
    version: 1,
    payee: { value: payee.replace(/\D/g, '') },
    amount: { value: amount, editable: false },
    message: { value: clean, editable: false },
  };
  return `swish://payment?data=${encodeURIComponent(JSON.stringify(data))}`;
}

export function PayScreen() {
  const { data, error, reload } = useApi<{ charges: Charge[]; swish: string | null }>('my-charges');
  const me = useApi<Schedule>('my-schedule');
  const { user } = useAuth();
  const toast = useToast();
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  if (!data) return <Loading error={error} />;
  const unpaid = data.charges.filter((c) => c.status === 'unpaid');
  const paid = data.charges.filter((c) => c.status === 'paid');

  const pay = async (c: Charge) => {
    if (!data.swish) return toast({ title: 'Swish', body: 'Swish-numret är inte inlagt än. Fråga Emma.' });
    const msg = `${user?.name ?? ''} ${c.description}`;
    setOpened((o) => ({ ...o, [c.id]: true }));
    if (Platform.OS === 'web')
      return toast({ title: 'Swish', body: `Swisha ${c.amount} kr till ${data.swish} med meddelandet "${msg.slice(0, 50)}".` });
    try {
      await Linking.openURL(swishUrl(data.swish, c.amount, msg));
    } catch {
      toast({ title: 'Swish är inte installerat', body: `Swisha ${c.amount} kr till ${data.swish} med meddelandet "${msg.slice(0, 50)}".` });
    }
  };

  const report = async (c: Charge) => {
    try {
      await api('my-charges', { method: 'POST', body: { id: c.id } });
      toast({ title: 'Tack!', body: 'Emma markerar betalningen när hon sett den, sedan kommer kvittot här.' });
      reload();
    } catch (e) {
      toast({ title: 'Det gick inte', body: (e as Error).message });
    }
  };

  return (
    <View>
      <H1>Betala</H1>
      {unpaid.map((c) => (
        <Card key={c.id}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', fontSize: 15 }}>{c.description}</Text>
              <P muted>
                {c.amount} kr{c.due_on ? ` · senast ${shortDate(c.due_on)}` : ''}
              </P>
            </View>
            <Pill tone={c.reported ? 'accent' : 'warn'} text={c.reported ? 'Swishad' : 'Att betala'} />
          </Row>
          {c.reported ? (
            <P muted style={{ marginTop: 10 }}>Du har swishat. Emma markerar betalningen när hon sett den, och sedan kommer kvittot här.</P>
          ) : (
            <>
              <Button title={`Betala ${c.amount} kr med Swish`} onPress={() => pay(c)} style={{ marginTop: 12 }} />
              {opened[c.id] ? (
                <Button variant="secondary" title="Jag har swishat" onPress={() => report(c)} style={{ marginTop: 8 }} />
              ) : (
                <P muted style={{ marginTop: 6, fontSize: 13 }}>Swish öppnas med belopp och meddelande ifyllda. Du godkänner bara.</P>
              )}
            </>
          )}
        </Card>
      ))}
      {!unpaid.length && (
        <Card>
          <P>Du har inget att betala just nu.</P>
        </Card>
      )}

      {me.data && me.data.punch > 0 ? (
        <Card>
          <H2>Klippkort</H2>
          <P>
            {me.data.punch} klipp kvar{me.data.punch_valid ? ` · giltigt till ${shortDate(me.data.punch_valid)}` : ''}
          </P>
          <Bar value={me.data.punch} max={10} />
        </Card>
      ) : null}

      {paid.length > 0 && (
        <>
          <H2 style={{ marginTop: 8 }}>Kvitton</H2>
          {paid.map((c) => (
            <Card key={c.id} style={{ paddingVertical: 12 }}>
              <Text style={{ fontWeight: '700' }}>{c.description}</Text>
              <P muted>
                {c.amount} kr · betald {c.paid_on ? shortDate(c.paid_on) : ''} · kvitto nr {c.receipt_number}
              </P>
            </Card>
          ))}
          <P muted style={{ marginBottom: 16 }}>Kvittona gäller för friskvårdsbidrag. Ta en skärmdump eller be Emma om en PDF.</P>
        </>
      )}
    </View>
  );
}

// ------------------------------------------------------------------ Notiser

const needsAck = (n: Notice) => n.requires_ack && !n.acknowledged;

export function InboxScreen({ notices, onOpen, onAck }: { notices: Notice[]; onOpen: (n: Notice) => void; onAck: (n: Notice) => void }) {
  return (
    <View>
      <H1>Notiser</H1>
      {notices.map((n) => (
        <Card key={n.id} style={needsAck(n) ? { borderColor: colors.warn, borderWidth: 2 } : !n.read ? { borderColor: colors.accent } : undefined}>
          {needsAck(n) ? <Pill tone="warn" text="Bekräfta att du läst" /> : null}
          <Text style={{ fontWeight: '700', fontSize: 15, marginTop: needsAck(n) ? 8 : 0 }}>{n.title}</Text>
          <P style={{ marginTop: 4 }}>{n.body}</P>
          <Row style={{ justifyContent: 'space-between', marginTop: 8, flexWrap: 'wrap' }}>
            <P muted style={{ fontSize: 12 }}>
              {n.sent_at}
              {n.requires_ack && n.acknowledged ? ' · bekräftad' : ''}
            </P>
            <Row>
              {n.page_heading ? <Button small variant="secondary" title="Läs mer" onPress={() => onOpen(n)} /> : null}
              {needsAck(n) ? <Button small title="Jag har läst" onPress={() => onAck(n)} /> : null}
            </Row>
          </Row>
        </Card>
      ))}
      {!notices.length && <P muted>Inga notiser än.</P>}
    </View>
  );
}

/** Viktiga notiser som väntar på bekräftelse visas överst på alla flikar tills de är bekräftade. */
export function ImportantNotices({ notices, onOpen, onAck }: { notices: Notice[]; onOpen: (n: Notice) => void; onAck: (n: Notice) => void }) {
  const pending = notices.filter(needsAck);
  if (!pending.length) return null;
  return (
    <View style={{ marginBottom: 6 }}>
      {pending.map((n) => (
        <Card key={n.id} style={{ backgroundColor: colors.warnSoft, borderColor: colors.warn, borderWidth: 2 }}>
          <Text style={{ fontWeight: '800', fontSize: 16 }}>{n.title}</Text>
          <P style={{ marginTop: 4 }}>{n.body}</P>
          <Row style={{ marginTop: 10, flexWrap: 'wrap' }}>
            <Button small title="Jag har läst" onPress={() => onAck(n)} />
            {n.page_heading ? <Button small variant="secondary" title="Läs mer" onPress={() => onOpen(n)} /> : null}
          </Row>
        </Card>
      ))}
    </View>
  );
}

export function InfoPageScreen({ notice, onBack, onAck }: { notice: Notice; onBack: () => void; onAck: (n: Notice) => void }) {
  const toast = useToast();
  return (
    <View>
      <Button small variant="ghost" title="Tillbaka" onPress={onBack} style={{ alignSelf: 'flex-start', paddingHorizontal: 0, marginBottom: 6 }} />
      <H1>{notice.page_heading}</H1>
      <P muted style={{ marginBottom: 16 }}>Från Emma · {notice.sent_at}</P>
      {(notice.page_text ?? '').split(/\n\n+/).map((para, i) => (
        <P key={i} style={{ marginBottom: 12, fontSize: 16, lineHeight: 24 }}>{para}</P>
      ))}
      {needsAck(notice) ? <Button title="Jag har läst" onPress={() => onAck(notice)} style={{ marginTop: 8 }} /> : null}
      {notice.requires_ack && notice.acknowledged ? <Pill tone="ok" text="Du har bekräftat att du läst" /> : null}
      {notice.page_link ? (
        <Button
          variant="secondary"
          title="Öppna länk"
          onPress={() => Linking.openURL(notice.page_link!).catch(() => toast({ title: 'Länk', body: notice.page_link! }))}
          style={{ marginTop: 8, marginBottom: 20 }}
        />
      ) : null}
    </View>
  );
}
