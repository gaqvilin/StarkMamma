import { FormEvent, useEffect, useState } from 'react';
import { Person, api, shortDate } from '../api';

interface Charge {
  id: string;
  person_id: string;
  name: string;
  phone: string | null;
  description: string;
  amount: number;
  kind: string;
  status: 'unpaid' | 'paid';
  due_on: string | null;
  paid_on: string | null;
  method: string | null;
  receipt_number: number | null;
}

const METHOD: Record<string, string> = { swish: 'Swish', bank: 'Bank', cash: 'Kontant', other: 'Annat' };
const today = new Date().toISOString().slice(0, 10);
const kr = (n: number) => `${n.toLocaleString('sv-SE')} kr`;

export function PaymentsPage() {
  const [filter, setFilter] = useState<'unpaid' | 'paid' | 'all'>('unpaid');
  const [charges, setCharges] = useState<Charge[] | null>(null);
  const [all, setAll] = useState<Charge[]>([]);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => {
    api<{ charges: Charge[] }>(`charges?status=${filter}`).then((r) => setCharges(r.charges));
    api<{ charges: Charge[] }>('charges?status=all').then((r) => setAll(r.charges));
  };
  useEffect(load, [filter]);

  const unpaid = all.filter((c) => c.status === 'unpaid');
  const overdue = unpaid.filter((c) => c.due_on && c.due_on < today);
  const paidSum = all.filter((c) => c.status === 'paid').reduce((a, c) => a + c.amount, 0);

  const pay = async (id: string, method: string) => {
    await api('charges-pay', { method: 'POST', body: { id, method } });
    load();
  };
  const undo = async (id: string) => {
    await api('charges-pay', { method: 'POST', body: { id, undo: true } });
    load();
  };
  const remind = async () => {
    const r = await api<{ recipients: number }>('notices', {
      method: 'POST',
      body: { audience: 'unpaid', title: 'Påminnelse om betalning', body: 'Du har en obetald avgift hos StarkMamma. Betala enkelt med Swish under Betala i appen.' },
    });
    setMsg(`Påminnelse skickad till ${r.recipients} personer.`);
  };

  return (
    <div className={adding ? 'with-drawer' : ''}>
      <header className="page-head">
        <div>
          <h1>Betalningar</h1>
          <p className="muted">Markera betalningar när de kommit in på Swish eller banken. Kvittot syns direkt i deltagarens app.</p>
        </div>
        <div className="row">
          <button className="btn" disabled={!unpaid.length} onClick={remind}>Påminn alla som inte betalat</button>
          <button className="btn primary" onClick={() => setAdding(true)}>Nytt betalningskrav</button>
        </div>
      </header>
      {msg && <p className="ok-text">{msg}</p>}

      <div className="stats">
        <div className="card stat"><span className="stat-n ok">{kr(paidSum)}</span><span className="muted">inbetalt</span></div>
        <div className="card stat"><span className="stat-n">{kr(unpaid.reduce((a, c) => a + c.amount, 0))}</span><span className="muted">utestående</span></div>
        <div className="card stat"><span className="stat-n">{unpaid.length}</span><span className="muted">obetalda</span></div>
        <div className="card stat"><span className="stat-n danger">{overdue.length}</span><span className="muted">försenade</span></div>
      </div>

      <div className="tabs">
        {(['unpaid', 'paid', 'all'] as const).map((f) => (
          <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {{ unpaid: 'Obetalda', paid: 'Betalda', all: 'Alla' }[f]}
          </button>
        ))}
      </div>

      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Avser</th>
              <th>Förfaller</th>
              <th className="right">Belopp</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(charges ?? []).map((c) => (
              <tr key={c.id}>
                <td className="strong nowrap">
                  {c.name}
                  <div className="muted small-text">{c.phone}</div>
                </td>
                <td>{c.description}</td>
                <td className={`nowrap ${c.status === 'unpaid' && c.due_on && c.due_on < today ? 'danger-text' : 'muted'}`}>
                  {c.due_on ? shortDate(c.due_on) : '–'}
                </td>
                <td className="right strong nowrap">{kr(c.amount)}</td>
                <td className="nowrap">
                  {c.status === 'paid' ? (
                    <span className="chip ok">
                      Betald {c.paid_on ? shortDate(c.paid_on) : ''} · {METHOD[c.method ?? ''] ?? ''} · kvitto {c.receipt_number}
                    </span>
                  ) : (
                    <span className="chip warn">Obetald</span>
                  )}
                </td>
                <td className="right nowrap">
                  {c.status === 'unpaid' ? (
                    <select className="mini" value="" aria-label={`Markera ${c.name} betald`} onChange={(e) => e.target.value && pay(c.id, e.target.value)}>
                      <option value="">Markera betald…</option>
                      <option value="swish">via Swish</option>
                      <option value="bank">via bank</option>
                      <option value="cash">kontant</option>
                    </select>
                  ) : (
                    <button className="link" onClick={() => undo(c.id)}>Ångra</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {charges?.length === 0 && <p className="muted pad">Inget att visa.</p>}
      </div>

      {adding && <NewCharge onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
    </div>
  );
}

function NewCharge({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [personId, setPersonId] = useState('');
  const [kind, setKind] = useState('product');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueOn, setDueOn] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    api<{ people: Person[] }>('people').then((r) => setPeople(r.people.filter((p) => p.status === 'active')));
  }, []);
  const preset = (k: string, d: string, a: number) => {
    setKind(k);
    setDescription(d);
    setAmount(String(a));
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api('charges', { method: 'POST', body: { personId, description, amount: Number(amount), dueOn, kind } });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <aside className="drawer">
      <button className="btn close" onClick={onClose}>Stäng</button>
      <h2>Nytt betalningskrav</h2>
      <form className="form" onSubmit={submit}>
        <label htmlFor="c-person">Person</label>
        <select id="c-person" value={personId} onChange={(e) => setPersonId(e.target.value)} required>
          <option value="">Välj…</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <label>Snabbval</label>
        <div className="row">
          <button type="button" className="btn small" onClick={() => preset('punch_card', '10-kort', 1200)}>10-kort 1 200 kr</button>
          <button type="button" className="btn small" onClick={() => preset('drop_in', 'Extrapass', 140)}>Extrapass 140 kr</button>
          <button type="button" className="btn small" onClick={() => preset('event', 'AdventsFYS & AdventsMYS', 280)}>Event 280 kr</button>
        </div>
        <label htmlFor="c-desc">Avser</label>
        <input id="c-desc" value={description} onChange={(e) => setDescription(e.target.value)} required />
        <label htmlFor="c-amount">Belopp (kr)</label>
        <input id="c-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        <label htmlFor="c-due">Betalas senast (valfritt)</label>
        <input id="c-due" type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
        {kind === 'punch_card' && <p className="muted small-text">Klippkortet skapas automatiskt när du markerar betalningen som betald.</p>}
        {error && <p className="error">{error}</p>}
        <button className="btn primary" type="submit">Skapa</button>
      </form>
    </aside>
  );
}
