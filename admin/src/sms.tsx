import { useState } from 'react';

/**
 * Sms till dem som inte bekräftat, skickat från Emmas egen telefon via hennes abonnemang (ingen extra kostnad).
 * På datorn: kopiera nummer och text, eller öppna Meddelanden (fungerar på Mac med iPhone kopplad).
 * I mobilappen öppnas telefonens sms med alla mottagare ifyllda.
 */
export function SmsBox({ people, text }: { people: { name: string; phone: string | null }[]; text: string }) {
  const [copied, setCopied] = useState('');
  const numbers = people.map((p) => p.phone).filter(Boolean) as string[];
  const missing = people.filter((p) => !p.phone);
  const [body, setBody] = useState(text);
  if (!people.length) return null;
  const copy = async (what: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
    } catch {
      setCopied('');
    }
  };
  const intl = numbers.map((n) => '+46' + n.replace(/^0/, ''));
  return (
    <div className="sms-box">
      <strong>Sms till {numbers.length} som inte bekräftat</strong>
      <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Sms-text" />
      <div className="row">
        <a className="btn small primary" href={`sms:/open?addresses=${intl.join(',')}&body=${encodeURIComponent(body)}`}>
          Öppna i Meddelanden
        </a>
        <button className="btn small" onClick={() => copy('nummer', numbers.join(', '))}>Kopiera nummer</button>
        <button className="btn small" onClick={() => copy('text', body)}>Kopiera text</button>
      </div>
      {copied && <span className="ok-text small-text">Kopierat: {copied}</span>}
      {missing.length > 0 && <span className="muted small-text">Saknar mobilnummer: {missing.map((p) => p.name).join(', ')}</span>}
      <span className="muted small-text">Skickas från din egen telefon, så det kostar inget extra. Enklast är att använda knappen i StarkMamma-appen på mobilen.</span>
    </div>
  );
}
