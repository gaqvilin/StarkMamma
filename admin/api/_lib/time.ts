// "Nu" för affärsregler. I demoläge kan FAKE_NOW sättas för att testa t.ex. sena återbud.
export const now = (): Date =>
  process.env.DEMO_DB && process.env.FAKE_NOW ? new Date(process.env.FAKE_NOW) : new Date();
