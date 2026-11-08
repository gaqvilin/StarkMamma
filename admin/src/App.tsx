import { FormEvent, useEffect, useState } from 'react';
import { api } from './api';
import { NoticesPage } from './pages/Notices';
import { PeoplePage } from './pages/People';
import { RoundPage } from './pages/Round';
import { WeekPage } from './pages/Week';

const PAGES = [
  { key: 'week', label: 'Veckan', Page: WeekPage },
  { key: 'people', label: 'Deltagare', Page: PeoplePage },
  { key: 'round', label: 'Omgång', Page: RoundPage },
  { key: 'notices', label: 'Notiser', Page: NoticesPage },
] as const;

type Key = (typeof PAGES)[number]['key'];
const fromHash = (): Key => (PAGES.find((p) => `#${p.key}` === location.hash)?.key ?? 'week');

export function App() {
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [page, setPage] = useState<Key>(fromHash);

  useEffect(() => {
    api<{ admin: boolean }>('login').then((r) => setAdmin(r.admin)).catch(() => setAdmin(false));
    const onHash = () => setPage(fromHash());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  if (admin === null) return null;
  if (!admin) return <Login onDone={() => setAdmin(true)} />;

  const { Page } = PAGES.find((p) => p.key === page)!;
  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo />
        <nav>
          {PAGES.map((p) => (
            <a key={p.key} href={`#${p.key}`} className={p.key === page ? 'active' : ''}>
              {p.label}
            </a>
          ))}
        </nav>
        <button
          className="link logout"
          onClick={async () => {
            await api('logout', { method: 'POST' });
            setAdmin(false);
          }}
        >
          Logga ut
        </button>
      </aside>
      <main className="main">
        <Page />
      </main>
    </div>
  );
}

function Logo() {
  return (
    <div className="logo" aria-label="StarkMamma">
      <span className="logo-stark">STARK</span>
      <span className="logo-mamma">mamma</span>
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api('login', { method: 'POST', body: { password } });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <div className="login">
      <form onSubmit={submit} className="card login-card">
        <Logo />
        <h1>Admin</h1>
        <label htmlFor="pw">Lösenord</label>
        <input id="pw" type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="error">{error}</p>}
        <button className="btn primary" type="submit">
          Logga in
        </button>
      </form>
    </div>
  );
}
