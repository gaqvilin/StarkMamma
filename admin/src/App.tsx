import type React from 'react';
import { FormEvent, useEffect, useState } from 'react';
import { api } from './api';
import { FacebookMark, GoogleMark } from './brand';
import { NoticesPage } from './pages/Notices';
import { PaymentsPage } from './pages/Payments';
import { RegistrationsPage } from './pages/Registrations';
import { PeoplePage } from './pages/People';
import { RoundPage } from './pages/Round';
import { WeekPage } from './pages/Week';

const PAGES = [
  { key: 'week', label: 'Veckan', Page: WeekPage },
  { key: 'people', label: 'Deltagare', Page: PeoplePage },
  { key: 'registrations', label: 'Anmälan', Page: RegistrationsPage },
  { key: 'payments', label: 'Betalningar', Page: PaymentsPage },
  { key: 'round', label: 'Omgångar', Page: RoundPage },
  { key: 'notices', label: 'Notiser', Page: NoticesPage },
] as const;

type Key = (typeof PAGES)[number]['key'];
const fromHash = (): Key => (PAGES.find((p) => `#${p.key}` === location.hash)?.key ?? 'week');

export function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [page, setPage] = useState<Key>(fromHash);

  useEffect(() => {
    api<{ user: User | null }>('me').then((r) => setUser(r.user)).catch(() => setUser(null));
    const onHash = () => setPage(fromHash());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  if (user === undefined) return null;
  if (!user) return <Login onDone={setUser} />;
  if (user.role !== 'trainer') return <NotTrainer user={user} onLogout={() => setUser(null)} />;

  const { Page } = PAGES.find((p) => p.key === page)!;
  return <Shell page={page} Page={Page} onLogout={() => setUser(null)} />;
}

function Shell({ page, Page, onLogout }: { page: Key; Page: () => React.ReactElement; onLogout: () => void }) {
  const [pending, setPending] = useState(0);
  useEffect(() => {
    api<{ people: { status: string }[] }>('people')
      .then((r) => setPending(r.people.filter((p) => p.status === 'pending').length))
      .catch(() => {});
  }, [page]);
  useEffect(() => {
    const onChange = () => api<{ people: { status: string }[] }>('people').then((r) => setPending(r.people.filter((p) => p.status === 'pending').length));
    addEventListener('people-changed', onChange);
    return () => removeEventListener('people-changed', onChange);
  }, []);
  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo />
        <nav>
          {PAGES.map((p) => (
            <a key={p.key} href={`#${p.key}`} className={p.key === page ? 'active' : ''}>
              {p.label}
              {p.key === 'people' && pending > 0 && <span className="badge">{pending}</span>}
            </a>
          ))}
        </nav>
        <button
          className="link logout"
          onClick={async () => {
            await api('logout', { method: 'POST' });
            onLogout();
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

interface User {
  id: string;
  name: string;
  role: 'participant' | 'trainer';
  status: 'pending' | 'active' | 'rejected';
}

/** Samma inloggning som i mobilappen: e-post och en engångskod, eller Google/Facebook. */
function Login({ onDone }: { onDone: (u: User) => void }) {
  const [identifier, setIdentifier] = useState('');
  const [step, setStep] = useState<'who' | 'code'>('who');
  const [code, setCode] = useState('');
  const [demoCode, setDemoCode] = useState('');
  const [error, setError] = useState(() => new URLSearchParams(location.search).get('login_error') ?? '');
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState<string[]>([]);

  useEffect(() => {
    api<{ providers: string[] }>('auth-providers').then((r) => setProviders(r.providers)).catch(() => {});
    if (location.search) history.replaceState(null, '', location.pathname + location.hash);
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const start = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const r = await api<{ demoCode?: string }>('auth-start', { method: 'POST', body: { email: identifier } });
      setDemoCode(r.demoCode ?? '');
      setStep('code');
    });
  };
  const verify = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const r = await api<{ user: User }>('auth-verify', { method: 'POST', body: { email: identifier, code } });
      onDone(r.user);
    });
  };

  return (
    <div className="login">
      {step === 'who' ? (
        <form onSubmit={start} className="card login-card">
          <Logo />
          <h1>Logga in</h1>
          <label htmlFor="who">E-post</label>
          <input id="who" type="email" autoFocus autoComplete="email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          {error && <p className="error">{error}</p>}
          <button className="btn primary" disabled={busy || !identifier.trim()} type="submit">
            Skicka kod
          </button>
          {providers.length > 0 && (
            <>
              <div className="or"><span>eller</span></div>
              {providers.includes('google') && (
                <a className="btn social" href="/api/oauth-start?provider=google">
                  <GoogleMark /> Fortsätt med Google
                </a>
              )}
              {providers.includes('facebook') && (
                <a className="btn social" href="/api/oauth-start?provider=facebook">
                  <FacebookMark /> Fortsätt med Facebook
                </a>
              )}
            </>
          )}
        </form>
      ) : (
        <form onSubmit={verify} className="card login-card">
          <Logo />
          <h1>Skriv koden</h1>
          <p className="muted">Vi har skickat en kod med 6 siffror till {identifier}.</p>
          {demoCode && <p className="chip accent">Demoläge: koden är {demoCode}</p>}
          <label htmlFor="code">Kod</label>
          <input id="code" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
          {error && <p className="error">{error}</p>}
          <button className="btn primary" disabled={busy || code.length !== 6} type="submit">
            Logga in
          </button>
          <button type="button" className="link" onClick={() => { setStep('who'); setCode(''); setError(''); }}>
            Byt e-postadress
          </button>
        </form>
      )}
    </div>
  );
}

function NotTrainer({ user, onLogout }: { user: User; onLogout: () => void }) {
  return (
    <div className="login">
      <div className="card login-card">
        <Logo />
        <h1>Hej {user.name.split(' ')[0]}!</h1>
        <p className="muted">
          Den här sidan är bara för Emma.{' '}
          {user.status === 'pending'
            ? 'Ditt konto väntar på att Emma aktiverar det. Ladda ner StarkMamma-appen så får du besked där.'
            : 'Dina pass, återbud och betalningar hittar du i StarkMamma-appen.'}
        </p>
        <button
          className="btn"
          onClick={async () => {
            await api('logout', { method: 'POST' });
            onLogout();
          }}
        >
          Logga ut
        </button>
      </div>
    </div>
  );
}
