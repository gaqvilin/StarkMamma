import { FormEvent, useEffect, useState } from 'react';
import { Group, api, groupLabel } from '../api';

interface Notice {
  id: string;
  title: string;
  body: string;
  audience: string;
  page_heading: string | null;
  sent_at: string;
  recipients: number;
  read: number;
}

export function NoticesPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [history, setHistory] = useState<Notice[] | null>(null);
  const [audience, setAudience] = useState('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [withPage, setWithPage] = useState(false);
  const [heading, setHeading] = useState('');
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [status, setStatus] = useState<{ ok?: string; error?: string }>({});
  const [sending, setSending] = useState(false);

  const load = () => api<{ notices: Notice[] }>('notices').then((r) => setHistory(r.notices));
  useEffect(() => {
    api<{ groups: Group[] }>('round').then((r) => setGroups(r.groups));
    load();
  }, []);

  const audienceLabel = (a: string) => {
    if (a === 'all') return 'Alla deltagare';
    if (a === 'unpaid') return 'Alla som inte betalat';
    if (a.startsWith('person:')) return 'En person';
    if (a.startsWith('session:')) return 'De bokade på ett pass';
    if (a.startsWith('waitlist:')) return 'Kön till ett pass';
    const g = groups.find((x) => `group:${x.id}` === a);
    return g ? groupLabel(g) : a;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus({});
    setSending(true);
    try {
      const r = await api<{ recipients: number }>('notices', {
        method: 'POST',
        body: { title, body, audience, page: withPage ? { heading, text, link } : undefined },
      });
      setStatus({ ok: `Notisen är sparad till ${r.recipients} mottagare.` });
      setTitle('');
      setBody('');
      setWithPage(false);
      setHeading('');
      setText('');
      setLink('');
      load();
    } catch (err) {
      setStatus({ error: (err as Error).message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <header className="page-head">
        <div>
          <h1>Notiser</h1>
          <p className="muted">Skickas som pushnotis till deltagarnas mobiler.</p>
        </div>
      </header>

      <div className="grid-compose">
        <form className="card form" onSubmit={submit}>
          <label htmlFor="n-aud">Mottagare</label>
          <select id="n-aud" value={audience} onChange={(e) => setAudience(e.target.value)}>
            <option value="all">Alla deltagare</option>
            <option value="unpaid">Alla som inte betalat</option>
            {groups.map((g) => (
              <option key={g.id} value={`group:${g.id}`}>
                {groupLabel(g)} ({g.members})
              </option>
            ))}
          </select>
          <label htmlFor="n-title">Rubrik</label>
          <input id="n-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} required />
          <label htmlFor="n-body">Meddelande</label>
          <textarea id="n-body" rows={3} maxLength={400} value={body} onChange={(e) => setBody(e.target.value)} required />

          <label className="toggle">
            <input type="checkbox" checked={withPage} onChange={(e) => setWithPage(e.target.checked)} />
            Lägg till en informationssida som öppnas när man trycker på notisen
          </label>
          {withPage && (
            <>
              <label htmlFor="n-heading">Sidans rubrik</label>
              <input id="n-heading" value={heading} onChange={(e) => setHeading(e.target.value)} required />
              <label htmlFor="n-text">Text</label>
              <textarea id="n-text" rows={8} value={text} onChange={(e) => setText(e.target.value)} required />
              <label htmlFor="n-link">Länk (valfri)</label>
              <input id="n-link" type="url" placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} />
            </>
          )}
          {status.error && <p className="error">{status.error}</p>}
          {status.ok && <p className="ok-text">{status.ok}</p>}
          <button className="btn primary" disabled={sending} type="submit">
            {sending ? 'Skickar…' : `Skicka till ${audienceLabel(audience).toLowerCase()}`}
          </button>
        </form>

        <div className="preview">
          <p className="muted small-text">Så här ser notisen ut i mobilen</p>
          <div className="phone-notice">
            <span className="pn-app">STARKMAMMA · nu</span>
            <strong>{title || 'Rubrik'}</strong>
            <span>{body || 'Meddelande'}</span>
          </div>
          {withPage && (
            <div className="card phone-page">
              <strong>{heading || 'Sidans rubrik'}</strong>
              {(text || 'Text').split(/\n\n+/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              {link && <span className="btn small">Öppna länk</span>}
            </div>
          )}
        </div>
      </div>

      <h2 className="section">Skickade</h2>
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Skickad</th>
              <th>Notis</th>
              <th>Mottagare</th>
              <th className="right">Lästa</th>
            </tr>
          </thead>
          <tbody>
            {(history ?? []).map((n) => (
              <tr key={n.id}>
                <td className="muted nowrap">{n.sent_at}</td>
                <td>
                  <div className="strong">{n.title}</div>
                  <div className="muted">{n.body}</div>
                  {n.page_heading && <span className="chip accent small">Informationssida</span>}
                </td>
                <td>{audienceLabel(n.audience)}</td>
                <td className="right">
                  {n.read}/{n.recipients}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {history?.length === 0 && <p className="muted pad">Inga notiser skickade än.</p>}
      </div>
    </div>
  );
}
