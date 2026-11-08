# App-plan: StarkMamma

Bygger på [kartlaggning.md](kartlaggning.md).

## Mål

Flytta det **administrativa** från Facebook, pärmar och sms till ett ställe, så att tränaren slipper matcha kommentarer och stämma av betalningar för hand, och så att deltagarna alltid ser sitt schema, sina tillgodo-pass och sina betalningar.

Gemenskapen behöver **inte** flyttas i första versionen. Facebook-gruppen kan fortsätta för pepp och sociala inlägg medan appen tar hand om bokningar och betalningar. Det sänker tröskeln för att komma igång.

## Användare

- **Deltagare**, cirka 100 personer **(antagande)**. Alla är inte på Facebook, så inloggning och notiser måste fungera via e-post eller sms
- **Tränare och administratör:** en person, ofta i farten, så allt måste fungera bra i mobilen

## Avgränsning

StarkMamma har flera träningsformer: crosstraining, mammaträning med bebis, graviditetsträning, online-träning, individuell träning, kostrådgivning och hinderbana. **Version 1 byggs för crosstraining**, men datamodellen görs så att en omgång alltid hör till en **träningsform**. Mammaträning, som också går i omgångar, kan då läggas till nästan gratis.

## Version 1: ersätta veckans manuella arbete

**Omgångar och anmälan**
- Tränaren skapar en omgång med veckor, grupper (dag, tid, lokal, antal platser), priser för 1, 2 och 3 gånger i veckan, sista betalningsdag och undantag, till exempel "v 47: tors och fre flyttas till ons"
- **Anmälningsfönster med förtur:** först får nuvarande deltagare anmäla sig, och vid en angiven tidpunkt öppnar anmälan automatiskt för nya. Nya deltagare kan registrera sig i förväg och få en notis när anmälan öppnar
- **Anmälan:** deltagaren väljer hur många gånger i veckan hen vill träna, rangordnar sina val (första och andra hand), kan anmäla sig tillsammans med en kompis och väljer betalningsplan. Delbetalning finns bara för 2 och 3 gånger i veckan
- **Rättvis hantering av trycket:** varje anmälan får en exakt tidsstämpel på servern och sparas säkert även om hundra personer anmäler sig samtidigt. Deltagaren ser direkt om förstahandsvalet har plats eller om hen hamnat på väntelista
- **Tränaren fördelar och bekräftar:** appen ger ett förslag på fördelning utifrån tid, val och kompispar. Tränaren justerar och bekräftar alla på en gång, och varje deltagare får en bekräftelse med betalningsinfo
- **Minimiantal:** grupper med färre än 14 anmälda markeras, så att tränaren kan stryka eller slå ihop dem och erbjuda de anmälda ett andrahandsval
- Därefter ser deltagaren vad hen ska betala och när

**Mitt schema**
- Deltagaren ser sina kommande pass med lokal och eventuella ändringar
- **Lämna återbud** med en knapp. Appen avgör själv om återbudet ger tillgodo, alltså om det lämnas senast dagen innan, annars "brinner" passet inne
- **Boka ett annat pass** med ett tillgodo-pass om det finns plats, annars ställer man sig i kö. Tillgodo-pass gäller bara inom omgången

**Passlista och närvaro**
- Tränaren ser vilka som kommer på varje pass, inklusive inbokade och reserver
- Dagen innan skickas en påminnelse till deltagarna med lokal och praktisk info, och svarsknapparna "Jag kommer" och "Jag kommer inte"
- När en plats blir ledig får den som står först i kön en notis **(regeln behöver bekräftas)**
- **Ledig plats i sista minuten:** när någon avbokar samma dag går en pushnotis eller ett sms direkt till kön och till dem som valt att få sådana notiser, och den som svarar först får platsen. Det ersätter inlägg som "Hojta om någon vill komma!"

**Betalningar, enkel variant**
- Varje deltagare har en lista över vad hen ska betala och har betalat: omgång, delbetalningar och extrapass
- **Swish-knapp** som öppnar Swish med belopp och meddelande ifyllt. Tränaren markerar som betalt, och appen visar en översikt över vem som har betalat och vem som inte har det
- Automatisk **betalningspåminnelse** före sista dag, bara till dem som inte betalat
- **Digitalt kvitto** i appen i stället för pärmen, som PDF med de uppgifter som krävs för **friskvårdsbidrag**

