import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Group, Person, api, groupLabel } from '../api';

export function PeoplePage() {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Person | 'new' | null>(null);

  const load = () => {
    api<{ people: Person[] }>('people').then((r) => setPeople(r.people));
    api<{ groups: Group[] }>('round').then((r) => setGroups(r.groups));
  };
  useEffect(load, []);

  const byId = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const filtered = (people ?? []).filter((p) =>
    `${p.name} ${p.phone ?? ''} ${p.email ?? ''}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className={editing ? 'with-drawer' : ''}>
      <header className="page-head">
        <div>
          <h1>Deltagare</h1>
          <p className="muted">{people ? `${people.length} personer` : 'Hämtar…'}</p>
        </div>
        <div className="row">
          <input className="search" placeholder="Sök namn, telefon eller e-post" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="btn primary" onClick={() => setEditing('new')}>Ny deltagare</button>
        </div>
      </header>

      {people && people.length === 0 ? (
        <div className="card empty">
          Inga deltagare än. Lägg till den första med <strong>Ny deltagare</strong>.
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Namn</th>
                <th>Telefon</th>
                <th>E-post</th>
                <th>Grupper</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td className="strong nowrap">{p.name}</td>
                  <td className="muted">{p.phone}</td>
                  <td className="muted">{p.email}</td>
                  <td>
                    <div className="chips">
                      {p.group_ids.map((id) => byId.get(id)).filter(Boolean).map((g) => (
                        <span key={g!.id} className="chip">{groupLabel(g!)}</span>
                      ))}
                      {!p.group_ids.length && <span className="muted">Ingen grupp</span>}
                    </div>
                  </td>
                  <td className="right">
                    <button className="btn small" onClick={() => setEditing(p)}>Ändra</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <PersonForm
          key={editing === 'new' ? 'new' : editing.id}
          person={editing === 'new' ? null : editing}
          groups={groups}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function PersonForm({ person, groups, onClose, onSaved }: { person: Person | null; groups: Group[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(person?.name ?? '');
  const [phone, setPhone] = useState(person?.phone ?? '');
  const [email, setEmail] = useState(person?.email ?? '');
  const [groupIds, setGroupIds] = useState<string[]>(person?.group_ids ?? []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => setGroupIds((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api('people', { method: person ? 'PUT' : 'POST', body: { id: person?.id, name, phone, email, groupIds } });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="drawer">
      <button className="btn close" onClick={onClose}>Stäng</button>
      <h2>{person ? 'Ändra deltagare' : 'Ny deltagare'}</h2>
      <form onSubmit={submit} className="form">
        <label htmlFor="p-name">Namn</label>
        <input id="p-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <label htmlFor="p-phone">Mobilnummer</label>
        <input id="p-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="070-123 45 67" />
        <label htmlFor="p-email">E-post</label>
        <input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <p className="muted small-text">Mobilnummer eller e-post används för att logga in i appen.</p>

        <h3>Grupper i omgången</h3>
        <div className="group-picks">
          {groups.map((g) => {
            const checked = groupIds.includes(g.id);
            const full = g.members >= g.capacity && !checked;
            return (
              <label key={g.id} className={`pick ${checked ? 'on' : ''}`}>
                <input type="checkbox" checked={checked} onChange={() => toggle(g.id)} />
                <span>{groupLabel(g)}</span>
                <span className={`muted ${full ? 'warn-text' : ''}`}>
                  {g.members}/{g.capacity}
                </span>
              </label>
            );
          })}
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={saving} type="submit">
          {saving ? 'Sparar…' : 'Spara'}
        </button>
      </form>
    </aside>
  );
}
