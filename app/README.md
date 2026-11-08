# StarkMamma-appen (prototyp)

Byggs först som **webbapp (PWA)** och sedan som **native-app** från samma Expo-kod. Se `docs/app-plan.md`.

En klickbar prototyp byggd med Expo (React Native) och TypeScript. Den använder bara påhittad testdata och har ingen backend än.

- **Deltagarläge:** nästa pass med "Jag kommer" och "Kommer inte", återbud som ger tillgodo om det lämnas senast dagen innan, bokning med tillgodo-pass, klippkort eller drop-in, kö, anmälan till ny omgång med första- och andrahandsval och kompis, betalningar med Swish-knapp, samt notiser
- **Tränarläge:** passlista med närvaro, förslag på fördelning av anmälningar med förtur och minimiantal, en vy för att skicka pushnotiser med mallar, samt betalningsöversikt
- Växla mellan lägena uppe till höger. En notis som skickas i tränarläget visas som en pushbanner och hamnar i deltagarens inkorg
- Prototypen låtsas att klockan är söndag 8/11 2026 kl 12.00 (`NOW` i `src/data.ts`)

## Kör

```bash
npm install
npx expo start        # skanna QR-koden med Expo Go på mobilen
npx expo start --web  # i webbläsaren
```

## Bygga webbappen

```bash
npx expo export --platform web   # statiska filer i dist/, kan läggas ut på t.ex. Vercel
```

- Filerna för installationen ligger i `public/`: `manifest.json`, ikoner, `sw.js` för Web Push och `index.html`
- Web Push-prenumerationen hanteras i `src/webpush.ts` och kräver `EXPO_PUBLIC_VAPID_PUBLIC_KEY`
- Native-push finns i `src/push.ts` och kräver ett EAS-projekt och ett utvecklingsbygge
