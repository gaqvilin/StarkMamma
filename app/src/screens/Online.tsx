// Onlineträning (pass i text och film för den som har tillgång) och utmaningar (bingo).
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api, shortDate } from '../api';
import { useApi } from '../auth';
import { colors } from '../theme';
import { useToast } from '../toast';
import { Button, Card, H1, H2, P, Pill, Row } from '../ui';

interface Workout {
  id: string;
  program_id: string;
  title: string;
  body: string | null;
  has_video: boolean;
  duration_min: number | null;
  publish_on: string | null;
  done: boolean;
}
interface OnlineData {
  programs: { id: string; name: string; description: string | null }[];
  workouts: Workout[];
  upcoming: { n: number; next: string | null };
  offers: { id: string; name: string; description: string | null; price: number; starts_on: string | null; ends_on: string | null; ordered: boolean }[];
}
interface ChallengeData {
  challenges: { id: string; name: string; description: string | null; prize: string | null; starts_on: string; ends_on: string; active: boolean; won: boolean }[];
  tasks: { id: string; challenge_id: string; sort: number; text: string; done_on: string | null }[];
}

export function OnlineScreen() {
  const online = useApi<OnlineData>('my-online');
  const bingo = useApi<ChallengeData>('my-challenges');
  const [open, setOpen] = useState<Workout | null>(null);
  const toast = useToast();

  const setDone = async (w: Workout, done: boolean) => {
    try {
      await api('my-online', { method: 'POST', body: { workoutId: w.id, action: done ? 'done' : 'undo' } });
      online.reload();
      if (open?.id === w.id) setOpen({ ...w, done });
      if (done) toast({ title: 'Bra jobbat!', body: `${w.title} är avbockat.` });
    } catch (e) {
      toast({ title: 'Det gick inte', body: (e as Error).message });
    }
  };

  if (open) return <WorkoutView w={open} onBack={() => setOpen(null)} onDone={setDone} />;
  if (!online.data || !bingo.data) return <P muted style={{ marginTop: 20 }}>{online.error || bingo.error || 'Hämtar…'}</P>;
  const { programs, workouts, upcoming, offers } = online.data;

  return (
    <View>
      <H1>Online</H1>

      {bingo.data.challenges.map((c) => (
        <Bingo key={c.id} challenge={c} tasks={bingo.data!.tasks.filter((t) => t.challenge_id === c.id)} onChanged={bingo.reload} />
      ))}

      {programs.map((p) => {
        const list = workouts.filter((w) => w.program_id === p.id);
        const done = list.filter((w) => w.done).length;
        return (
          <View key={p.id} style={{ marginBottom: 8 }}>
            <H2 style={{ marginTop: 8 }}>{p.name}</H2>
            <P muted style={{ marginBottom: 10 }}>
              {done} av {list.length} pass gjorda
              {upcoming.n ? ` · nästa pass kommer ${upcoming.next ? shortDate(upcoming.next) : 'snart'}` : ''}
            </P>
            {list.map((w) => (
              <Pressable key={w.id} onPress={() => setOpen(w)} accessibilityRole="button">
                <Card style={{ paddingVertical: 12 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', fontSize: 15, color: w.done ? colors.muted : colors.ink }}>{w.title}</Text>
                      <Row style={{ marginTop: 4, flexWrap: 'wrap' }}>
                        {w.has_video ? <Pill tone="accent" text="Film" /> : <Pill text="Text" />}
                        {w.duration_min ? <Pill text={`${w.duration_min} min`} /> : null}
                        {w.done ? <Pill tone="ok" text="Klar" /> : null}
                      </Row>
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 20 }}>›</Text>
                  </Row>
                </Card>
              </Pressable>
            ))}
            {!list.length && <P muted>Inga pass publicerade än.</P>}
          </View>
        );
      })}

      {offers.map((o) => (
        <Card key={o.id} style={{ backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }}>
          <H2>{o.name}</H2>
          {o.starts_on ? (
            <P muted>
              {shortDate(o.starts_on)}
              {o.ends_on ? `–${shortDate(o.ends_on)}` : ''}
            </P>
          ) : null}
          {o.description ? <P style={{ marginTop: 6 }}>{o.description}</P> : null}
          {o.ordered ? (
            <P style={{ marginTop: 10, fontWeight: '700' }}>Beställd. Betala under Betala, så får du tillgång när Emma sett betalningen.</P>
          ) : (
            <Button
              title={o.price ? `Köp för ${o.price} kr` : 'Gå med'}
              onPress={async () => {
                try {
                  const r = await api<{ access?: boolean }>('my-online', { method: 'POST', body: { programId: o.id, action: 'buy' } });
                  toast(r.access ? { title: 'Välkommen!', body: 'Du har nu tillgång till passen.' } : { title: 'Beställd', body: 'Betala med Swish under Betala.' });
                  online.reload();
                } catch (e) {
                  toast({ title: 'Det gick inte', body: (e as Error).message });
                }
              }}
              style={{ marginTop: 12 }}
            />
          )}
        </Card>
      ))}

      {!programs.length && !offers.length && !bingo.data.challenges.length && (
        <Card>
          <P>Ingen onlineträning eller utmaning just nu. Du får en notis när något nytt startar.</P>
        </Card>
      )}
    </View>
  );
}

