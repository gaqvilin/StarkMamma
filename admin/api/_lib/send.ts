// Skickar engångskoden via e-post (Resend, RESEND_API_KEY). Ingen inloggning via sms,
// så att inloggningen inte kostar något. I demoläge skickas inget; koden returneras i
// svaret så att det går att testa.
export async function sendCode(to: { email: string }, code: string): Promise<'email' | 'demo'> {
  if (process.env.DEMO_DB) return 'demo';
  if (!process.env.RESEND_API_KEY) throw new Error('Inloggning med kod är inte konfigurerad än');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || 'StarkMamma <no-reply@starkmamma.com>',
      to: to.email,
      subject: `Din kod: ${code}`,
      text: `Din kod till StarkMamma är ${code}. Den gäller i 10 minuter.`,
    }),
  });
  if (!res.ok) throw new Error('E-post kunde inte skickas');
  return 'email';
}
