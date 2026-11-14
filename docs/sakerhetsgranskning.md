# Säkerhetsgranskning november 2026

En oberoende granskning av koden (en separat agent som läste koden utan att känna till tidigare slutsatser) och attacktester i `admin/dev/attack.test.ts`. Alla fynd nedan är rättade och har ett test som visar att felet är borta. Totalt finns 82 tester.

## Allvarligt (rättat)

| Fynd | Rättning |
|---|---|
| Inloggningskoden kunde gissas fram med tusentals samtidiga försök, så att någon kunde ta över vilket konto som helst, även Emmas | Varje försök räknas atomiskt innan koden jämförs: högst 5 försök per kod. Koden kan bara användas en gång |
| Dubbelklick på "betald" gav två kvitton och två klippkort. Om man ångrade togs inte klippkortet bort | Betald markeras atomiskt. Klippkortet är kopplat till betalningen och tas bort när betalningen ångras, om kortet inte har använts |
| Samma tillgodo-pass kunde användas till flera pass om man bokade samtidigt | Tillgodo-passet låses och tas i en och samma operation |
| Dubbelklick på bekräfta eller köp gav dubbla betalningskrav | Atomisk statusändring och unikt index |

## Medel (rättat)

| Fynd | Rättning |
|---|---|
| "Jag har swishat" kunde ge onlinetillgången tillbaka efter att Emma tagit bort den | Tillgång ges bara första gången, och när Emma tar bort tillgången stryks den obetalda beställningen |
| Ett återbud kunde ångras samtidigt som tillgodo-passet användes, och då fick man både platsen och ett gratis pass | Ångra sker i en sats som låser tillgodo-passet |
| Återbud på ett pass som Emma redan ställt in gav ett tillgodo-pass | Inställda pass går inte att lämna återbud på, ångra eller svara "kommer" på |
| Appens Google- och Facebook-inloggning skickade inloggningen i en `starkmamma://`-länk som en annan app på Android kunde fånga | Länken innehåller nu bara en engångskod som gäller i 5 minuter och kan bytas bara med appens hemliga PKCE-verifierare |
| Inloggningar kunde inte återkallas, och avböjda konton behöll viss åtkomst | Varje inloggning bär en version. "Logga ut överallt", ett avböjt konto eller en radering gör alla gamla inloggningar ogiltiga. Webben får inte längre inloggningen i svaret, bara en HttpOnly-cookie |

## Mindre (rättat)

- "Idag" räknas i svensk tid, inte i UTC. Annars blev det fel strax efter midnatt.
- Emmas konto kopplas aldrig automatiskt till ett Facebook-konto via e-post.
- Telefonnummer kan inte längre "paxas" av någon annan. Numret används inte för inloggning.
- Opublicerade filmer går inte att spela i förväg.
- Kön får ingen notis om lediga platser på ett inställt pass.
- Index för betalningar. Filmstatus hämtas parallellt. Den dagliga påminnelsen skickar inga dubbletter om den körs om.
- Mejlgränserna för inloggning kontrolleras atomiskt.
- GDPR:
  - Deltagaren kan hämta alla sina uppgifter (`/api/my-data`).
  - Emma kan radera en persons uppgifter. Betalningar och kvitton sparas utan namn, enligt bokföringslagen.
  - Gamla inloggningskoder med IP-adress raderas efter 30 dagar.

## Kvar att göra

- **Verifierade appländar (App Links och Universal Links):** gör att bara StarkMamma-appen kan öppna inloggningslänken. PKCE skyddar redan inloggningen, så detta är ett extra lager.
- **Hälsoanteckningar** finns i databasen men används inte än. Innan de används behövs samtycke, och de ska bara visas för Emma.
- **Personuppgiftsbiträdesavtal (PUB-avtal)** med Neon, Vercel, Resend och Bunny, och en integritetspolicy i appen. Det senare krävs också av Apple, Google och Facebook.
