# Film och betalning

## Film i onlineträningen

I dag läggs filmerna i slutna Facebook-grupper. I appen finns två sätt att hantera dem.

**1. Uppladdning direkt i admin, via Bunny Stream (rekommenderas)**
- Emma sparar passet och trycker **Ladda upp film**. Filen går direkt från hennes dator till Bunny, utan att passera vår server. Uppladdningen fortsätter efter ett avbrott, vilket behövs för stora filer.
- Bunny kodar om filmen till flera upplösningar och spelar den adaptivt. På mobilen får man alltså en komprimerad version som passar uppkopplingen. Ställ in högsta upplösning till **720p** i biblioteket för att spara lagring och data: det räcker gott för en telefon.
- Filmen kan bara ses via en **signerad länk som slutar gälla efter 4 timmar**. Länken hämtas av appen först när någon som har tillgång trycker *Spela filmen*. Länkar som delas vidare slutar alltså fungera.
- Admin visar statusen *Film laddas upp*, *Film komprimeras* och *Film klar*.
- **Kostnad:** Bunny tar betalt per gigabyte för lagring och för det som tittas på, och priset per gigabyte är lågt. För 30 filmer på 30 minuter i 720p och runt 100 tittare landar det sannolikt på några tior i månaden. Kontrollera aktuella priser på bunny.net innan beslut. Bunny är ett europeiskt företag.

**2. Länk till olistad film på YouTube eller Vimeo**
- Det är gratis, och YouTube komprimerar också för mobilen.
- Nackdelen är att den som får länken kan se filmen utan att ha betalat.

### Sätta upp Bunny Stream
1. Skapa ett konto på bunny.net → **Stream** → **Add Video Library**. Välj en region i Europa.
2. Under bibliotekets **Encoding**: välj upplösningar upp till 720p.
3. Under **Security**: slå på **Token Authentication** och kopiera *Token Authentication Key*. Lägg också in admin-adressen och appen som tillåtna domäner om Bunny frågar efter det.
4. Lägg in följande i Vercel: `BUNNY_LIBRARY_ID` (bibliotekets id), `BUNNY_API_KEY` (bibliotekets API-nyckel, under API) och `BUNNY_TOKEN_KEY`.
5. Ladda upp en testfilm och spela den i appen.

Formaten för uppladdning och signerade länkar följer Bunnys dokumentation och är testade mot en simulerad Bunny. De behöver kontrolleras mot ett riktigt konto vid steg 5.

## Varför Emma behöver markera betalningar

Med ett vanligt **Swish-nummer för företag** finns ingen koppling där Swish talar om för en annan tjänst att en betalning har kommit. Pengarna och notisen hamnar bara i Emmas Swish-app och på banken. Appen kan därför inte veta säkert att någon har betalat.

**Så fungerar det nu:**
- Appen öppnar Swish med belopp och meddelande ifyllda. Efteråt trycker deltagaren **Jag har swishat**.
- **Onlineträning:** tillgången kommer direkt när deltagaren trycker *Jag har swishat*, så ingen behöver vänta. Emma ser *Swishat, kontrollera* och markerar betalningen när hon sett pengarna. Kom de aldrig in ångrar hon, och tillgången försvinner.
- **Omgångar, extrapass och event:** Emma ser överst under Betalningar vilka som säger att de har swishat, och markerar dem med ett klick.

**Helt automatiskt kräver något av följande:**
1. **Swish Handel**, ett avtal med banken. Då får servern ett meddelande från Swish för varje betalning. Det kostar en avgift per transaktion och ofta en fast avgift, och kräver ett certifikat. Appen är förberedd: när en betalning bekräftas markeras den som betald precis som när Emma gör det.
2. **En betaltjänst med Swish**, till exempel Svea, Swedbank Pay eller Stripe, om de erbjuder Swish för den här typen av företag. Det ger också automatisk bekräftelse, mot en avgift per betalning.

Med den här storleken på verksamheten räcker troligen *Jag har swishat* tillsammans med Emmas markering. Automatisk bekräftelse kan läggas till senare utan att något annat behöver byggas om.
