# StarkMamma Admin

Emmas del av StarkMamma, en webbapp för datorn. Deltagarna använder mobilappen i `../app`.

- **Veckan:** alla pass i veckan med beläggning, återbud, lediga platser och kö. Tryck på ett pass för deltagarlista med telefonnummer och kö
- **Deltagare:** aktivera nya konton som skapats i appen, sök, lägg till och ändra deltagare, och välj grupper med antal platser per grupp
- **Omgång:** priser, betalningsdagar och beläggning per grupp, med markering för grupper under minimiantalet
- **Notiser:** skriv en notis med valfri informationssida, se förhandsvisning av hur den ser ut i mobilen, välj mottagare (alla eller en grupp), och se vilka notiser som skickats och hur många som läst dem

## Inloggning och nya konton

Mobilappen och admin har samma inloggning:

- **E-post och kod:** man skriver sin e-post och får en kod med 6 siffror (`/api/auth-start` och `/api/auth-verify`)
- **Google eller Facebook** (`/api/oauth-start` och `/api/oauth-callback`). Kontot känns igen via e-postadressen och därefter via leverantörens id (tabellen `identities`)

**Vem som helst kan skapa ett konto.** En ny e-postadress får ett konto med status `pending`. Personen fyller i namn och mobilnummer i appen (`/api/profile`), och namnet fylls i automatiskt från Google eller Facebook. Emma ser nya konton under **Deltagare → Väntar på aktivering**, med en siffra i menyn. Där aktiverar hon kontot och kan välja grupper direkt (`/api/people-activate`), och personen får en notis. Hon kan också avböja, och då kan personen inte logga in. Konton som väntar får inga notiser och syns inte i passlistorna.

Rollen hämtas från databasen vid varje anrop. Emma (`role = 'trainer'`) kommer till admin både i mobilappen och här på datorn. Deltagare som öppnar admin på datorn får en hänvisning till appen.

Webben får inloggningen som en cookie och mobilappen som en token. En kod gäller i 10 minuter, kan bara användas en gång och spärras efter 5 felaktiga försök. Man kan be om högst en kod var 30:e sekund och högst 6 i timmen per adress.

Samma upplägg som padelappen: Vite och React i `src/`, API som Vercel-funktioner i `api/` och databas på Neon (se `../db`).

## Kör lokalt

```bash
npm install
npm run dev:demo   # påhittad demodata i minnet (PGlite); logga in med starkmammavarberg@gmail.com, koden visas på skärmen
npm test           # röktester av API:et mot demodatabasen
```

Mot riktiga databasen: sätt miljövariablerna nedan och kör `npm run dev`.

## Driftsättning (Vercel)

Projektets rotkatalog är `admin`. Miljövariablerna som behövs:

| Variabel | Innehåll |
|---|---|
| `DATABASE_URL` | Anslutningssträng till Neon-projektet `starkmamma` |
| `AUTH_SECRET` | Lång slumpad sträng som signerar inloggningen |
| `RESEND_API_KEY`, `MAIL_FROM` | Resend, för koder via e-post |
| `PUBLIC_URL` | Adressen till admin, t.ex. `https://admin.starkmamma.com` (används som återkomstadress för Google och Facebook) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth-klient från Google Cloud Console |
| `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | App från Meta for Developers |

Notiser sparas med en mottagarlista. Själva leveransen som pushnotis kopplas på när deltagarappen registrerar push-token.
