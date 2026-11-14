# Databas (Neon Postgres)

- **Projekt:** `starkmamma` (id `square-smoke-72434828`), region AWS eu-central-1 (Frankfurt), Postgres 18
- **Organisation:** samma Neon-organisation som padelappen. Gratisplanen räcker gott för en verksamhet i den här storleken

| Fil | Innehåll |
|---|---|
| `migrations/001_init.sql` | Tabeller för deltagare, push-token, träningsformer, omgångar, priser, grupper, pass, anmälningar, bokningar, kö, tillgodo-pass, klippkort, betalningskrav, betalningar och notiser med informationssida |
| `migrations/003_login_codes.sql` | Engångskoder för inloggning |
| `migrations/004_identities.sql` | Kopplingar till Google- och Facebook-konton |
| `migrations/006_operations.sql` | Vardagsdrift: föregående omgång (för förtur), flyttade pass, bokningar kopplade till klippkort och avgifter, betalningskrav kopplade till anmälan |
| `migrations/007_acknowledgements.sql` | Notiser som kräver bekräftelse ("Jag har läst") och påminnelser |
| `migrations/008_reported_payments.sql` | Deltagaren kan meddela att hon har swishat |
| `migrations/009_online_and_challenges.sql` | Onlineträning (program, pass i text eller film, tillgång, avbockning) och utmaningar (bingo, avbockning med datum, vinnare) |
| `migrations/005_self_signup.sql` | Egen registrering: kontostatus (väntar/aktiv/avböjd) och koder till nya e-postadresser |
| `migrations/002_seed_ct_v45_51.sql` | Emma som tränare och CT-omgång v 45–51 2026 med priser, 10 grupper och 70 pass, inklusive de flyttade passen v 47 och v 51 |

Alla filer är redan körda mot Neon-projektet. Anslutningssträngen hämtas från Neon och läggs som `DATABASE_URL` i Vercel. Den ska aldrig checkas in.
