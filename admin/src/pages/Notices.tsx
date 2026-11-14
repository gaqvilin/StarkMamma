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
  requires_ack: boolean;
  acknowledged: number;
}

export function NoticesPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [history, setHistory] = useState<Notice[] | null>(null);
  const [audience, setAudience] = useState('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [withPage, setWithPage] = useState(false);
  const [requireAck, setRequireAck] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
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
        body: { title, body, audience, requireAck, page: withPage ? { heading, text, link } : undefined },
      });
      setStatus({ ok: `Notisen är sparad till ${r.recipients} mottagare.` });
      setTitle('');
      setBody('');
      setWithPage(false);
      setRequireAck(false);
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
    <div className={openId ? 'with-drawer' : ''}>
      {openId && <NoticeDrawer id={openId} onClose={() => setOpenId(null)} />}
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
          <label className="toggle">
            <input type="checkbox" checked={requireAck} onChange={(e) => setRequireAck(e.target.checked)} />
            Mottagarna ska bekräfta att de läst (du ser vilka som bekräftat)
          </label>
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
              <th className="right">Bekräftat</th>
            </tr>
          </thead>
          <tbody>
            {(history ?? []).map((n) => (
              <tr key={n.id} className="clickable" onClick={() => setOpenId(n.id)}>
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
                <td className="right nowrap">
                  {n.requires_ack ? (
                    <span className={`chip ${n.acknowledged >= n.recipients ? 'ok' : 'warn'}`}>
                      {n.acknowledged}/{n.recipients}
                    </span>
                  ) : (
                    <span className="muted">–</span>
                  )}
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

interface Recipient {
  id: string;
  name: string;
  phone: string | null;
  delivered_via: string | null;
  read_at: string | null;
  acknowledged_at: string | null;
  reminded_at: string | null;
}

export function NoticeDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<{ notice: { title: string; body: string; sent_at: string; requires_ack: boolean }; recipients: Recipient[] } | null>(null);
  const [msg, setMsg] = useState('');
  const load = () => api<typeof data>(`notice?id=${id}`).then(setData);
  useEffect(() => {
    setData(null);
    setMsg('');
    load();
  }, [id]);
  if (!data) return <aside className="drawer"><p className="muted">Hämtar…</p></aside>;
  const { notice, recipients } = data;
  const acked = recipients.filter((r) => r.acknowledged_at).length;
  const missing = recipients.filter((r) => !r.acknowledged_at);
  return (
    <aside className="drawer">
      <button className="btn close" onClick={onClose}>Stäng</button>
      <h2>{notice.title}</h2>
      <p className="muted">Skickad {notice.sent_at}</p>
      <p>{notice.body}</p>
      {notice.requires_ack && (
        <div className={`card ack ${missing.length ? 'warn' : 'ok'}`}>
          <strong>
            {acked} av {recipients.length} har bekräftat
          </strong>
          {missing.length > 0 && (
            <button
              className="btn small"
              onClick={async () => {
                const r = await api<{ reminded: number }>('notice', { method: 'POST', body: { id, action: 'remind' } });
                setMsg(`Påminnelse skickad till ${r.reminded}.`);
                load();
              }}
            >
              Påminn {missing.length} som inte bekräftat
            </button>
          )}
          {msg && <p className="ok-text">{msg}</p>}
        </div>
      )}
      <table className="table compact">
        <tbody>
          {recipients.map((r) => (
            <tr key={r.id}>
              <td>
                {r.name}
                <div className="muted small-text">{r.phone}</div>
              </td>
              <td className="right">
                {r.acknowledged_at ? (
                  <span className="chip ok">Bekräftat {r.acknowledged_at.slice(5)}</span>
                ) : r.read_at ? (
                  <span className="chip warn">{notice.requires_ack ? 'Läst, ej bekräftat' : `Läst ${r.read_at.slice(5)}`}</span>
                ) : (
                  <span className="chip">{r.delivered_via === 'expo' ? 'Levererad' : r.delivered_via === 'email' ? 'Mejlad' : 'Ej läst'}</span>
                )}
                {r.reminded_at && !r.acknowledged_at && <div className="muted small-text">påmind {r.reminded_at.slice(5)}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </aside>
  );
}
