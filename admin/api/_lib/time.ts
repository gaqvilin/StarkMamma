// "Nu" för affärsregler. I demoläge kan FAKE_NOW sättas för att testa t.ex. sena återbud.
export const now = (): Date =>
  process.env.DEMO_DB && process.env.FAKE_NOW ? new Date(process.env.FAKE_NOW) : new Date();

/** Dagens datum i svensk tid (YYYY-MM-DD). toISOString() ger UTC och blir fel strax efter midnatt. */
export const todayStockholm = (): string =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now());
