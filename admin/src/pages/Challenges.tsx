import { FormEvent, useEffect, useState } from 'react';
import { api, shortDate } from '../api';

interface Challenge {
  id: string;
  name: string;
  description: string | null;
  prize: string | null;
  starts_on: string;
  ends_on: string;
  tasks: number;
  participants?: number;
}
interface Detail {
  challenge: Challenge;
  tasks: { id: string; sort: number; text: string; done: number }[];
  progress: { id: string; name: string; phone: string | null; done: number; last_on: string; winner: boolean }[];
}

export function ChallengesPage() {
  const [list, setList] = useState<Challenge[] | null>(null);
  const [selected, setSelected] = useState('');
  const [creating, setCreating] = useState(false);
  const load = () =>
    api<{ challenges: Challenge[] }>('challenges').then((r) => {
      setList(r.challenges);
      if (!selected && r.challenges[0]) setSelected(r.challenges[0].id);
    });
  useEffect(() => {
    load();
  }, []);
  return (
    <div className={creating ? 'with-drawer' : ''}>
      <header className="page-head">
        <div>
          <h1>Utmaningar</h1>
          <p className="muted">Bingo och andra utmaningar. Deltagarna bockar av rutor i appen, och de med full bricka är med i utlottningen.</p>
        </div>
        <div className="row">
          {list && list.length > 0 && (
            <select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ width: 'auto' }}>
              {list.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          <button className="btn primary" onClick={() => setCreating(true)}>Ny utmaning</button>
        </div>
      </header>
      {list?.length === 0 && <div className="card empty">Ingen utmaning än.</div>}
      {selected && <ChallengeView key={selected} id={selected} />}
      {creating && (
        <ChallengeForm
          onClose={() => setCreating(false)}
          onSaved={(id) => {
            setCreating(false);
            setSelected(id);
            load();
          }}
        />
      )}
    </div>
  );
}

function ChallengeView({ id }: { id: string }) {
  const [data, setData] = useState<Detail | null>(null);
  const [msg, setMsg] = useState('');
  const load = () => api<Detail>(`challenges?id=${id}`).then(setData);
  useEffect(() => {
    load();
  }, [id]);
  if (!data) return <p className="muted">Hämtar…</p>;
  const { challenge, tasks, progress } = data;
  const full = progress.filter((p) => p.done >= challenge.tasks);
  return (
    <>
      <div className="card program-head">
        <div>
          <h2>{challenge.name}</h2>
          <p className="muted">
            {shortDate(challenge.starts_on)}–{shortDate(challenge.ends_on)} · {challenge.tasks} rutor
            {challenge.prize ? ` · Vinst: ${challenge.prize}` : ''}
          </p>
          {challenge.description && <p>{challenge.description}</p>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <button
            className="btn primary"
            disabled={!full.some((p) => !p.winner)}
            onClick={async () => {
              setMsg('');
              try {
                const r = await api<{ winner: { name: string } }>('challenges', { method: 'POST', body: { id, action: 'draw' } });
                setMsg(`Vinnare: ${r.winner.name}. Hon har fått en notis.`);
                load();
              } catch (e) {
                setMsg((e as Error).message);
              }
            }}
          >
            Lotta vinnare bland {full.length} med full bricka
          </button>
          {msg && <p className="ok-text">{msg}</p>}
        </div>
      </div>

      <div className="grid-online">
        <section>
          <h2 className="section">Brickan</h2>
          <div className="bingo">
            {tasks.map((t) => (
              <div key={t.id} className="card bingo-cell">
                <span>{t.text}</span>
                <span className="chip">{t.done} klara</span>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="section">Deltagare ({progress.length})</h2>
          <div className="card table-wrap">
            <table className="table compact">
              <tbody>
                {progress.map((p) => (
                  <tr key={p.id}>
                    <td className="strong">
                      {p.name}
                      {p.winner && <span className="chip accent small">vinnare</span>}
                    </td>
                    <td style={{ width: '40%' }}>
                      <div className="bar">
                        <div className={`bar-fill ${p.done >= challenge.tasks ? 'full' : ''}`} style={{ width: `${(p.done / challenge.tasks) * 100}%` }} />
                      </div>
                    </td>
                    <td className="right nowrap">
                      {p.done}/{challenge.tasks}
                    </td>
                    <td className="muted small-text nowrap">senast {shortDate(p.last_on)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!progress.length && <p className="muted pad">Ingen har bockat av något än.</p>}
          </div>
        </section>
      </div>
    </>
  );
}

function ChallengeForm({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [prize, setPrize] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [tasks, setTasks] = useState('');
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const r = await api<{ id: string }>('challenges', {
        method: 'POST',
        body: { name, description, prize, startsOn, endsOn, tasks: tasks.split('\n') },
      });
      onSaved(r.id);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <aside className="drawer">
      <button className="btn close" onClick={onClose}>Stäng</button>
      <h2>Ny utmaning</h2>
      <form className="form" onSubmit={submit}>
        <label htmlFor="c-name">Namn</label>
        <input id="c-name" placeholder="HÖST-bingo 2026" value={name} onChange={(e) => setName(e.target.value)} required />
        <label htmlFor="c-desc">Beskrivning</label>
        <textarea id="c-desc" rows={3} placeholder="Gör alla aktiviteter och bocka av med datum." value={description} onChange={(e) => setDescription(e.target.value)} />
        <label htmlFor="c-prize">Vinst</label>
        <input id="c-prize" placeholder="Två 5-gångerskort och en egen stund med mig" value={prize} onChange={(e) => setPrize(e.target.value)} />
        <div className="row">
          <div style={{ flex: 1 }}>
            <label htmlFor="c-start">Start</label>
            <input id="c-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} required />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="c-end">Slut</label>
            <input id="c-end" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} required />
          </div>
        </div>
        <label htmlFor="c-tasks">Rutor, en per rad</label>
        <textarea
          id="c-tasks"
          rows={12}
          placeholder={'Promenera minst 8 km eller jogga 3 km\nSimma minst 20 minuter\nCykla minst 10 km\nTa ett höstbad\nVila stilla och tyst minst 20 min'}
          value={tasks}
          onChange={(e) => setTasks(e.target.value)}
          required
        />
        <p className="muted small-text">{tasks.split('\n').filter((t) => t.trim()).length} rutor</p>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" type="submit">Skapa utmaning</button>
      </form>
    </aside>
  );
}
