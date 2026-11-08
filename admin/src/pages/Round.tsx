import { useEffect, useState } from 'react';
import { Group, WEEKDAYS, api, shortDate } from '../api';

interface RoundData {
  round: { name: string; program: string; starts_on: string; ends_on: string; pay_deadline: string | null; installment_deadline: string | null } | null;
  prices: { per_week: number; price: number; first_installment: number | null }[];
  groups: Group[];
}

export function RoundPage() {
  const [data, setData] = useState<RoundData | null>(null);
  useEffect(() => {
    api<RoundData>('round').then(setData);
  }, []);
  if (!data) return <p className="muted">Hämtar…</p>;
  if (!data.round) return <div className="card empty">Ingen omgång är upplagd.</div>;
  const { round, prices, groups } = data;
  const total = groups.reduce((a, g) => a + g.members, 0);
  const cap = groups.reduce((a, g) => a + g.capacity, 0);

  return (
    <div>
      <header className="page-head">
        <div>
          <h1>{round.name}</h1>
          <p className="muted">
            {round.program} · {shortDate(round.starts_on)} – {shortDate(round.ends_on)}
          </p>
        </div>
      </header>

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
          <p className="muted">Grupper under minimiantalet markeras med gult. Minst {groups[0]?.min_participants ?? 14} behövs för att en grupp ska köras.</p>
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
                  <td className={`right strong ${low ? 'warn-text' : ''}`}>
                    {g.members}/{g.capacity}
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