**Notiser**
- **Notis med informationssida:** Emma kan koppla en sida med rubrik, längre text och en länk till en notis, och när deltagaren trycker på notisen öppnas sidan. Det används för sådant som inte har en egen funktion i appen, till exempel event, gruppbeställningar, utmaningar och ändrade rutiner. Sidan finns kvar i inkorgen
- Pushnotiser för den som installerat appen, annars e-post, och sms för brådskande saker som ändrad lokal eller inställt pass

## Version 2: extraträning och småköp

- **10-kort:** köp, saldo, 12 månaders giltighet och automatiskt klipp vid bokning. Det gäller inte special- och fokuspass
- **Drop-in för 140 kr** på lediga platser i ordinarie pass
- **Extrapass:** tränaren lägger ut ett förslag med en minimigräns, deltagarna anmäler intresse och kan bjuda in vänner via länk. Passet bekräftas automatiskt när gränsen nås
- **Kylflik:** deltagaren registrerar köp i appen, kanske via en QR-kod på kylen, och appen räknar ihop en summa att Swisha med jämna mellanrum

## Version 3: försäljning och information

- **Förbeställning av produkter:** produkt med bilder, storlekar, pris och sista dag. Tränaren får en sammanställning per storlek och en betalstatus per person
- **Gruppbeställning:** ett formulär med länk, storlek, färg och antal i stället för skärmdumpar. Appen räknar ut rabatten, och tränaren får en samlad lista, en lista att bocka av när varorna hämtas och en betalstatus
- **Event:** till exempel AdventsFYS och AdventsMYS. Eventet har datum, pris och max antal deltagare, och anmälan kan innehålla val som tröjstorlek. Deltagaren betalar vid anmälan och kan bjuda in vänner via länk, även vänner som inte är medlemmar. Tränaren får deltagarlistan och en sammanställning av storlekar till tröjbeställningen
- **Utmaningar:** till exempel HÖST-bingo, som en bricka i appen. Deltagaren bockar av aktiviteter med datum, och den som fyllt hela brickan kommer automatiskt med i utlottningen, som appen kan dra. Det ersätter PDF, utskrifter och foton i gruppen
- **Presentkort och 5-gångerskort**, till exempel som vinster, med giltighetstid. De fungerar som ett slags klippkort
- **Fler träningsformer:** mammaträning med bebis i omgångar, och bokning av individuell träning och kostrådgivning med tider i tränarens kalender
- **Online-träning:** pass och övningsvideor i appen i stället för slutna Facebook-grupper
- **Publik sida och intresseanmälan:** schemat och kommande omgångar hämtas automatiskt från appen, så att hemsidan aldrig är inaktuell. Intresseanmälan blir en lista som tränaren kan bjuda in från när en ny omgång öppnar
- **Info:** omgångens info som en sida i appen i stället för PDF, och en sida om lokalerna med karta och parkering
- **Hälsoanteckningar:** frivilliga och bara synliga för tränaren, med uttryckligt samtycke enligt GDPR

## Teknik

**Webbapp först, native-app sedan, med samma kod.** Appen byggs med **Expo (React Native) och TypeScript**, som kan byggas både som webbapp och som riktiga appar för iPhone och Android. Webbappen kommer ut snabbare, och native-appen blir sedan ett bygge av samma kod, inte en omskrivning.

### Fas 1: webbapp som kan installeras (PWA)
- Webbappen publiceras på en egen adress, till exempel `app.starkmamma.com` via Vercel. Deltagarna får länken via sms, e-post och Facebook
- **Installation:** deltagaren lägger appen på hemskärmen och får då egen ikon och helskärmsläge
- **Pushnotiser (Web Push)** via service worker (`public/sw.js`) och VAPID-nycklar (`src/webpush.ts`). Det fungerar på Android och dator, och på iPhone med iOS 16.4 eller senare **om appen ligger på hemskärmen**. Appen visar hur man installerar den på iPhone
- Sms och e-post fungerar som reserv för den som inte installerat appen eller har stängt av notiser

### Fas 2: native-appar i App Store och Google Play (krav)
- Samma kod byggs med **EAS Build** och publiceras med **EAS Submit**. EAS Update gör att rättningar kan skickas ut utan ny granskning i App Store
- Pushnotiserna går då via `expo-notifications` (`src/push.ts`), alltså genom Apple (APNs) och Google (FCM). Backend skickar till den kanal varje deltagare har: native-push, Web Push eller sms
- **Konton som krävs:** Apple Developer (99 USD per år) och Google Play Console (25 USD en gång), helst i StarkMammas namn
- **Native-appen är bekräftad som krav**, eftersom pushnotiser är huvudskälet till appen. Webbappen är ett steg på vägen för att testa flödena snabbt, inte slutmålet
- Kod som bara fungerar i webbläsaren ska undvikas i de delade skärmarna, och notislogiken i backend byggs från början för native-push via Expo Push API, med Web Push som tillägg

