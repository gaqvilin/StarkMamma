# StarkMamma-appen

Deltagarnas app för iPhone och Android, byggd med Expo (React Native) och TypeScript. Den är kopplad till samma API som Emmas admin (`../admin/api`).

## Vad finns

- **Inloggning:** e-post och kod, eller Google eller Facebook (på mobilen). Nya konton fyller i namn och mobilnummer och väntar sedan på att Emma aktiverar dem
- **Deltagare:**
  - Hem: nästa pass med "Jag kommer" och "Kommer inte", mina pass, återbud och ångra, samt tillgodo-pass
  - Boka: pass de närmaste två veckorna, med tillgodo-pass, klipp eller drop-in, och kö när passet är fullt
  - Anmälan: nästa omgång med förtur, första- och andrahandsval, kompis och delbetalning
  - Betala: knappen öppnar Swish med mottagare, belopp och meddelande ifyllda och låsta. Efteråt trycker man "Jag har swishat", och Emma ser det i admin. Här finns också kvitton och klippkort
  - Notiser: klockan uppe till höger, med informationssidor
- **Emma** (rollen `trainer`) får admin i appen:
  - Pass: veckan, aktivera nya konton, byt lokal, ställ in och registrera återbud
  - Anmälningar: bekräfta enligt förslaget
  - Skicka: notiser med informationssida
  - Betalningar: markera betald och påminn
- **Pushnotiser:** mobilen registrerar sig (`src/push.ts`) och skickar sin push-adress till servern (`/api/push-token`). Ett tryck på en notis öppnar den, eller dess informationssida

## Kör lokalt mot demodatabasen

```bash
cd ../admin && npm run dev:demo
```

Kör sedan detta i den här katalogen, i ett annat fönster:

```bash
EXPO_PUBLIC_API_URL=http://localhost:5173 npx expo start --web
```

Logga in med en e-postadress från demodatan, till exempel `anna.berg@example.com`, eller med `starkmammavarberg@gmail.com` för Emma. Koden visas på skärmen i testläget.

## Bygga för mobilen (EAS)

Steg för steg finns i [`../docs/driftsattning.md`](../docs/driftsattning.md). I korthet: `npx eas-cli@latest init`, ersätt `EXPO_PUBLIC_API_URL` i `eas.json` med admin-adressen, och kör sedan `npx eas-cli@latest build --profile preview`.
