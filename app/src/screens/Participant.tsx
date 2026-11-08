import React, { useMemo, useState } from 'react';
import { Linking, Platform, Text, TextInput, View } from 'react-native';
import {
  ME,
  NOW,
  Occurrence,
  PRICES,
  creditDeadline,
  dateLabel,
  groupById,
  groupLabel,
  groups,
  occurrences,
  startOf,
} from '../data';
import { useStore } from '../store';
import { subscribeWebPush, webPushSupport } from '../webpush';
import { colors } from '../theme';
import { Bar, Button, Card, Chip, H1, H2, P, Pill, Row } from '../ui';

const fmtTime = (d: Date) =>
  `${d.getDate()}/${d.getMonth() + 1} kl ${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}.${String(d.getSeconds()).padStart(2, '0')}`;

const placeInfo = (o: Occurrence) =>
  o.place === 'Gymmet'
    ? 'Gymmet: endast rena inomhusskor. Ta med svetthandduk & vattenflaska.'
    : 'Ladan: klä dig i lager-på-lager. Fodrade handskar rekommenderas när det är kallt.';

type Store = ReturnType<typeof useStore>;
const notify = (s: Store, title: string, body: string) => s.dispatch({ type: 'toast', title, body });

// ------------------------------------------------------------------ Hem

export function HomeScreen() {
  const s = useStore();
  const upcoming = useMemo(
    () =>
      occurrences.filter(
        (o) => startOf(o) > NOW && (ME.groups.includes(o.groupId) || s.extra[o.id]),
      ),
    [s.extra],
  );
  const next = upcoming.find((o) => !s.cancelled[o.id]);

  return (
    <View>
      <H1>Hej {ME.name.split(' ')[0]}!</H1>
      <P muted style={{ marginBottom: 14 }}>CT-omgång v 45–51 · vecka {upcoming[0]?.week ?? 51}</P>

      <Row style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        <Pill tone="accent" text={`${s.credits} pass tillgodo`} />
        <Pill text={`10-kort: ${s.punchLeft} klipp kvar`} />
      </Row>

      <PushPrompt />

      {next && (
        <Card style={{ borderColor: colors.ink, borderWidth: 2 }}>
          <P muted>Nästa pass</P>
          <H2 style={{ fontSize: 22, marginTop: 2 }}>
            {dateLabel(next.date)} · {next.time}
          </H2>
          <Row style={{ marginBottom: 8 }}>
            <Pill text={next.place} tone="neutral" />
            {next.moved && <Pill text={next.moved} tone="warn" />}
            {s.extra[next.id] && <Pill text={`Bokat med ${s.extra[next.id]}`} tone="accent" />}
          </Row>
          <P muted style={{ marginBottom: 12 }}>{placeInfo(next)}</P>
          {s.attending[next.id] ? (
            <Pill tone="ok" text="Du har svarat att du kommer" />
          ) : (
            <Row>
              <Button title="Jag kommer" onPress={() => s.dispatch({ type: 'attend', occ: next })} style={{ flex: 1 }} />
              <Button title="Kommer inte" variant="secondary" onPress={() => cancel(s, next)} style={{ flex: 1 }} />
            </Row>
          )}
        </Card>
      )}

      <H2 style={{ marginTop: 8 }}>Mina kommande pass</H2>
      {upcoming.map((o) => (
        <SessionRow key={o.id} o={o} />
      ))}
    </View>
  );
}

function PushPrompt() {
  const s = useStore();
  const [hidden, setHidden] = useState(false);
  const support = webPushSupport();
  if (hidden || Platform.OS !== 'web' || support === 'unsupported' || support === 'subscribed') return null;
  return (
    <Card style={{ backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }}>
      <H2>Få besked direkt i mobilen</H2>
      {support === 'needs-install' ? (
        <P>På iPhone: tryck på Dela-knappen i Safari och välj "Lägg till på hemskärmen". Öppna sedan StarkMamma därifrån och slå på notiser.</P>
      ) : support === 'denied' ? (
        <P>Notiser är avstängda för StarkMamma. Slå på dem i webbläsarens inställningar.</P>
      ) : (
        <>
          <P style={{ marginBottom: 10 }}>Lediga platser, ändrad lokal och påminnelser kommer som notiser.</P>
          <Button
            small
            title="Slå på notiser"
            onPress={async () => {
              const sub = await subscribeWebPush();
              notify(s, sub ? 'Notiser påslagna' : 'Notiser', sub ? 'Du får nu besked från StarkMamma.' : 'I den riktiga appen ber webbläsaren nu om lov att visa notiser.');
              setHidden(true);
            }}
          />
        </>
      )}
    </Card>
  );
}

