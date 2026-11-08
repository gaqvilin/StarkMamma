# StarkMamma Admin

Emmas del av StarkMamma, en webbapp för datorn. Deltagarna använder mobilappen i `../app`.

- **Veckan:** alla pass i veckan med beläggning, återbud, lediga platser och kö. Tryck på ett pass för deltagarlista med telefonnummer och kö
- **Deltagare:** sök, lägg till och ändra deltagare, och välj grupper med antal platser per grupp
- **Omgång:** priser, betalningsdagar och beläggning per grupp, med markering för grupper under minimiantalet
- **Notiser:** skriv en notis med valfri informationssida, se förhandsvisning av hur den ser ut i mobilen, välj mottagare (alla eller en grupp), och se vilka notiser som skickats och hur många som läst dem

Samma upplägg som padelappen: Vite och React i `src/`, API som Vercel-funktioner i `api/` och databas på Neon (se `../db`).

## Kör lokalt

```bash
npm install
npm run dev:demo   # påhittad demodata i minnet (PGlite), lösenord: demo
npm test           # röktester av API:et mot demodatabasen
```

Mot riktiga databasen: sätt `DATABASE_URL`, `ADMIN_PASSWORD` och `ADMIN_SECRET` och kör `npm run dev`.

## Driftsättning (Vercel)

Projektets rotkatalog är `admin`. Miljövariablerna som behövs:

| Variabel | Innehåll |
|---|---|
| `DATABASE_URL` | Anslutningssträng till Neon-projektet `starkmamma` |
| `ADMIN_PASSWORD` | Emmas lösenord |
| `ADMIN_SECRET` | Lång slumpad sträng som signerar inloggningscookien |

Notiser sparas med en mottagarlista. Själva leveransen som pushnotis kopplas på när deltagarappen registrerar push-token.
