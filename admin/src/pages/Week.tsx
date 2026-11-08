import { useEffect, useMemo, useState } from 'react';
import { Session, addDays, api, dayLabel, isoWeek, mondayOf, shortDate } from '../api';

interface Roster {
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

  useEffect(() => {
    setSessions(null);
    api<{ sessions: Session[] }>(`week?from=${from}`).then((r) => setSessions(r.sessions));
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

      {open && <Drawer id={open} onClose={() => setOpen(null)} />}
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

function Drawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<Roster | null>(null);
  useEffect(() => {
    setData(null);
    api<Roster>(`session?id=${id}`).then(setData);
  }, [id]);

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
            {data.session.note ? ` · ${data.session.note}` : ''}
          </p>
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
                    </td>
                    <td className="muted">{r.phone}</td>
                    <td>
                      <span className={`chip ${tone}`}>{label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data.queue.length > 0 && (
            <>
              <h3>Kö</h3>
              <ol className="queue">
                {data.queue.map((q) => (
                  <li key={q.id}>
                    {q.name} <span className="muted">{q.phone}</span>
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