function cancel(s: Store, o: Occurrence) {
  const ok = NOW < creditDeadline(o);
  s.dispatch({ type: 'cancel', occ: o });
  notify(
    s,
    'Återbud registrerat',
    ok
      ? 'Du lämnade återbud i tid – passet ligger tillgodo och kan användas på ett annat pass i denna omgång.'
      : 'Sent återbud (samma dag) – passet brinner inne. Platsen erbjuds nu till kön.',
  );
}

function SessionRow({ o }: { o: Occurrence }) {
  const s = useStore();
  const c = s.cancelled[o.id];
  return (
    <Card style={{ paddingVertical: 12 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', fontSize: 15, color: c ? colors.muted : colors.ink, textDecorationLine: c ? 'line-through' : 'none' }}>
            {dateLabel(o.date)} · {o.time}
          </Text>
          <Row style={{ marginTop: 4, flexWrap: 'wrap' }}>
            <Pill text={o.place} />
            {o.moved && <Pill text={o.moved} tone="warn" />}
            {s.extra[o.id] && <Pill text={`Extra (${s.extra[o.id]})`} tone="accent" />}
            {c === 'tillgodo' && <Pill text="Återbud · tillgodo" tone="ok" />}
            {c === 'sent' && <Pill text="Sent återbud" tone="danger" />}
          </Row>
        </View>
        {c ? (
          <Button small variant="ghost" title="Ångra" onPress={() => s.dispatch({ type: 'undoCancel', occ: o })} />
        ) : s.extra[o.id] ? (
          <Button small variant="secondary" title="Avboka" onPress={() => s.dispatch({ type: 'unbook', occ: o })} />
        ) : (
          <Button small variant="secondary" title="Återbud" onPress={() => cancel(s, o)} />
        )}
      </Row>
    </Card>
  );
}

// ------------------------------------------------------------------ Boka / byt

export function BookScreen() {
  const s = useStore();
  const list = occurrences.filter(
    (o) => startOf(o) > NOW && !ME.groups.includes(o.groupId) && o.week <= 47,
  );
  const byDate = new Map<string, Occurrence[]>();
  list.forEach((o) => {
    const k = dateLabel(o.date);
    byDate.set(k, [...(byDate.get(k) ?? []), o]);
  });

  return (
    <View>
      <H1>Boka pass</H1>
      <P muted style={{ marginBottom: 12 }}>
        Använd ett tillgodo-pass (gäller bara inom omgången) eller ett klipp på 10-kortet. Är passet fullt kan du ställa dig i kö – du får en notis direkt när en plats blir ledig.
      </P>
      <Row style={{ marginBottom: 14 }}>
        <Pill tone="accent" text={`${s.credits} tillgodo`} />
        <Pill text={`${s.punchLeft} klipp`} />
      </Row>

      {[...byDate.entries()].map(([day, occs]) => (
        <View key={day} style={{ marginBottom: 6 }}>
          <Text style={{ fontWeight: '800', fontSize: 13, color: colors.muted, marginBottom: 6, textTransform: 'uppercase' }}>{day}</Text>
          {occs.map((o) => {
            const booked = s.bookedCount(o);
            const cap = s.capacity(o);
            const free = cap - booked;
            const mine = s.extra[o.id];
            const queued = s.waitlist.includes(o.id);
            return (
              <Card key={o.id} style={{ paddingVertical: 12 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', fontSize: 15 }}>
                      {o.time} · {o.place}
                    </Text>
                    <Text style={{ color: free > 0 ? colors.ok : colors.muted, fontSize: 13, marginTop: 2 }}>
                      {mine ? `Bokad (${mine})` : free > 0 ? `${free} lediga platser` : queued ? 'Du står i kö' : 'Fullt'}
                    </Text>
                  </View>
                  {mine ? (
                    <Button small variant="secondary" title="Avboka" onPress={() => s.dispatch({ type: 'unbook', occ: o })} />
                  ) : free > 0 ? (
                    s.credits > 0 ? (
                      <Button small title="Boka (tillgodo)" onPress={() => s.dispatch({ type: 'book', occ: o, source: 'tillgodo' })} />
                    ) : s.punchLeft > 0 ? (
                      <Button small title="Boka (klipp)" onPress={() => s.dispatch({ type: 'book', occ: o, source: 'klippkort' })} />
                    ) : (
                      <Button small title="Boka 140 kr" onPress={() => s.dispatch({ type: 'book', occ: o, source: 'drop-in' })} />
                    )
                  ) : queued ? (
                    <Button small variant="ghost" title="Lämna kön" onPress={() => s.dispatch({ type: 'leaveWaitlist', occ: o })} />
                  ) : (
                    <Button small variant="secondary" title="Ställ i kö" onPress={() => s.dispatch({ type: 'joinWaitlist', occ: o })} />
                  )}
                </Row>
              </Card>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ------------------------------------------------------------------ Anmälan ny omgång

export function SignupScreen() {
  const s = useStore();
  const [perWeek, setPerWeek] = useState<1 | 2 | 3>(1);
  const [choices, setChoices] = useState<string[][]>([['tis-1845', '']]);
  const [friend, setFriend] = useState('');
  const [installments, setInstallments] = useState(false);

  const setPer = (n: 1 | 2 | 3) => {
    setPerWeek(n);
    setChoices((c) => Array.from({ length: n }, (_, i) => c[i] ?? ['', '']));
    if (n === 1) setInstallments(false);
  };
  const pick = (slot: number, rank: 0 | 1, gid: string) =>
    setChoices((c) => c.map((pair, i) => (i === slot ? pair.map((v, r) => (r === rank ? (v === gid ? '' : gid) : v)) : pair)));

  const valid = choices.every((p) => p[0]);

  if (s.mySignup) {
    const m = s.mySignup;
    return (
      <View>
        <H1>Din anmälan</H1>
        <Card>
          <Pill tone="warn" text="Väntar på Emmas bekräftelse" />
          <P style={{ marginTop: 10 }}>Mottagen <Text style={{ fontWeight: '800' }}>{fmtTime(m.at)}</Text> – exakt tid avgör ordningen.</P>
          <P muted style={{ marginTop: 6 }}>{m.perWeek} gång(er)/vecka · {PRICES[m.perWeek]} kr{m.installments ? ' · delbetalning' : ''}</P>
          {m.choices.map((pair, i) => (
            <View key={i} style={{ marginTop: 10 }}>
              <Text style={{ fontWeight: '700' }}>Pass {i + 1}</Text>
              <P>1:a hand: {groupLabel(groupById(pair[0]))}</P>
              {pair[1] ? <P muted>2:a hand: {groupLabel(groupById(pair[1]))}</P> : null}
            </View>
          ))}
          {m.friend ? <P style={{ marginTop: 10 }}>Tillsammans med: {m.friend}</P> : null}
        </Card>
        <P muted>Du får en pushnotis när din plats är bekräftad, med betalningsinfo och Swish-knapp.</P>
      </View>
    );
  }

  return (
    <View>
      <H1>Anmälan</H1>
      <Card style={{ backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }}>
        <H2>CT-omgång v 2–8 2027</H2>
        <P>Förtur för dig som tränar nu – öppen till tis 10/11 kl 20.00. Därefter släpps lediga platser till nya.</P>
        <P muted style={{ marginTop: 6 }}>Minst 14 anmälda krävs för att en grupp ska köras. Inget är klart förrän Emma bekräftat.</P>
      </Card>

      <H2>Hur ofta vill du träna?</H2>
      <Row style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        {([1, 2, 3] as const).map((n) => (
          <Chip key={n} label={`${n} gång${n > 1 ? 'er' : ''}/v · ${PRICES[n]} kr`} active={perWeek === n} onPress={() => setPer(n)} />
        ))}
      </Row>

      {choices.map((pair, slot) => (
        <Card key={slot}>
          <H2>Pass {slot + 1}</H2>
          {([0, 1] as const).map((rank) => (
            <View key={rank} style={{ marginBottom: 10 }}>
              <Text style={{ fontWeight: '700', color: colors.muted, marginBottom: 6 }}>{rank === 0 ? 'Förstahandsval' : 'Andrahandsval (om fullt)'}</Text>
              <Row style={{ flexWrap: 'wrap' }}>
                {groups.map((g) => {
                  const takenElsewhere = choices.some((p, i) => i !== slot && p[0] === g.id);
                  return (
                    <Chip
                      key={g.id}
                      label={`${['', 'Mån', 'Tis', 'Ons', 'Tors', 'Fre'][g.weekday]} ${g.time}`}
                      active={pair[rank] === g.id}
                      onPress={() => !takenElsewhere && pick(slot, rank, g.id)}
                    />
                  );
                })}
              </Row>
            </View>
          ))}
        </Card>
      ))}

      <Card>
        <H2>Träna med en kompis?</H2>
        <TextInput
          placeholder="Kompisens namn (valfritt)"
          value={friend}
          onChangeText={setFriend}
          style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, fontSize: 15 }}
        />
        <P muted style={{ marginTop: 6 }}>Ni hamnar i samma grupp i mån av plats.</P>
      </Card>

      {perWeek > 1 && (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <H2>Delbetala</H2>
              <P muted>699 kr senast 22/12, resten senast 22/1.</P>
            </View>
            <Chip label={installments ? 'Ja' : 'Nej'} active={installments} onPress={() => setInstallments(!installments)} />
          </Row>
        </Card>
      )}

      <Button
        title="Skicka anmälan"
        disabled={!valid}
        onPress={() => s.dispatch({ type: 'signup', signup: { perWeek, choices, friend, installments, at: new Date() } })}
        style={{ marginBottom: 20 }}
      />
    </View>
  );
}

// ------------------------------------------------------------------ Betalningar

export function PayScreen() {
  const s = useStore();
  const mine = s.payments.filter((p) => p.name === ME.name);

  const swish = (amount: number, msg: string) => {
    const data = encodeURIComponent(
      JSON.stringify({ version: 1, payee: { value: 'STARKMAMMA' }, amount: { value: amount }, message: { value: msg } }),
    );
    const url = `swish://payment?data=${data}`;
    if (Platform.OS === 'web') notify(s, 'Swish', `I appen öppnas Swish nu med ${amount} kr och meddelandet "${msg}" ifyllt.`);
    else Linking.openURL(url).catch(() => notify(s, 'Swish', 'Swish är inte installerat.'));
  };

  return (
    <View>
      <H1>Betalningar</H1>
      {mine.map((p) => (
        <Card key={p.id}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', fontSize: 15 }}>{p.what}</Text>
              <P muted>{p.amount} kr · senast {p.due}</P>
            </View>
            <Pill tone={p.paid ? 'ok' : 'warn'} text={p.paid ? 'Betald' : 'Att betala'} />
          </Row>
          <View style={{ marginTop: 12 }}>
            {p.paid ? (
              <Button small variant="secondary" title="Visa kvitto (friskvård)" onPress={() => notify(s, 'Kvitto', `${p.what}\n${p.amount} kr – StarkMamma\nKvittot kan laddas ner som PDF för friskvårdsbidrag.`)} />
            ) : (
              <Button small title={`Betala ${p.amount} kr med Swish`} onPress={() => swish(p.amount, `${ME.name} ${p.what}`.slice(0, 50))} />
            )}
          </View>
        </Card>
      ))}
      <Card>
        <H2>10-kort</H2>
        <P>{s.punchLeft} av 10 klipp kvar · giltigt till 14/3 2027</P>
        <Bar value={s.punchLeft} max={10} />
      </Card>
    </View>
  );
}

// ------------------------------------------------------------------ Notiser

export function InboxScreen() {
  const s = useStore();
  return (
    <View>
      <H1>Notiser</H1>
      {s.inbox.map((n) => (
        <Card key={n.id}>
          <Text style={{ fontWeight: '700', fontSize: 15 }}>{n.title}</Text>
          <P style={{ marginTop: 4 }}>{n.body}</P>
          <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
            <P muted style={{ fontSize: 12 }}>{fmtTime(n.at)}</P>
            {n.page ? <Button small variant="secondary" title="Läs mer" onPress={() => s.dispatch({ type: 'openNotice', id: n.id })} /> : null}
          </Row>
        </Card>
      ))}
    </View>
  );
}

// ------------------------------------------------------------------ Informationssida

export function InfoPageScreen() {
  const s = useStore();
  const n = s.inbox.find((x) => x.id === s.openNotice);
  if (!n?.page) return null;
  const { heading, text, link } = n.page;
  return (
    <View>
      <Button small variant="ghost" title="Tillbaka" onPress={() => s.dispatch({ type: 'closeNotice' })} style={{ alignSelf: 'flex-start', paddingHorizontal: 0, marginBottom: 6 }} />
      <H1>{heading}</H1>
      <P muted style={{ marginBottom: 16 }}>Från Emma · {fmtTime(n.at)}</P>
      {text.split(/\n\n+/).map((para, i) => (
        <P key={i} style={{ marginBottom: 12, fontSize: 16, lineHeight: 24 }}>{para}</P>
      ))}
      {link ? (
        <Button
          variant="secondary"
          title="Öppna länk"
          onPress={() => Linking.openURL(link).catch(() => notify(s, 'Länk', link))}
          style={{ marginTop: 8, marginBottom: 20 }}
        />
      ) : null}
    </View>
  );
}
