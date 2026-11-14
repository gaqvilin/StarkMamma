import { FormEvent, useEffect, useState } from 'react';
import { Person, api, shortDate } from '../api';

interface Program {
  id: string;
  name: string;
  description: string | null;
  price: number;
  status: 'draft' | 'open' | 'closed';
  starts_on: string | null;
  ends_on: string | null;
  members?: number;
  workouts?: number;
  unpaid?: number;
}
interface Workout {
  id: string;
  title: string;
  body: string | null;
  video_url: string | null;
  duration_min: number | null;
  publish_on: string | null;
  sort: number;
  done: number;
}
interface Detail {
  program: Program;
  workouts: Workout[];
  members: { id: string; name: string; phone: string | null; source: string; granted_on: string; done: number }[];
  waiting: { charge_id: string; id: string; name: string; phone: string | null; amount: number; reported: boolean }[];
}

const STATUS: Record<Program['status'], string> = { open: 'Öppen för köp i appen', draft: 'Dold', closed: 'Stängd' };
const today = new Date().toISOString().slice(0, 10);

export function OnlinePage() {
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [selected, setSelected] = useState('');
  const [creating, setCreating] = useState(false);
  const load = () =>
    api<{ programs: Program[] }>('online').then((r) => {
      setPrograms(r.programs);
      if (!selected && r.programs[0]) setSelected(r.programs[0].id);
    });
  useEffect(() => {
    load();
  }, []);

  return (
    <div className={creating ? 'with-drawer' : ''}>
      <header className="page-head">
        <div>
          <h1>Onlineträning</h1>
          <p className="muted">Pass i text eller film. Bara de som betalat, eller som du gett tillgång, ser passen i appen.</p>
        </div>
        <div className="row">
          {programs && programs.length > 0 && (
            <select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ width: 'auto' }}>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <button className="btn primary" onClick={() => setCreating(true)}>Nytt program</button>
        </div>
      </header>
      {programs?.length === 0 && <div className="card empty">Inget onlineprogram än. Skapa det första med <strong>Nytt program</strong>.</div>}
      {selected && <ProgramView key={selected} id={selected} onChanged={load} />}
      {creating && (
        <ProgramForm
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

function ProgramForm({ program, onClose, onSaved }: { program?: Program; onClose: () => void; onSaved: (id: string) => void }) {
  const [name, setName] = useState(program?.name ?? '');
  const [description, setDescription] = useState(program?.description ?? '');
  const [price, setPrice] = useState(String(program?.price ?? ''));
  const [startsOn, setStartsOn] = useState(program?.starts_on ?? '');
  const [endsOn, setEndsOn] = useState(program?.ends_on ?? '');
  const [status, setStatus] = useState<Program['status']>(program?.status ?? 'open');
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const r = await api<{ id: string }>('online', { method: 'POST', body: { id: program?.id, name, description, price: Number(price || 0), startsOn, endsOn, status } });
      onSaved(r.id);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <aside className="drawer">
      <button className="btn close" onClick={onClose}>Stäng</button>
      <h2>{program ? 'Ändra program' : 'Nytt onlineprogram'}</h2>
      <form className="form" onSubmit={submit}>
        <label htmlFor="o-name">Namn</label>
        <input id="o-name" placeholder="Online höst 2026" value={name} onChange={(e) => setName(e.target.value)} required />
        <label htmlFor="o-desc">Beskrivning (visas i appen)</label>
        <textarea id="o-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        <label htmlFor="o-price">Pris (kr)</label>
        <input id="o-price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} />
        <div className="row">
          <div style={{ flex: 1 }}>
            <label htmlFor="o-start">Start</label>
            <input id="o-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="o-end">Slut</label>
            <input id="o-end" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
          </div>
        </div>
        <label htmlFor="o-status">Status</label>
        <select id="o-status" value={status} onChange={(e) => setStatus(e.target.value as Program['status'])}>
          {Object.entries(STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" type="submit">Spara</button>
      </form>
    </aside>
  );
}

function ProgramView({ id, onChanged }: { id: string; onChanged: () => void }) {
  const [data, setData] = useState<Detail | null>(null);
  const [editing, setEditing] = useState<Workout | 'new' | null>(null);
  const [editProgram, setEditProgram] = useState(false);
  const load = () => api<Detail>(`online-program?id=${id}`).then(setData);
  useEffect(() => {
    load();
  }, [id]);
  if (!data) return <p className="muted">Hämtar…</p>;
  const { program, workouts, members, waiting } = data;
  const reload = () => {
    load();
    onChanged();
  };

  return (
    <>
      <div className="card program-head">
        <div>
          <h2>{program.name}</h2>
          <p className="muted">
            {program.price} kr
            {program.starts_on ? ` · ${shortDate(program.starts_on)}–${program.ends_on ? shortDate(program.ends_on) : ''}` : ''} ·{' '}
            {STATUS[program.status]}
          </p>
          {program.description && <p>{program.description}</p>}
        </div>
        <button className="btn small" onClick={() => setEditProgram(true)}>Ändra</button>
      </div>

      <div className="grid-online">
        <section>
          <header className="page-head section">
            <h2>Pass ({workouts.length})</h2>
            <button className="btn primary small" onClick={() => setEditing('new')}>Nytt pass</button>
          </header>
          {editing === 'new' && <WorkoutForm programId={id} onDone={() => { setEditing(null); reload(); }} />}
          {workouts.map((w) =>
            editing !== 'new' && editing?.id === w.id ? (
              <WorkoutForm key={w.id} programId={id} workout={w} onDone={() => { setEditing(null); reload(); }} />
            ) : (
              <div key={w.id} className="card workout">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>{w.title}</strong>
                  <div className="chips">
                    {w.publish_on && w.publish_on > today ? <span className="chip warn">Syns {shortDate(w.publish_on)}</span> : <span className="chip ok">Publicerat</span>}
                    {w.video_url && <span className="chip accent">Film</span>}
                    {w.duration_min && <span className="chip">{w.duration_min} min</span>}
                    <span className="chip">{w.done} har gjort</span>
                  </div>
                </div>
                {w.body && <p className="pre">{w.body.length > 280 ? w.body.slice(0, 280) + '…' : w.body}</p>}
                {w.video_url && (
                  <a href={w.video_url} target="_blank" rel="noreferrer">
                    {w.video_url}
                  </a>
                )}
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="btn small" onClick={() => setEditing(w)}>Ändra</button>
                  <button
                    className="link"
                    onClick={async () => {
                      if (!confirm(`Ta bort ${w.title}?`)) return;
                      await api('workouts', { method: 'POST', body: { id: w.id, delete: true } });
                      reload();
                    }}
                  >
                    Ta bort
                  </button>
                </div>
              </div>
            ),
          )}
          {!workouts.length && editing !== 'new' && <div className="card empty">Inga pass än.</div>}
        </section>

        <section>
          <header className="page-head section">
            <h2>Deltagare ({members.length})</h2>
          </header>
          {waiting.length > 0 && (
            <div className="card ack warn">
              <strong>Väntar på betalning ({waiting.length})</strong>
              {waiting.map((w) => (
                <div key={w.charge_id} className="row" style={{ justifyContent: 'space-between', width: '100%' }}>
                  <span>
                    {w.name} <span className="muted small-text">{w.amount} kr{w.reported ? ' · säger att hon swishat' : ''}</span>
                  </span>
                  <button
                    className="btn small"
                    onClick={async () => {
                      await api('charges-pay', { method: 'POST', body: { id: w.charge_id, method: 'swish' } });
                      reload();
                    }}
                  >
                    Betald, ge tillgång
                  </button>
                </div>
              ))}
            </div>
          )}
          <GrantAccess programId={id} existing={new Set(members.map((m) => m.id))} onDone={reload} />
          <div className="card table-wrap">
            <table className="table compact">
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {m.name}
                      <div className="muted small-text">{m.phone}</div>
                    </td>
                    <td>
                      <span className={`chip ${m.source === 'paid' ? 'ok' : ''}`}>{m.source === 'paid' ? 'Betalt' : 'Tillgång av dig'}</span>
                    </td>
                    <td className="muted small-text nowrap">{m.done} pass gjorda</td>
                    <td className="right">
                      <button
                        className="link"
                        onClick={async () => {
                          if (!confirm(`Ta bort ${m.name}s tillgång?`)) return;
                          await api('online-access', { method: 'POST', body: { programId: id, personId: m.id, action: 'revoke' } });
                          reload();
                        }}
                      >
                        Ta bort
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!members.length && <p className="muted pad">Ingen har tillgång än. Deltagarna köper programmet under Online i appen.</p>}
          </div>
        </section>
      </div>
      {editProgram && <ProgramForm program={program} onClose={() => setEditProgram(false)} onSaved={() => { setEditProgram(false); reload(); }} />}
    </>
  );
}

function WorkoutForm({ programId, workout, onDone }: { programId: string; workout?: Workout; onDone: () => void }) {
  const [title, setTitle] = useState(workout?.title ?? '');
  const [text, setText] = useState(workout?.body ?? '');
  const [video, setVideo] = useState(workout?.video_url ?? '');
  const [minutes, setMinutes] = useState(String(workout?.duration_min ?? ''));
  const [publishOn, setPublishOn] = useState(workout?.publish_on ?? '');
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api('workouts', {
        method: 'POST',
        body: { id: workout?.id, programId, title, body: text, videoUrl: video, durationMin: minutes ? Number(minutes) : null, publishOn },
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <form className="card form edit" onSubmit={submit}>
      <label htmlFor="w-title">Rubrik</label>
      <input id="w-title" placeholder="Pass 3: Helkropp 20 min" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <label htmlFor="w-text">Passet i text</label>
      <textarea id="w-text" rows={7} placeholder={'Värm upp 5 min.\n\n5 varv, 45 sek arbete / 15 sek vila:\n- Knäböj\n- Utfall\n- Armhävningar'} value={text} onChange={(e) => setText(e.target.value)} />
      <label htmlFor="w-video">Film (länk)</label>
      <input id="w-video" placeholder="https://youtu.be/..." value={video} onChange={(e) => setVideo(e.target.value)} />
      <p className="muted small-text">Ladda upp filmen som olistad på YouTube eller Vimeo och klistra in länken.</p>
      <div className="row">
        <div style={{ width: 120 }}>
          <label htmlFor="w-min">Minuter</label>
          <input id="w-min" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))} />
        </div>
        <div style={{ flex: 1 }}>
          <label htmlFor="w-pub">Syns från (tomt = direkt)</label>
          <input id="w-pub" type="date" value={publishOn} onChange={(e) => setPublishOn(e.target.value)} />
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="btn primary" type="submit">Spara pass</button>
        <button className="btn" type="button" onClick={onDone}>Avbryt</button>
      </div>
    </form>
  );
}

function GrantAccess({ programId, existing, onDone }: { programId: string; existing: Set<string>; onDone: () => void }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [query, setQuery] = useState('');
  if (!people)
    return (
      <button className="btn small" style={{ marginBottom: 10 }} onClick={() => api<{ people: Person[] }>('people').then((r) => setPeople(r.people))}>
        Ge någon tillgång
      </button>
    );
  const matches = people
    .filter((p) => p.status === 'active' && !existing.has(p.id) && query.length > 1 && p.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 6);
  return (
    <div className="card form edit">
      <label htmlFor="g-q">Ge tillgång utan betalning</label>
      <input id="g-q" autoFocus placeholder="Sök namn" value={query} onChange={(e) => setQuery(e.target.value)} />
      {matches.map((p) => (
        <button
          key={p.id}
          className="btn small"
          onClick={async () => {
            await api('online-access', { method: 'POST', body: { programId, personId: p.id, action: 'grant' } });
            setPeople(null);
            setQuery('');
            onDone();
          }}
        >
          Ge {p.name} tillgång
        </button>
      ))}
    </div>
  );
}