function WorkoutView({ w, onBack, onDone }: { w: Workout; onBack: () => void; onDone: (w: Workout, done: boolean) => void }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  // Länken hämtas först när man trycker, och för uppladdade filmer gäller den bara några timmar.
  const play = async () => {
    setLoading(true);
    try {
      const { url } = await api<{ url: string }>(`video-play?workoutId=${w.id}`);
      await WebBrowser.openBrowserAsync(url);
    } catch (e) {
      toast({ title: 'Filmen gick inte att öppna', body: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };
  return (
    <View>
      <Button small variant="ghost" title="Tillbaka" onPress={onBack} style={{ alignSelf: 'flex-start', paddingHorizontal: 0, marginBottom: 6 }} />
      <H1>{w.title}</H1>
      <Row style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        {w.duration_min ? <Pill text={`${w.duration_min} min`} /> : null}
        {w.done ? <Pill tone="ok" text="Klar" /> : null}
      </Row>
      {w.has_video ? (
        <Button title={loading ? 'Öppnar filmen…' : 'Spela filmen och träna med Emma'} disabled={loading} onPress={play} style={{ marginBottom: 16 }} />
      ) : null}
      {(w.body ?? '').split(/\n\n+/).map((para, i) => (
        <P key={i} style={{ marginBottom: 12, fontSize: 16, lineHeight: 24 }}>{para}</P>
      ))}
      {w.done ? (
        <Button variant="secondary" title="Ångra klar" onPress={() => onDone(w, false)} style={{ marginBottom: 20 }} />
      ) : (
        <Button title="Markera som klar" onPress={() => onDone(w, true)} style={{ marginBottom: 20 }} />
      )}
    </View>
  );
}

function Bingo({ challenge, tasks, onChanged }: { challenge: ChallengeData['challenges'][number]; tasks: ChallengeData['tasks']; onChanged: () => void }) {
  const toast = useToast();
  const done = tasks.filter((t) => t.done_on).length;
  const full = done === tasks.length && tasks.length > 0;
  const toggle = async (t: ChallengeData['tasks'][number]) => {
    if (!challenge.active) return;
    try {
      await api('my-challenges', { method: 'POST', body: { taskId: t.id, done: !t.done_on } });
      onChanged();
    } catch (e) {
      toast({ title: 'Det gick inte', body: (e as Error).message });
    }
  };
  return (
    <Card style={{ borderColor: colors.ink }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <H2 style={{ flex: 1 }}>{challenge.name}</H2>
        <Pill tone={full ? 'ok' : 'accent'} text={`${done}/${tasks.length}`} />
      </Row>
      <P muted>
        {shortDate(challenge.starts_on)}–{shortDate(challenge.ends_on)}
        {challenge.prize ? ` · Vinst: ${challenge.prize}` : ''}
      </P>
      {challenge.description ? <P style={{ marginTop: 6 }}>{challenge.description}</P> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {tasks.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => toggle(t)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!t.done_on }}
            style={{
              width: '31%',
              minHeight: 96,
              borderRadius: 10,
              padding: 8,
              borderWidth: 1,
              borderColor: t.done_on ? colors.ok : colors.line,
              backgroundColor: t.done_on ? colors.okSoft : colors.card,
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ fontSize: 12, color: colors.ink }} numberOfLines={5}>
              {t.text}
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '800', color: t.done_on ? colors.ok : colors.muted }}>
              {t.done_on ? `Klar ${shortDate(t.done_on)}` : 'Tryck när klar'}
            </Text>
          </Pressable>
        ))}
      </View>
      {challenge.won ? (
        <P style={{ marginTop: 12, fontWeight: '800', color: colors.accent }}>Du har vunnit! Emma hör av sig.</P>
      ) : full ? (
        <P style={{ marginTop: 12, fontWeight: '700', color: colors.ok }}>Full bricka! Du är med i utlottningen.</P>
      ) : !challenge.active ? (
        <P muted style={{ marginTop: 12 }}>Utmaningen är avslutad.</P>
      ) : null}
    </Card>
  );
}
