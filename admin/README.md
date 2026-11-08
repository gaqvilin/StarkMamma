# StarkMamma Admin

Emmas del av StarkMamma, en webbapp för datorn. Deltagarna använder mobilappen i `../app`.

- **Veckan:** alla pass i veckan med beläggning, återbud, lediga platser och kö. Tryck på ett pass för deltagarlista med telefonnummer och kö
- **Deltagare:** sök, lägg till och ändra deltagare, och välj grupper med antal platser per grupp
- **Omgång:** priser, betalningsdagar och beläggning per grupp, med markering för grupper under minimiantalet
- **Notiser:** skriv en notis med valfri informationssida, se förhandsvisning av hur den ser ut i mobilen, välj mottagare (alla eller en grupp), och se vilka notiser som skickats och hur många som läst dem

## Inloggning

Mobilappen och admin har samma inloggning. Man skriver sitt mobilnummer eller sin e-post och får en kod med 6 siffror via sms eller e-post (`/api/auth-start` och `/api/auth-verify`). Rollen hämtas från databasen:

- **Emma** (`role = 'trainer'`) kommer till admin, både i mobilappen och här på datorn
- **Deltagare** kommer till sin vanliga vy i appen. Om de öppnar admin på datorn får de en hänvisning till appen

Man kan också logga in med **Google eller Facebook** (`/api/oauth-start` och `/api/oauth-callback`). Första gången kopplas kontot via e-postadressen, som måste finnas hos en registrerad deltagare eller hos Emma. Därefter känns kontot igen via Google- eller Facebook-id:t, och tabellen `identities` håller kopplingen. Inga nya konton skapas automatiskt. Mobilappen öppnar samma flöde i en säker webbläsarruta (`app/src/oauth.ts`) och får tillbaka en token via `starkmamma://login`.

Webben får inloggningen som en cookie och mobilappen som en token. Koden gäller i 10 minuter, kan bara användas en gång och spärras efter 5 felaktiga försök. Man kan inte be om en ny kod oftare än var 30:e sekund.

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
| `ELKS_API_USER`, `ELKS_API_PASSWORD` | 46elks, för koder via sms |
| `RESEND_API_KEY`, `MAIL_FROM` | Resend, för koder via e-post |
| `PUBLIC_URL` | Adressen till admin, t.ex. `https://admin.starkmamma.com` (används som återkomstadress för Google och Facebook) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth-klient från Google Cloud Console |
| `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | App från Meta for Developers |

Notiser sparas med en mottagarlista. Själva leveransen som pushnotis kopplas på när deltagarappen registrerar push-token.
