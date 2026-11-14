# StarkMamma Admin

Emmas del av StarkMamma, en webbapp för datorn. Deltagarna använder mobilappen i `../app`.

- **Veckan:** alla pass i veckan med beläggning. Klicka på ett pass för att se deltagarlistan och kön. Där kan Emma:
  - flytta passet, byta lokal eller ställa in det, med notis till de bokade
  - registrera återbud, i tid eller sent, ångra och markera närvaro
  - lägga till en person med tillgodo-pass, klipp eller drop-in
- **Deltagare:** aktivera konton som skapats i appen, söka, lägga till och ändra deltagare och välja grupper
- **Anmälan:** en översikt per pass visar hur många som sökt i första och andra hand, max per pass (kan ändras direkt) och hur många som är placerade. Max styr bara förslaget och begränsar aldrig anmälan. Emma kan placera fler än max, och hennes val gäller. Därunder finns förslaget på fördelning för nästa omgång. Nuvarande deltagare med förtur kommer först, sedan går ordningen efter exakt anmälningstid, och första- och andrahandsval används. Emma kan justera enskilda personer och sedan bekräfta alla. Då skapas grupper och betalningskrav, nya konton aktiveras och alla får en notis
- **Betalningar:** obetalda och betalda betalningar. De som tryckt "Jag har swishat" i appen ligger överst. Emma markerar betalt, vilket ger ett kvittonummer, kan ångra, skapa nya betalningskrav och påminna alla som inte betalat. Ett 10-kort skapas när köpet är betalt
- **Omgångar:** priser och beläggning, och ny omgång. Grupperna kopieras från en tidigare omgång och passen skapas automatiskt. Uppehållsveckor hoppas över, och anmälan och förtur kan schemaläggas
- **Online:** onlineprogram med pris och period. Emma lägger in pass i text och/eller som film, via en länk till olistad YouTube eller Vimeo, och väljer från vilket datum varje pass syns. Deltagaren köper programmet i appen, och när betalningen markeras som betald får hon tillgång. Emma kan också ge och ta bort tillgång för hand. Hon ser vem som har tillgång, hur många som gjort varje pass och vilka som väntar på att betala
- **Utmaningar:** bingo och andra utmaningar med rutor, period och vinst. Deltagarna bockar av rutor med datum i appen. Emma ser hur långt alla har kommit och lottar en vinnare bland dem med full bricka, och vinnaren får en notis
- **Notiser:** till alla, en grupp eller alla som inte betalat, med valfri informationssida och förhandsvisning
- **Bekräftelse:** en notis kan kräva att mottagaren trycker "Jag har läst". Det gäller alltid för inställda och flyttade pass, och för andra notiser, till exempel event, kryssar Emma i det själv. Emma ser vem som har bekräftat, läst eller inte läst, både under Notiser och direkt på passet i Veckan. Hon kan påminna dem som inte bekräftat, eller skicka ett sms till dem från sin egen telefon (ingen extra kostnad). I appen öppnas Meddelanden med alla mottagare och texten ifyllda, och på datorn kan hon kopiera nummer och text. I appen ligger obekräftade notiser överst på alla flikar tills de är bekräftade

Samma API används av mobilappen (`/api/my-*`, `/api/bookable`, `/api/push-token`). Notiser levereras som pushnotis via Expo Push och annars som e-post via Resend. Varje dag kl 17 skickar `/api/cron-reminders` frågan "Kommer du imorgon?" och påminnelser om betalningar.

Reglerna för pass finns i `api/_lib/bookings.ts` och fördelningen i `api/_lib/allocate.ts`. Se också [`../docs/driftsattning.md`](../docs/driftsattning.md).

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
npm test           # 82 tester, varav attacktester i dev/attack.test.ts av API:et och reglerna mot demodatabasen
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
