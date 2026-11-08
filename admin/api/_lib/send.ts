// Skickar engångskoden. Sms via 46elks (ELKS_API_USER/ELKS_API_PASSWORD),
// e-post via Resend (RESEND_API_KEY). I demoläge skickas inget; koden returneras
// i svaret så att det går att testa.
export async function sendCode(to: { phone?: string | null; email?: string | null }, code: string): Promise<'sms' | 'email' | 'demo'> {
  const text = `Din kod till StarkMamma är ${code}. Den gäller i 10 minuter.`;
  if (process.env.DEMO_DB) return 'demo';

  if (to.phone && process.env.ELKS_API_USER && process.env.ELKS_API_PASSWORD) {
    const intl = '+46' + to.phone.replace(/^0/, '');
    const res = await fetch('https://api.46elks.com/a1/sms', {
      method: 'POST',
      headers: {
        authorization: 'Basic ' + Buffer.from(`${process.env.ELKS_API_USER}:${process.env.ELKS_API_PASSWORD}`).toString('base64'),
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ from: 'StarkMamma', to: intl, message: text }),
    });
    if (!res.ok) throw new Error('Sms kunde inte skickas');
    return 'sms';
  }
  if (to.email && process.env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'StarkMamma <no-reply@starkmamma.com>',
        to: to.email,
        subject: `Din kod: ${code}`,
        text,
      }),
    });
    if (!res.ok) throw new Error('E-post kunde inte skickas');
    return 'email';
  }
  throw new Error('Inloggning med kod är inte konfigurerad än');
}