### Gemensamt
- **Backend: Neon Postgres och Vercel**, samma upplägg som padelappen (RankedInKids). Databasen är Neon-projektet `starkmamma` i Frankfurt (EU), och API:et körs som serverless-funktioner på Vercel (`/api`). Där finns inloggning med engångskod via sms eller e-post, utskick av push via Expo Push API och Web Push, och schemalagda jobb som "dagen innan"-notisen och betalningspåminnelser. Schemat finns i `db/migrations/`
- **Swish:** först Swish-länkar med ifyllt belopp och meddelande och manuell markering av betalningar. Senare Swish Handel för automatisk avstämning
- **Regler i webbappen:** kod som bara fungerar i native-appen eller bara i webbläsaren hålls i egna filer, till exempel `push.ts` och `webpush.ts`, så att konverteringen förblir smärtfri

## Datamodell (grov)

```
Person            id, namn, e-post, telefon, roll (deltagare/tränare), notiskanaler
Träningsform      id, namn (crosstraining, mammaträning, ...)
Omgång            id, träningsform, namn, startvecka, slutvecka, sista_betaldag, delbetal_sista_dag
Prisnivå          omgång, gånger_per_vecka, pris, första_delbetalning
Grupp             omgång, veckodag, tid, lokal, max_platser, typ (ordinarie/special/fokus)
Passtillfälle     grupp | null, datum, tid, lokal, status (planerat/flyttat/inställt), typ (ordinarie/extra)
Anmälan          person, omgång, prisnivå, betalplan, tidsstämpel, kompis, status (väntar/bekräftad/väntelista)
Anmälningsval    anmälan, grupp, rang (1, 2, ...)
Inskrivning       person, omgång, prisnivå, betalplan
Gruppmedlemskap   person, grupp
Bokning           person, passtillfälle, källa (ordinarie/tillgodo/drop-in/klippkort/extra), status (bokad/återbud_i_tid/sent_återbud/närvarande)
Tillgodo          person, omgång, från_bokning, använd_på_bokning
Kö                person, passtillfälle, position, skapad
Klippkort         person, köpt_datum, giltigt_till, klipp_kvar
Betalningskrav    person, belopp, förfallodag, avser (omgång/delbetalning/drop-in/klippkort/produkt/kylflik), status
Betalning         betalningskrav, belopp, datum, sätt (swish/bank), referens
Event, Eventanmälan (val, t.ex. storlek)        (version 3)
Utmaning, Utmaningsaktivitet, Avbockning       (version 3)
Produkt, Beställning, Beställningsrad, Kylköp   (version 2–3)
Klippkort används även för 5-gångerskort och presentkort, med typ och antal klipp
```

Det svåraste i början är **anmälningsrusningen**, som kräver att flera samtidiga anmälningar inte kan ge dubbelbokningar och att fördelningen blir rättvis, och därefter reglerna kring tillgodo-pass, kö och flyttade pass, så det behöver testas ordentligt.

## Arbetsordning

1. **Validera med tränaren:** gå igenom kartläggningen och svaren på de öppna frågorna, och visa skisser på deltagarens och tränarens viktigaste vyer
2. **Klickbar prototyp** (finns i `app/`) av "Mitt schema", återbud, bokning, anmälan, passlista, push och betalningar. Testa den på tränaren och 3–5 deltagare, gärna någon som inte är på Facebook
3. **Bygga version 1 som webbapp** i ungefär 4–6 veckor **(grov uppskattning)**
4. **Pilot** med en grupp under en omgång parallellt med Facebook
5. **Hela omgången i appen** från nästa omgångsstart
6. **Native-appar** i App Store och Google Play från samma kod, och därefter version 2 och 3 efter behov

## Risker

- **Ovana användare:** appen måste vara extremt enkel och fungera för den som bara använder e-post eller sms
- **Nya rutiner för tränaren:** inför appen gradvis, och behåll Facebook för det sociala
- **Betalningar:** manuell markering först. Automatisk avstämning kräver Swish Handel
- **GDPR:** hälsoanteckningar är känsliga personuppgifter, så de ska vara frivilliga och kräva samtycke. Uppgifterna ska lagras inom EU, och Neon-databasen ligger i Frankfurt
