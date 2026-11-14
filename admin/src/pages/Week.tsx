import { useEffect, useMemo, useState } from 'react';
import { Person, Session, addDays, api, dayLabel, isoWeek, mondayOf, shortDate } from '../api';
import { SmsBox } from '../sms';

interface Roster {
  notice: {
    id: string; title: string; body: string; sent_at: string; recipients: number; acknowledged: number; missing: string[];
    missing_people: { name: string; phone: string | null }[];
  } | null;
  session: Session;
  roster: { id: string; name: string; phone: string | null; status: string; source: string }[];
  queue: { id: string; name: string; phone: string | null }[];
}

const STATUS: Record<string, [string, string]> = {
  booked: ['Bokad', ''],
  attending: ['Kommer', 'ok'],
  attended: ['Närvarade', 'ok'],
  cancelled_in_time: ['Återbud (tillgodo)', 'danger'],
  cancelled_late: ['Sent återbud', 'danger'],
  no_show: ['Kom inte', 'warn'],
};

export function WeekPage() {
  const [from, setFrom] = useState(() => mondayOf(new Date()));
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const loadWeek = () => api<{ sessions: Session[] }>(`week?from=${from}`).then((r) => setSessions(r.sessions));
  useEffect(() => {
    setSessions(null);
    loadWeek();
  }, [from]);

  const days = useMemo(() => {
    const m = new Map<string, Session[]>();
    for (const s of sessions ?? []) m.set(s.date, [...(m.get(s.date) ?? []), s]);
    return [...m.entries()];
  }, [sessions]);

  const upcoming = (sessions ?? []).filter((s) => s.status !== 'cancelled');
  const free = upcoming.reduce((a, s) => a + Math.max(0, s.capacity - s.booked), 0);
  const cancelled = upcoming.reduce((a, s) => a + s.cancelled, 0);
  const queue = upcoming.reduce((a, s) => a + s.queue, 0);

  return (
    <div className={open ? 'with-drawer' : ''}>
      <header className="page-head">
        <div>
          <h1>Vecka {isoWeek(from)}</h1>
          <p className="muted">
            {shortDate(from)} – {shortDate(addDays(from, 6))}
          </p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setFrom(addDays(from, -7))}>Föregående</button>
          <button className="btn" onClick={() => setFrom(mondayOf(new Date()))}>Denna vecka</button>
          <button className="btn" onClick={() => setFrom(addDays(from, 7))}>Nästa</button>
        </div>
      </header>

      <div className="stats">
        <Stat n={upcoming.length} label="pass" />
        <Stat n={free} label="lediga platser" tone="ok" />
        <Stat n={cancelled} label="återbud" tone="danger" />
        <Stat n={queue} label="i kö" tone="accent" />
      </div>

      {sessions === null ? (
        <p className="muted">Hämtar…</p>
      ) : days.length === 0 ? (
        <div className="card empty">Inga pass den här veckan.</div>
      ) : (
        <div className="week" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map(([date, list]) => (
            <section key={date} className="day">
              <h2>{dayLabel(date)}</h2>
              {list.map((s) => (
                <SessionCard key={s.id} s={s} active={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)} />
              ))}
            </section>
          ))}
        </div>
      )}

      {open && <Drawer id={open} onClose={() => setOpen(null)} onChanged={loadWeek} />}
    </div>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: string }) {
  return (
    <div className="card stat">
      <span className={`stat-n ${tone ?? ''}`}>{n}</span>
      <span className="muted">{label}</span>
    </div>
  );
}

