# Kartläggning: hur verksamheten fungerar i dag

Löpande anteckningar om hur tränaren driver verksamheten via Facebook, som underlag för appen.
Markeringen **(antagande)** betyder att det behöver bekräftas med tränaren.

## 1. Veckans uppsamlingsinlägg (varje helg)

Varje helg postar tränaren ett inlägg i Facebook-gruppen där deltagarna kommenterar ändringar för kommande vecka.

**Vad deltagarna gör i kommentarerna:**
- Anmäler att de **missar** sitt pass (kommande vecka eller längre fram i omgången)
- **Bokar** sig på ett pass med lediga platser
- Ställer sig på **reservlistan** för fulla pass
- Ska alltid skriva både **datum/dag och tid**, eftersom tränaren annars inte hittar rätt

**Regler:**
- För att få ett pass **tillgodo** eller kunna **byta** måste man lämna sin plats **i god tid**, så att någon annan hinner ta den
- Återbud med kort varsel **samma dag** ger inget tillgodo

**Lediga platser** listas för hand per pass, till exempel:
| Dag  | Tid   | Plats  |
|------|-------|--------|
| Mån  | 12.00 | Gymmet |
| Mån  | 17.30 | Ladan  |
| Tis  | 06.15 | Gymmet |
| Tis  | 17.30 | Gymmet |
| Tors | 16.20 | Gymmet |
| Tors | 17.30 | Ladan  |
| Tors | 18.45 | Ladan  |
| Fre  | 06.15 | Gymmet |

Ett exempelinlägg fick 18 kommentarer, som tränaren matchar ihop för hand.

## 2. Extrapass med intresseomröstning

Ibland erbjuds extrapass, till exempel "SöndagsFYS" sön 8/11 kl 17.00.
- Deltagarna **röstar fram** passet genom att kommentera, och de uppmanas tagga vänner som kan vara intresserade
- Passet blir av om **tillräckligt många** är intresserade **(antagande: det finns en minimigräns)**
- **Pris: 140 kr per gång eller ett klipp på 10-kort.** Det finns alltså klippkort och drop-in vid sidan av omgångarna

## 3. Påminnelse inför varje pass (dagen innan)

Inför varje pass postas ett inlägg, till exempel "Imorgon FRE 6/11 kl 06.15 i Gymmet".
- **Praktisk info:** bara rena inomhusskor i gymmet, ta med handduk och vattenflaska
- **Bokade:** en lista med alla deltagare som taggas, i exemplet 11 personer
  - Listan är uppdelad i grupper med tomrad emellan **(fråga: ordinarie, inbokade och tillgodo?)**
- **Gilla** om du kommer och **kommentera** om du inte kommer, vilket fungerar som närvarobekräftelse
- Återbud kommer alltså in på flera ställen: i helgens uppsamlingsinlägg **och** i varje passinlägg
- I exemplet lämnade två personer återbud som inte fanns med på listan över bokade. Antingen var listan inte uppdaterad eller så hamnade återbuden i fel inlägg. Det är precis den här typen av fel som appen ska ta bort

## 4. Försäljning av produkter (merch)

Ibland säljs profilprodukter, till exempel "Tröja till AdventsMYSet": en Craft-tröja med StarkMamma-tryck.
- **Storlekar S–XXL.** Provexemplar finns i lokalen, och man får bara prova dem rena, alltså inte efter passet
- **Beställning:** man skriver namn och storlek på ett papper i lokalen
- **Sista dag:** fre 6/11, vilket gör det till en förbeställning med deadline
- **Betalning:** man Swishar 280 kr till StarkMamma samtidigt som man beställer
- Tränaren måste sedan stämma av papperslistan mot Swish-betalningarna för hand
- **AdventsMYS** verkar vara ett återkommande event, och tröjan hör ihop med det **(fråga: vad är AdventsMYS?)**

## 5. Vad det säger om verksamheten

