import { FormEvent, useEffect, useState } from 'react';
import { Group, WEEKDAYS, api, shortDate } from '../api';

interface RoundData {
  round: { name: string; program: string; starts_on: string; ends_on: string; pay_deadline: string | null; installment_deadline: string | null } | null;
  prices: { per_week: number; price: number; first_installment: number | null }[];
  groups: Group[];
}

interface RoundListItem {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  registrations: number;
  sessions: number;
  registration_opens_at: string | null;
}

export function RoundPage() {
  const [rounds, setRounds] = useState<RoundListItem[]>([]);
  const [selected, setSelected] = useState('');
  const [data, setData] = useState<RoundData | null>(null);
  const [creating, setCreating] = useState(false);
  const loadRounds = () => api<{ rounds: RoundListItem[] }>('rounds').then((r) => setRounds(r.rounds));
  useEffect(() => {
    loadRounds();
  }, []);
  useEffect(() => {
    api<RoundData>(selected ? `round?id=${selected}` : 'round').then(setData);
  }, [selected]);
  if (!data) return <p className="muted">Hämtar…</p>;
  if (!data.round) return <div className="card empty">Ingen omgång är upplagd.</div>;
  const { round, prices, groups } = data;
  const currentId = selected || rounds.find((r) => r.name === round.name)?.id || '';
  const total = groups.reduce((a, g) => a + g.members, 0);
  const cap = groups.reduce((a, g) => a + g.capacity, 0);

  return (
    <div className={creating ? 'with-drawer' : ''}>
      <header className="page-head">
        <div>
          <h1>{round.name}</h1>
          <p className="muted">
            {round.program} · {shortDate(round.starts_on)} – {shortDate(round.ends_on)}
          </p>
        </div>
        <div className="row">
          <select value={currentId} onChange={(e) => setSelected(e.target.value)} style={{ width: 'auto' }}>
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <button className="btn primary" onClick={() => setCreating(true)}>Ny omgång</button>
        </div>
      </header>
      {creating && (
        <NewRound
          copyFrom={currentId}
          rounds={rounds}
          prices={prices}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            loadRounds();
            setSelected(id);
          }}
        />
      )}

      <div className="grid-2">
        <div className="card">
          <h2>Priser</h2>
          <table className="table compact">
            <tbody>
              {prices.map((p) => (
                <tr key={p.per_week}>
                  <td>{p.per_week} gång{p.per_week > 1 ? 'er' : ''}/vecka</td>
                  <td className="right strong">{p.price} kr</td>
                  <td className="muted right">{p.first_installment ? `delbetalning ${p.first_installment} kr + resten` : 'ingen delbetalning'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">
            Sista betalningsdag {round.pay_deadline ? shortDate(round.pay_deadline) : '–'}
            {round.installment_deadline ? `, resterande del senast ${shortDate(round.installment_deadline)}` : ''}.
          </p>
        </div>
        <div className="card">
          <h2>Beläggning</h2>
          <p className="big">
            {total} <span className="muted">av {cap} platser</span>
          </p>
          <p className="muted">
            Grupper under minimiantalet markeras med gult. Minst {groups[0]?.min_participants ?? 14} behövs för att en grupp ska köras. Max kan ändras i
            tabellen. Det styr förslag och bokningar i appen, men du kan alltid lägga till fler själv.
          </p>
        </div>
      </div>

      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Dag</th>
              <th>Tid</th>
              <th>Lokal</th>
              <th style={{ width: '40%' }}>Platser</th>
              <th className="right">Anmälda</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const low = g.members < g.min_participants;
              return (
                <tr key={g.id}>
                  <td className="strong">{WEEKDAYS[g.weekday]}</td>
                  <td>{g.time}</td>
                  <td>{g.place}</td>
                  <td>
                    <div className="bar">
                      <div className={`bar-fill ${low ? 'low' : g.members >= g.capacity ? 'full' : ''}`} style={{ width: `${Math.min(100, (g.members / g.capacity) * 100)}%` }} />
                      <div className="bar-min" style={{ left: `${(g.min_participants / g.capacity) * 100}%` }} />
                    </div>
                  </td>
                  <td className={`right strong nowrap ${low ? 'warn-text' : ''}`}>
                    {g.members} /{' '}
                    <MaxCell group={g} onSaved={() => api<RoundData>(selected ? `round?id=${selected}` : 'round').then(setData)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewRound({
  copyFrom,
  rounds,
  prices,
  onClose,
  onCreated,
}: {
  copyFrom: string;
  rounds: RoundListItem[];
  prices: RoundData['prices'];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [from, setFrom] = useState(copyFrom);
  const [firstMonday, setFirstMonday] = useState('');
  const [weeks, setWeeks] = useState('7');
  const [skip, setSkip] = useState('');
  const [tiers, setTiers] = useState(prices.map((p) => ({ ...p })));
  const [payDeadline, setPayDeadline] = useState('');
  const [installmentDeadline, setInstallmentDeadline] = useState('');
  const [opens, setOpens] = useState('');
  const [priority, setPriority] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const r = await api<{ id: string }>('rounds', {
        method: 'POST',
        body: {
          name, firstMonday, weeks: Number(weeks), copyFromRoundId: from,
          skipWeeks: skip.split(/[\s,]+/).filter(Boolean).map(Number),
          prices: tiers, payDeadline, installmentDeadline, registrationOpensAt: opens, priorityUntil: priority,
        },
      });
      onCreated(r.id);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <aside className="drawer">
      <button className="btn close" onClick={onClose}>Stäng</button>
      <h2>Ny omgång</h2>
      <p className="muted small-text">Grupperna och tiderna kopieras från en tidigare omgång. Enskilda pass kan flyttas eller ställas in i Veckan efteråt.</p>
      <form className="form" onSubmit={submit}>
        <label htmlFor="r-name">Namn</label>
        <input id="r-name" placeholder="CT-omgång v 2–8 2027" value={name} onChange={(e) => setName(e.target.value)} required />
        <label htmlFor="r-from">Kopiera grupper från</label>
        <select id="r-from" value={from} onChange={(e) => setFrom(e.target.value)}>
          {rounds.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <div className="row">
          <div style={{ flex: 1 }}>
            <label htmlFor="r-start">Första måndagen</label>
            <input id="r-start" type="date" value={firstMonday} onChange={(e) => setFirstMonday(e.target.value)} required />
          </div>
          <div style={{ width: 110 }}>
            <label htmlFor="r-weeks">Antal veckor</label>
            <input id="r-weeks" inputMode="numeric" value={weeks} onChange={(e) => setWeeks(e.target.value)} />
          </div>
        </div>
        <label htmlFor="r-skip">Uppehåll, veckonummer (valfritt)</label>
        <input id="r-skip" placeholder="t.ex. 8 för sportlov" value={skip} onChange={(e) => setSkip(e.target.value)} />

        <h3>Priser</h3>
        {tiers.map((t, i) => (
          <div className="row" key={t.per_week}>
            <span style={{ width: 90 }}>{t.per_week} gång{t.per_week > 1 ? 'er' : ''}/v</span>
            <input aria-label="Pris" style={{ width: 100 }} value={t.price} onChange={(e) => setTiers(tiers.map((x, k) => (k === i ? { ...x, price: Number(e.target.value) } : x)))} />
            <span className="muted small-text">kr</span>
            {t.per_week > 1 && (
              <>
                <input aria-label="Första delbetalning" style={{ width: 90 }} value={t.first_installment ?? ''} onChange={(e) => setTiers(tiers.map((x, k) => (k === i ? { ...x, first_installment: Number(e.target.value) || null } : x)))} />
                <span className="muted small-text">första delen</span>
              </>
            )}
          </div>
        ))}

        <div className="row">
          <div style={{ flex: 1 }}>
            <label htmlFor="r-pay">Sista betalningsdag</label>
            <input id="r-pay" type="date" value={payDeadline} onChange={(e) => setPayDeadline(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="r-inst">Resterande del senast</label>
            <input id="r-inst" type="date" value={installmentDeadline} onChange={(e) => setInstallmentDeadline(e.target.value)} />
          </div>
        </div>
        <h3>Anmälan</h3>
        <label htmlFor="r-open">Anmälan öppnar</label>
        <input id="r-open" type="datetime-local" value={opens} onChange={(e) => setOpens(e.target.value)} />
        <label htmlFor="r-prio">Förtur för nuvarande deltagare till</label>
        <input id="r-prio" type="datetime-local" value={priority} onChange={(e) => setPriority(e.target.value)} />
        <p className="muted small-text">När anmälan öppnar kan du skicka en notis under Notiser, med mallen för ny omgång.</p>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" type="submit">Skapa omgång</button>
      </form>
    </aside>
  );
}

function MaxCell({ group, onSaved }: { group: Group; onSaved: () => void }) {
  const [value, setValue] = useState(String(group.capacity));
  useEffect(() => setValue(String(group.capacity)), [group.capacity]);
  return (
    <input
      aria-label="Max"
      className="max-input"
      inputMode="numeric"
      value={value}
      onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
      onBlur={async () => {
        if (Number(value) !== group.capacity && Number(value) > 0) {
          await api('groups', { method: 'PUT', body: { id: group.id, capacity: Number(value) } });
          onSaved();
        } else setValue(String(group.capacity));
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}