function SessionCard({ s, active, onClick }: { s: Session; active: boolean; onClick: () => void }) {
  const free = s.capacity - s.booked;
  const pct = Math.min(100, (s.booked / s.capacity) * 100);
  return (
    <button className={`card session ${active ? 'active' : ''} ${s.status === 'cancelled' ? 'is-cancelled' : ''}`} onClick={onClick}>
      <div className="session-top">
        <span className="session-time">{s.time}</span>
        <span className="session-count">
          {s.booked}/{s.capacity}
        </span>
      </div>
      <div className="session-place">{s.place}</div>
      <div className="bar">
        <div className={`bar-fill ${free <= 0 ? 'full' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="chips">
        {s.status === 'moved' && <span className="chip warn">Flyttat</span>}
        {s.status === 'cancelled' && <span className="chip danger">Inställt</span>}
        {s.cancelled > 0 && <span className="chip danger">{s.cancelled} återbud</span>}
        {free > 0 && <span className="chip ok">{free} ledig{free > 1 ? 'a' : ''}</span>}
        {s.queue > 0 && <span className="chip accent">{s.queue} i kö</span>}
        {s.attending > 0 && <span className="chip">{s.attending} kommer</span>}
      </div>
    </button>
  );
}

const ACTIONS: { action: string; label: string; when: (status: string) => boolean }[] = [
  { action: 'cancel_in_time', label: 'Återbud (tillgodo)', when: (st) => !st.startsWith('cancelled') },
  { action: 'cancel_late', label: 'Sent återbud', when: (st) => !st.startsWith('cancelled') },
  { action: 'restore', label: 'Ångra återbud', when: (st) => st.startsWith('cancelled') },
  { action: 'attended', label: 'Närvarade', when: (st) => !st.startsWith('cancelled') && st !== 'attended' },
  { action: 'no_show', label: 'Kom inte', when: (st) => !st.startsWith('cancelled') && st !== 'no_show' },
];

function Drawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<Roster | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const load = () => api<Roster>(`session?id=${id}`).then(setData);
  useEffect(() => {
    setData(null);
    setEditing(false);
    load();
  }, [id]);

  const act = async (personId: string, action: string, source?: string) => {
    setError('');
    try {
      await api('booking', { method: 'POST', body: { sessionId: id, personId, action, source } });
      await load();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <aside className="drawer" aria-label="Pass">
      <button className="btn close" onClick={onClose}>Stäng</button>
      {!data ? (
        <p className="muted">Hämtar…</p>
      ) : (
        <>
          <h2>
            {dayLabel(data.session.date)} {data.session.time}
          </h2>
          <p className="muted">
            {data.session.place}
            {data.session.status === 'cancelled' ? ' · Inställt' : ''}
            {data.session.note ? ` · ${data.session.note}` : ''}
          </p>
          {editing ? (
            <EditSession
              session={data.session}
              onCancel={() => setEditing(false)}
              onSaved={async () => {
                setEditing(false);
                await load();
                onChanged();
              }}
            />
          ) : (
            <button className="btn small" onClick={() => setEditing(true)}>Ändra tid, lokal eller ställ in</button>
          )}
          {error && <p className="error">{error}</p>}
          {data.notice && <AckBox notice={data.notice} onReminded={load} />}

          <h3>Deltagare ({data.roster.filter((r) => !r.status.startsWith('cancelled')).length}/{data.session.capacity})</h3>
          <table className="table compact">
            <tbody>
              {data.roster.map((r) => {
                const [label, tone] = STATUS[r.status] ?? [r.status, ''];
                return (
                  <tr key={r.id} className={r.status.startsWith('cancelled') ? 'dim' : ''}>
                    <td>
                      {r.name}
                      {r.source !== 'ordinary' && <span className="chip accent small">extra</span>}
                      <div className="muted small-text">{r.phone}</div>
                    </td>
                    <td>
                      <span className={`chip ${tone}`}>{label}</span>
                    </td>
                    <td className="right">
                      <select
                        aria-label={`Ändra ${r.name}`}
                        className="mini"
                        value=""
                        onChange={(e) => e.target.value && act(r.id, e.target.value)}
                      >
                        <option value="">Ändra…</option>
                        {ACTIONS.filter((a) => a.when(r.status)).map((a) => (
                          <option key={a.action} value={a.action}>{a.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <AddPerson existing={new Set(data.roster.map((r) => r.id))} onAdd={(pid, source) => act(pid, 'add', source)} />

          {data.queue.length > 0 && (
            <>
              <h3>Kö</h3>
              <ol className="queue">
                {data.queue.map((q) => (
                  <li key={q.id}>
                    {q.name} <span className="muted">{q.phone}</span>{' '}
                    <button className="link" onClick={() => act(q.id, 'add', 'drop_in')}>Lägg till</button>
                    <button className="link" onClick={() => act(q.id, 'queue_remove')}>Ta bort</button>
                  </li>
                ))}
              </ol>
            </>
          )}
        </>
      )}
    </aside>
  );
}

function EditSession({ session, onCancel, onSaved }: { session: Session; onCancel: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(session.date);
  const [time, setTime] = useState(session.time.replace('.', ':'));
  const [place, setPlace] = useState(session.place);
  const [cancelled, setCancelled] = useState(session.status === 'cancelled');
  const [note, setNote] = useState('');
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState('');
  const save = async () => {
    setError('');
    try {
      await api('session', { method: 'PUT', body: { id: session.id, date, time, place, cancelled, note, notify } });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="card edit form">
      <div className="row">
        <div style={{ flex: 1 }}>
          <label htmlFor="e-date">Datum</label>
          <input id="e-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div style={{ width: 110 }}>
          <label htmlFor="e-time">Tid</label>
          <input id="e-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <label htmlFor="e-place">Lokal</label>
      <select id="e-place" value={place} onChange={(e) => setPlace(e.target.value)}>
        <option>Gymmet</option>
        <option>Ladan</option>
      </select>
      <label className="toggle">
        <input type="checkbox" checked={cancelled} onChange={(e) => setCancelled(e.target.checked)} /> Ställ in passet
      </label>
      <label htmlFor="e-note">Meddelande (valfritt)</label>
      <input id="e-note" value={note} placeholder="T.ex. pga vädret" onChange={(e) => setNote(e.target.value)} />
      <label className="toggle">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Skicka notis till de bokade
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="btn primary" onClick={save}>Spara</button>
        <button className="btn" onClick={onCancel}>Avbryt</button>
      </div>
    </div>
  );
}

function AddPerson({ existing, onAdd }: { existing: Set<string>; onAdd: (personId: string, source: string) => void }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('drop_in');
  const open = people !== null;
  const matches = (people ?? [])
    .filter((p) => p.status === 'active' && !existing.has(p.id))
    .filter((p) => query.length > 1 && p.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 6);
  if (!open)
    return (
      <button className="btn small" onClick={() => api<{ people: Person[] }>('people').then((r) => setPeople(r.people))}>
        Lägg till person på passet
      </button>
    );
  return (
    <div className="card edit form">
      <label htmlFor="add-q">Lägg till person</label>
      <input id="add-q" autoFocus placeholder="Sök namn" value={query} onChange={(e) => setQuery(e.target.value)} />
      <label htmlFor="add-src">Betalas med</label>
      <select id="add-src" value={source} onChange={(e) => setSource(e.target.value)}>
        <option value="drop_in">Drop-in (140 kr läggs till under Betalningar)</option>
        <option value="credit">Tillgodo-pass</option>
        <option value="punch_card">Klipp på klippkort</option>
      </select>
      {matches.map((p) => (
        <button key={p.id} className="btn small" onClick={() => { onAdd(p.id, source); setPeople(null); setQuery(''); }}>
          Lägg till {p.name}
        </button>
      ))}
    </div>
  );
}

function AckBox({ notice, onReminded }: { notice: NonNullable<Roster['notice']>; onReminded: () => void }) {
  const [msg, setMsg] = useState('');
  const done = notice.acknowledged >= notice.recipients;
  return (
    <div className={`card ack ${done ? 'ok' : 'warn'}`}>
      <strong>
        {notice.title}: {notice.acknowledged} av {notice.recipients} har bekräftat
      </strong>
      {!done && <p className="muted small-text">Inte bekräftat: {notice.missing.join(', ')}</p>}
      {!done && (
        <button
          className="btn small"
          onClick={async () => {
            const r = await api<{ reminded: number }>('notice', { method: 'POST', body: { id: notice.id, action: 'remind' } });
            setMsg(`Påminnelse skickad till ${r.reminded}.`);
            onReminded();
          }}
        >
          Påminn dem som inte bekräftat
        </button>
      )}
      {msg && <p className="ok-text">{msg}</p>}
      {!done && <SmsBox people={notice.missing_people} text={`StarkMamma: ${notice.body} Bekräfta gärna i appen. /Emma`} />}
    </div>
  );
}
