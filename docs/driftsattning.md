# Driftsättning: checklista

Koden är klar och databasen hos Neon är uppdaterad med alla tabeller. Det som återstår är konton och nycklar, som du lägger in själv så att de aldrig hamnar i repot eller i chatten.

## 1. Admin och API på Vercel (cirka 15 minuter)

1. Skapa ett nytt projekt i Vercel, på samma konto som padelappen, från repot `gaqvilin/StarkMamma`. Ange **Root Directory: `admin`**, så känns Vite igen automatiskt.
2. Lägg in miljövariablerna under **Settings → Environment Variables**:

| Variabel | Var den kommer ifrån | Krävs |
|---|---|---|
| `DATABASE_URL` | Neon-projektet `starkmamma`, under Connect. Välj anslutningssträngen med pooling. Det finns också en integration för Neon i Vercel som lägger in den automatiskt | Ja |
| `AUTH_SECRET` | En lång slumpad sträng, till exempel från `openssl rand -base64 32` | Ja |
| `RESEND_API_KEY` | resend.com: skapa ett gratiskonto och sedan en API-nyckel. Utan den kan ingen logga in med kod | Ja |
| `MAIL_FROM` | Avsändaren, till exempel `StarkMamma <no-reply@starkmamma.com>`. Domänen måste verifieras i Resend med några DNS-poster. Tills dess går det att testa med Resends egen testavsändare | Ja |
| `PUBLIC_URL` | Admin-adressen, till exempel `https://starkmamma-admin.vercel.app` | Ja |
| `CRON_SECRET` | En slumpad sträng. Vercel skickar den till den dagliga påminnelsen kl 17 | Ja |
| `SWISH_NUMBER` | StarkMammas Swish-nummer, som visas för deltagarna under Betala | Ja |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web). Ange `PUBLIC_URL/api/oauth-callback` som omdirigeringsadress | Nej, Google-knappen visas bara om de finns |
| `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | developers.facebook.com → Skapa app → Facebook Login. Samma omdirigeringsadress. Appen kräver en länk till en integritetspolicy innan den kan aktiveras | Nej |

3. Driftsätt projektet och öppna adressen. Logga in med `starkmammavarberg@gmail.com`, och koden kommer via e-post.
4. Kontrollera att antal platser per grupp stämmer under **Omgångar**. Gissningen är 16 i Gymmet och 20 i Ladan.

## 2. Mobilappen (EAS)

1. Skapa ett gratiskonto på expo.dev och kör `npx eas-cli@latest login` och sedan `npx eas-cli@latest init` i `app/`. Det skapar ett projekt-id i `app.json`, och push-registreringen behöver det.
2. Ersätt `https://ERSÄTT-MED-ADMIN-ADRESSEN` i `app/eas.json` med Vercel-adressen.
3. **Android** (testa direkt): `npx eas-cli@latest build --platform android --profile preview`. Du får en länk som går att installera på en Android-telefon.
4. **iPhone** kräver ett Apple Developer-konto (99 USD per år, helst i StarkMammas namn). Kör sedan `npx eas-cli@latest build --platform ios --profile preview`, eller använd `production` och `eas submit` för TestFlight.
5. För pushnotiser på Android behövs en Firebase-nyckel (FCM) som laddas upp i EAS. För iPhone ordnar EAS nyckeln automatiskt. Se Expos guide för push notifications.
6. **Logga in med Apple** måste läggas till innan appen kan publiceras i App Store, eftersom appen erbjuder Google och Facebook. Databasen är förberedd för det.

## 3. Prova med riktiga personer

1. Emma loggar in på datorn och skapar eller aktiverar några testdeltagare, gärna du själv.
2. Installera appen. Logga in, lämna återbud och boka. Låt Emma skicka en notis.
3. Skapa nästa omgång under **Omgångar** med anmälan och förtur. Prova att anmäla dig i appen och bekräfta i admin.

## Lokalt utan konton

Allt går att köra med påhittad data, utan några konton:

```bash
cd admin && npm install && npm run dev:demo
```

Admin finns då på http://localhost:5173. Logga in med `starkmammavarberg@gmail.com`, så visas koden på skärmen.

```bash
cd admin && npm test
```

Det kör 30 tester av reglerna: återbud, tillgodo, bokning, kö, flyttade pass, anmälan, fördelning, betalningar och inloggning.