- **Omgångar:** träningen säljs i perioder om flera veckor **(antagande: deltagaren köper en omgång)**
- **Ordinarie pass:** varje deltagare har en fast tid per vecka **(antagande)**
- **Två lokaler:** "Gymmet" och "Ladan"
- **Begränsat antal platser per pass**, och när en plats lämnas kan någon annan ta den
- **Tillgodo-pass:** ett uteblivet pass kan bytas mot ett annat om man lämnat återbud i tid, så tränaren måste hålla koll på ett saldo per person
- **Betalformer:** omgång, 10-kort och drop-in för 140 kr
- **Varumärke:** StarkMamma, med eget Swish-nummer
- **Sidointäkter:** profilprodukter och event
- **Passtyper:** ordinarie pass och extrapass, där extrapassen kräver tillräckligt intresse
- Det manuella arbetet ligger i att läsa kommentarer, uppdatera vilka platser som är lediga, flytta folk från reservlistan och komma ihåg tillgodo-pass

## 6. Vad appen behöver göra (första utkast)

1. **Schema per omgång:** pass med dag, tid, lokal och max antal platser
2. **Ordinarie plats:** varje deltagare kopplas till sitt fasta pass i omgången
3. **Lämna återbud** med ett klick, där appen själv vet datum och tid och platsen blir ledig direkt
4. **Tillgodo-regler:** återbud före en gräns, till exempel dagen innan, ger ett tillgodo-pass och senare återbud ger inget
5. **Boka ledig plats** med tillgodo-pass, och se lediga platser i realtid i stället för en lista som tränaren skriver
6. **Reservlista** per pass, med notis när en plats blir ledig och möjlighet att bli flyttad in automatiskt eller ta platsen med ett klick
7. **Påminnelse dagen innan** via pushnotis, med praktisk info och knapparna "Jag kommer" och "Jag kommer inte" (återbud enligt samma regler som ovan)
8. **Extrapass:** tränaren föreslår ett pass, deltagare anmäler intresse, passet bekräftas när minimigränsen nås och betalas med klipp eller 140 kr
9. **Klippkort:** saldo per deltagare som dras automatiskt vid bokning
10. **Förbeställning av produkter:** produkt med bild, länk, storlekar, pris och sista dag. Deltagaren väljer storlek och betalar, och tränaren får en färdig beställningslista per storlek
11. **Betalningar:** samla omgång, klippkort, drop-in och produkter, med Swish-integration eller åtminstone markeringen "betald", så att avstämningen sker automatiskt
12. **Tränarvy:** vem som kommer på varje pass, saldo per deltagare och eventuella manuella justeringar

## 7. Öppna frågor till tränaren

- Hur långa är omgångarna, och vad kostar en omgång? Hur tas betalt?
- Har alla exakt ett ordinarie pass per vecka, eller finns det 2x/vecka-kort?
- Vad betyder "i god tid" exakt? Är det 24 timmar innan, dagen innan eller något annat?
- Hur många platser finns per pass? Skiljer det sig mellan Gymmet och Ladan?
- Kan tillgodo-pass sparas till nästa omgång, eller förfaller de?
- Reservlista: får den som står först platsen automatiskt, eller den som svarar först?
- Hur många klipp har ett 10-kort, vad kostar det, och har det ett sista giltighetsdatum?
- Hur många behövs för att ett extrapass ska bli av? Får man fortfarande boka extrapass om omgången är full?
- Vad betyder grupperna i listan över bokade?
- Hur betalas 140 kr i dag, till exempel med Swish?
- Vad är AdventsMYS, och finns det fler event under året, till exempel med anmälan och avgift?
- Hur ofta säljs produkter, och sker det alltid som förbeställning?
- Är Swish för företag kopplat till ett företagskonto? Det avgör om betalningar kan stämmas av automatiskt
- Vad mer sker i gruppen, till exempel peppning, info och träningstips, som ska finnas kvar?
