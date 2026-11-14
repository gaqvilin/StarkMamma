import { useEffect, useMemo, useState } from 'react';
import { WD_SHORT, api } from '../api';

interface Round {
  id: string;
  name: string;
  registration_opens_at: string | null;
  priority_until: string | null;
  registrations: number;
  starts_on: string;
}
interface G {
  id: string;
  weekday: number;
  time: string;
  place: string;
  capacity: number;
  min_participants: number;
  filled: number;
}
interface Reg {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  per_week: number;
  installments: boolean;
  friend_name: string | null;
  status: 'pending' | 'confirmed' | 'waitlist';
  created_at: string;
  existing: boolean;
  priority: boolean;
  account_status: string;
  assigned_group_ids: string[] | null;
  choices: { slot: number; rank: number; group_id: string }[];
}
interface Data {
  round: Round;
  groups: G[];
  registrations: Reg[];
  suggestion: Record<string, { groupIds: (string | null)[]; complete: boolean }>;
  fill: Record<string, number>;
  demand: Record<string, { first: number; second: number }>;
}

const label = (g?: G) => (g ? `${WD_SHORT[g.weekday]} ${g.time}` : '–');

export function RegistrationsPage() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [roundId, setRoundId] = useState('');
  const [data, setData] = useState<Data | null>(null);
  const [plan, setPlan] = useState<Record<string, (string | null)[]>>({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ rounds: Round[] }>('rounds').then((r) => {
      const withReg = r.rounds.filter((x) => x.registration_opens_at);
      setRounds(withReg);
      if (withReg[0]) setRoundId(withReg[0].id);
    });
  }, []);
  const load = () =>
    api<Data>(`registrations?roundId=${roundId}`).then((d) => {
      setData(d);
      setPlan(Object.fromEntries(Object.entries(d.suggestion).map(([id, s]) => [id, s.groupIds])));
    });
  useEffect(() => {
    if (roundId) load();
  }, [roundId]);

  const byId = useMemo(() => new Map((data?.groups ?? []).map((g) => [g.id, g])), [data]);
  const fill = useMemo(() => {
    const f: Record<string, number> = Object.fromEntries((data?.groups ?? []).map((g) => [g.id, g.filled]));
    for (const ids of Object.values(plan)) for (const id of ids) if (id) f[id] = (f[id] ?? 0) + 1;
    return f;
  }, [plan, data]);

  if (!rounds.length) return <div className="card empty">Ingen omgång har anmälan. Skapa en ny omgång under Omgångar.</div>;
  const pending = (data?.registrations ?? []).filter((r) => r.status === 'pending');
  const ordered = [...pending].sort((a, b) => Number(b.priority) - Number(a.priority) || a.created_at.localeCompare(b.created_at));
  const done = (data?.registrations ?? []).filter((r) => r.status !== 'pending');

  const confirm = async () => {
    setBusy(true);
    setMsg('');
    const decisions = pending.map((r) => {
      const ids = (plan[r.id] ?? []).filter(Boolean) as string[];
      return { id: r.id, groupIds: ids.length ? ids : null };
    });
    const res = await api<{ confirmed: number; waitlisted: number }>('registrations-confirm', { method: 'POST', body: { decisions } });
    setMsg(`${res.confirmed} bekräftade och ${res.waitlisted} på väntelistan. Alla har fått en notis, och betalningskraven ligger under Betalningar.`);
    setBusy(false);
    load();
  };

  return (
    <div>
      <header className="page-head">
        <div>
          <h1>Anmälan</h1>
          {data && (
            <p className="muted">
              Öppnar {data.round.registration_opens_at ?? '–'} · förtur till {data.round.priority_until ?? '–'}
            </p>
          )}
        </div>
        <select value={roundId} onChange={(e) => setRoundId(e.target.value)} style={{ width: 'auto' }}>
          {rounds.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </header>
      {msg && <p className="ok-text">{msg}</p>}

      {data && (
        <>
          <div className="card table-wrap">
            <div className="pad-head">
              <h2>Översikt per pass</h2>
              <p className="muted small-text">
                Max styr bara förslaget. Anmälan begränsas aldrig, och du kan alltid placera fler än max i listan nedan. Du har sista ordet.
              </p>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Pass</th>
                  <th className="right">Sökt 1:a hand</th>
                  <th className="right">Sökt 2:a hand</th>
                  <th className="right">Max</th>
                  <th style={{ width: '28%' }}>Placerade</th>
                </tr>
              </thead>
              <tbody>
                {data.groups.map((g) => {
                  const n = fill[g.id] ?? 0;
                  const d = data.demand[g.id] ?? { first: 0, second: 0 };
                  const over = n > g.capacity;
                  return (
                    <tr key={g.id}>
                      <td className="strong nowrap">
                        {label(g)} <span className="muted">{g.place}</span>
                      </td>
                      <td className={`right strong ${d.first > g.capacity ? 'danger-text' : ''}`}>{d.first}</td>
                      <td className="right">{d.second}</td>
                      <td className="right">
                        <MaxInput group={g} onSaved={load} />
                      </td>
                      <td>
                        <div className="row" style={{ justifyContent: 'space-between' }}>
                          <span className={`strong ${over ? 'danger-text' : n < g.min_participants ? 'warn-text' : ''}`}>
                            {n} av {g.capacity}
                            {over ? ' (över max)' : n < g.min_participants ? ` (under ${g.min_participants})` : ''}
                          </span>
                        </div>
                        <div className="bar">
                          <div className={`bar-fill ${over ? 'full' : n < g.min_participants ? 'low' : ''}`} style={{ width: `${Math.min(100, (n / g.capacity) * 100)}%` }} />
                          <div className="bar-min" style={{ left: `${Math.min(100, (g.min_participants / g.capacity) * 100)}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <header className="page-head section">
            <div>
              <h2>Att fördela ({pending.length})</h2>
              <p className="muted">
                Förslaget följer max per pass: nuvarande deltagare med förtur först, sedan exakt anmälningstid, och första- före andrahandsval.
                Ändra fritt, även över max.
              </p>
            </div>
            <button className="btn primary" disabled={!pending.length || busy} onClick={confirm}>
              Bekräfta alla och skicka besked
            </button>
          </header>
          <div className="card table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Person</th>
                  <th>Anmäld</th>
                  <th>Önskemål</th>
                  <th>Plats</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((r, i) => (
                  <tr key={r.id}>
                    <td className="muted">{i + 1}</td>
                    <td>
                      <div className="strong nowrap">{r.name}</div>
                      <div className="chips">
                        {r.priority ? <span className="chip accent">förtur</span> : r.existing ? <span className="chip">tränar nu</span> : <span className="chip ok">ny</span>}
                        <span className="chip">{r.per_week}/v</span>
                        {r.installments && <span className="chip">delbetalning</span>}
                        {r.friend_name && <span className="chip">med {r.friend_name}</span>}
                        {r.account_status === 'pending' && <span className="chip warn">nytt konto</span>}
                      </div>
                    </td>
                    <td className="muted nowrap small-text">{r.created_at}</td>
                    <td className="small-text">
                      {Array.from({ length: r.per_week }, (_, slot) => (
                        <div key={slot}>
                          {r.choices.filter((c) => c.slot === slot).sort((a, b) => a.rank - b.rank).map((c) => label(byId.get(c.group_id))).join(' / ')}
                        </div>
                      ))}
                    </td>
                    <td>
                      {Array.from({ length: r.per_week }, (_, slot) => {
                        const value = plan[r.id]?.[slot] ?? '';
                        const first = r.choices.find((c) => c.slot === slot && c.rank === 1)?.group_id;
                        return (
                          <select
                            key={slot}
                            className={`mini ${!value ? 'danger-text' : value !== first ? 'warn-text' : ''}`}
                            value={value}
                            onChange={(e) =>
                              setPlan((p) => ({ ...p, [r.id]: (p[r.id] ?? []).map((v, k) => (k === slot ? e.target.value || null : v)) }))
                            }
                          >
                            <option value="">Väntelista</option>
                            {data.groups.map((g) => (
                              <option key={g.id} value={g.id}>
                                {label(g)} {g.place} ({fill[g.id] ?? 0}/{g.capacity}{(fill[g.id] ?? 0) >= g.capacity && value !== g.id ? ', fullt' : ''})
                              </option>
                            ))}
                          </select>
                        );
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!pending.length && <p className="muted pad">Inga nya anmälningar att fördela.</p>}
          </div>

          {done.length > 0 && (
            <>
              <h2 className="section">Klara ({done.length})</h2>
              <div className="card table-wrap">
                <table className="table">
                  <tbody>
                    {done.map((r) => (
                      <tr key={r.id}>
                        <td className="strong">{r.name}</td>
                        <td>{r.status === 'confirmed' ? <span className="chip ok">Bekräftad</span> : <span className="chip warn">Väntelista</span>}</td>
                        <td className="muted">{(r.assigned_group_ids ?? []).map((id) => label(byId.get(id))).join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function MaxInput({ group, onSaved }: { group: G; onSaved: () => void }) {
  const [value, setValue] = useState(String(group.capacity));
  const [error, setError] = useState('');
  useEffect(() => setValue(String(group.capacity)), [group.capacity]);
  const save = async () => {
    if (Number(value) === group.capacity) return;
    setError('');
    try {
      await api('groups', { method: 'PUT', body: { id: group.id, capacity: Number(value) } });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setValue(String(group.capacity));
    }
  };
  return (
    <span>
      <input
        aria-label={`Max för ${label(group)}`}
        className="max-input"
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      {error && <span className="error small-text"> {error}</span>}
    </span>
  );
}
