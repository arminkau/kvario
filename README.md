# Kvario

Se direkt hur mycket av det du fakturerar som faktiskt är dina pengar.

## Kom igång lokalt

```bash
npm install
npm run dev
```

Öppna adressen som skrivs ut. Datan sparas i webbläsaren.

## Struktur

```
index.html          Sidans skal
src/main.jsx        Startpunkt
src/App.jsx         Hela appen
src/storage.js      Var datan sparas — byt läge här, inte i App
src/billing.js      Prat med Stripe via din server
server/server.js    Prenumerationsservern (behövs först vid riktig betalning)
```

## Deploy — frontend

Lägg projektet på GitHub. Koppla repot i Vercel, Netlify eller Cloudflare Pages.
Alla tre hittar Vite automatiskt: `npm run build`, utdata i `dist`. Gratis.

## Deploy — servern

Servern kan INTE ligga på Vercels vanliga statiska hosting.
Lägg `server/`-mappen på Railway, Render eller Fly.io.

1. Skapa produkten "Kvario Pro" i Stripe med två priser (99 kr/mån, 990 kr/år)
2. Sätt miljövariablerna enligt `server/.env.example`
3. Peka Stripes webhook mot `https://din-server/stripe-webhook`
4. Sätt `VITE_API_URL` i frontendens miljövariabler och bygg om

## Viktigt

Aktivera aldrig Pro utifrån `success_url`. Vem som helst kan öppna den adressen.
Bara webhooken vet att pengarna faktiskt kom fram.

## Inloggning

Appen kör utan konto som standard och sparar i webbläsaren.
Sätt Supabase-nycklarna i `.env` för riktiga konton och synk mellan enheter.

1. Skapa gratis projekt på supabase.com
2. SQL Editor → klistra in `supabase/schema.sql` → Run
3. Settings → API → kopiera Project URL och anon-nyckeln till `.env`
4. Authentication → URL Configuration → lägg in din Vercel-adress
5. Vill du ha Google: Authentication → Providers → Google

anon-nyckeln är publik med flit. Det som skyddar datan är Row Level
Security i databasen — varje användare når bara sin egen rad.

Planen ligger i en egen tabell som användaren bara får läsa. Låg den i
samma tabell som datan kunde vem som helst göra sig själv till Pro.

### BankID

Kräver återförsäljare (Criipto, Signicat, Scrive) som ger dig BankID som
OIDC-leverantör. Kopplas in under Authentication → Providers.
Kostar löpande och fungerar bara i Sverige — lägg till det som komplement
till e-postinloggningen, aldrig som ersättning. Se kommentaren i `src/auth.js`.


## Orderbekräftelse via e-post

Skickas från webhooken på `invoice.paid` — aldrig från frontend, eftersom
bekräftelsen bara får gå ut när pengarna faktiskt kommit fram.

1. Skapa konto hos Resend, verifiera din domän
2. Sätt `RESEND_API_KEY` och `EPOST_AVSANDARE` på servern
3. Fyll i `FORETAG_NAMN`, `FORETAG_ORGNR`, `FORETAG_ADRESS`, `FORETAG_EPOST`,
   `FORETAG_MOMSNR` — de måste stå på bekräftelsen

Utan verifierad domän hamnar breven i skräpposten.

### Leveransbarhet — tre DNS-poster

Utan dessa hamnar orderbekräftelserna i skräpposten. Alla tre sätts hos din
DNS-leverantör, samma ställe som domänen pekar mot Vercel.

**SPF** — talar om vilka servrar som får skicka som din domän.
Resend ger dig exakt värde vid domänverifieringen. Har du redan en SPF-post
ska du lägga till i den, inte skapa en till — två SPF-poster gör att båda
underkänns.

**DKIM** — signerar breven kryptografiskt. Resend genererar nyckeln och ger
dig en CNAME att lägga in. Detta är den viktigaste posten.

**DMARC** — säger vad mottagaren ska göra med brev som inte klarar SPF eller
DKIM. Börja mjukt:

    Namn:  _dmarc
    Typ:   TXT
    Värde: v=DMARC1; p=none; rua=mailto:din@epost.se

Kör med `p=none` några veckor, läs rapporterna, skärp sedan till
`p=quarantine`. Att börja med `p=reject` innan allt fungerar gör att dina egna
brev försvinner.

**Skicka från en underdomän**, exempelvis `no-reply@post.dindoman.se`. Går
något fel med rykte för utskicken påverkas inte din vanliga e-post.

Testa på mail-tester.com innan lansering — den ger poäng och pekar ut vad som
saknas.

### Ångerrätten

För digitala tjänster upphör ångerrätten bara om kunden uttryckligen begärt
omedelbar leverans OCH bekräftat att ångerrätten då går förlorad. Kryssrutan i
betalflödet fångar samtycket, det följer med till Stripe som metadata, och står
i bekräftelsen. Utan det har kunden 14 dagars ångerrätt även efter att ha använt
tjänsten.


## Databasen

### Så når du den

**Supabase Studio** på supabase.com är det vanliga sättet. Table Editor för att
bläddra och redigera, SQL Editor för frågor, Logs för att felsöka.

Vanliga frågor att spara under SQL Editor:

```sql
-- Intäkter per månad
select date_trunc('month', betald_at) as manad,
       count(*) as antal,
       sum(belopp_ore)/100.0 as brutto,
       sum(moms_ore)/100.0 as moms,
       sum(aterbetalt_ore)/100.0 as aterbetalt
from orders group by 1 order by 1 desc;

-- Aktiva prenumeranter
select plan, count(*) from subscriptions group by plan;

-- Pågående provperioder
select count(*) from subscriptions
where plan = 'free' and trial_start > now() - interval '14 days';
```

Behöver du komma åt databasen från ett verktyg som TablePlus eller psql finns
anslutningssträngen under Settings → Database. Använd poolern (port 6543) och
inte direktanslutningen.

### Backup

Supabase tar dagliga automatiska säkerhetskopior på betalplanerna. På gratisnivån
gör den inte det — exportera själv tills du uppgraderar:

```
pg_dump "din-anslutningsstrang" > kvario-backup-$(date +%F).sql
```

Bokföringsunderlag ska sparas i sju år. Låt inte det ligga i en gratisdatabas utan
egen kopia.

## Återbetalningar

Två vägar, båda loggas i `orders`.

**Via Stripes kontrollpanel** — Payments → hitta betalningen → Refund. Enklast
när det gäller enstaka fall. Webhooken `charge.refunded` skriver till databasen
automatiskt.

**Via API:et**, för hela eller delvis belopp:

```bash
curl -X POST https://din-server/admin/aterbetala \
  -H "x-admin-token: DIN_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ordernummer":"K-2026-0001","belopp":990,"orsak":"Ångerrätt"}'
```

Utelämnas `belopp` återbetalas hela det som återstår. Lista ordrar med
`GET /admin/ordrar` och samma token.

**Kom ihåg momsen.** Återbetalar du 990 kr återbetalar du också 198 kr moms som
du redan redovisat. Den justeras i nästa momsdeklaration — prata med din
redovisningskonsult om hur den ska bokföras.

Återbetalning avslutar inte prenumerationen automatiskt. Säg upp den i Stripe
om kunden ska sluta, annars debiteras de igen nästa period.

## Kapacitet

Tusen användare är lite för den här arkitekturen. Några siffror för perspektiv:
tusen användare med ett par hundra fakturarader var blir några megabyte data
totalt, och Postgres hanterar det utan att märka det.

Det som faktiskt kan gå sönder vid den volymen är annat:

**Kallstarter.** Sover servern på Render eller Railways gratisnivå tar första
anropet tio sekunder. Betalar du några dollar i månaden försvinner problemet.
Detta är den enda "optimering" som märks av användarna.

**E-postkvoten.** Resends gratisnivå ger 100 brev om dagen. Tusen användare med
årsprenumeration ger några brev om dagen i snitt — men förnyelser klumpar ihop
sig. Kontrollera kvoten innan du passerar några hundra kunder.

**Webhooks som körs långsamt.** Svarar servern inte inom några sekunder gör
Stripe om leveransen. Därför är idempotensspärren viktigare än prestanda: den
gör att en omkörning inte skapar dubbla ordrar.

Bygg inte cache, köer eller läsrepliker för tusen användare. Det är arbete som
inte gör något för någon förrän långt senare.


## Adminpanel

Syns bara för användare med adminroll. Rollen ligger i tabellen `roller` som
användaren bara får läsa — aldrig skriva. Gör dig själv till admin efter att du
registrerat dig:

```sql
insert into public.roller (user_id, admin)
select id, true from auth.users where email = 'din@epost.se'
on conflict (user_id) do update set admin = true;
```

Panelen har fem flikar: översikt med intäkter och konvertering, kunder,
ordrar med återbetalningsknapp, återbetalningsbegäranden, och utskick.

### Automatiska återbetalningar

Helt automatiska återbetalningar är en affärsrisk — vem som helst kan begära
tillbaka pengar när som helst. Reglerna som gäller i stället:

- **Inom 14 dagar och kunden avsade sig inte ångerrätten** → godkänns automatiskt.
  Det är lagstadgad ångerrätt, så det finns inget att bedöma.
- **Alla andra fall** → hamnar i adminpanelen för beslut.

Momsen följer alltid med. Återbetalar du 990 kr ska 198 kr moms justeras i nästa
momsdeklaration. Prenumerationen avslutas inte av en återbetalning — säg upp den
separat i Stripe om kunden ska sluta.

## Behöver jag en separat server?

Nej. Stripes hemliga nyckel måste köras på en server, men den servern kan vara
Vercels serverlösa funktioner i `api/` — samma projekt, samma deploy.

Alternativen:

| | Separat server | Vercel-funktioner |
|---|---|---|
| Kostnad | ~5 USD/mån | Ingår |
| Deployer | Två | En |
| Kallstart | Nej om betald | Någon sekund |
| Långa jobb | Ja | Max 10-60 sek |

För Kvario räcker Vercel-funktioner. Webhookar och återbetalningar tar millisekunder.
Behåll den separata servern bara om du senare vill köra schemalagda jobb.


## Kontroll mot dubbletter

```
npm run kontroll
```

Körs automatiskt före varje bygge. Den fångar det fel som återkommit flest
gånger under utvecklingen: samma etikett skriven på två ställen, rättad på
ett av dem.

Regeln är enkel. Etiketter som förekommer både på landningssidan och i appen
ligger i `src/texter.js`. Skattesatser och tröskelvärden ligger bara i
`src/tax.js`. Skriver du en av dem någon annanstans failar bygget.

Lägger du till en ny delad text, lägg den i `texter.js` och komplettera listan
i `kontroll.mjs`.


## Appen på mobilen

Tre nivåer, från enklast till mest jobb.

### 1. Installera från webbläsaren

Webbversionen är en PWA. På telefonen: öppna adressen, välj "Lägg till på
hemskärmen". Den får egen ikon, startar utan adressfält och laddar skalet från
cache. Ingen app-butik, ingen granskning, ingen provision.

Detta är den enda nivå som behövs för att det ska kännas som en app.

### 2. APK att sidoladda

En färdig APK byggs automatiskt vid varje push till `main`.

1. Gå till repot på GitHub → fliken **Actions**
2. Öppna senaste körningen av "Bygg Android-APK"
3. Ladda ner artefakten `kvario-apk` längst ner
4. Packa upp och flytta `app-debug.apk` till telefonen
5. Öppna filen. Android frågar om appar från okänd källa — godkänn för
   filhanteraren

Den är signerad med Androids debug-nyckel. Det räcker för att installera
själv, men inte för Google Play.

### 3. App Store och Google Play

`android/` och `ios/` är riktiga native-projekt, redo att öppnas:

```
npm run app:android    # öppnar Android Studio
npm run app:ios        # öppnar Xcode, kräver Mac
```

Kvar att göra innan publicering:

- **Utvecklarkonto.** Apple 99 USD/år, Google 25 USD en gång.
- **Egen signeringsnyckel** för Play, i stället för debug-nyckeln.
- **Räkna på Apples provision.** Apple kräver deras egen köpfunktion för
  digitala abonnemang och tar 15–30 %. Av 99 kr blir det 15–30 kr. Hela
  Stripe-flödet måste då dubbleras med Apples köp för iOS-användare.
  Det är skälet till att PWA är förstahandsvalet så länge.

### Hur appen laddar innehållet

`capacitor.config.json` pekar mot den publicerade adressen i stället för att
bunta med egna kopior av filerna. Tre skäl:

1. Google tillåter inte inloggning via OAuth i en inbäddad webbvy. Laddas
   appen från riktig adress sker inloggningen i systemets webbläsare.
2. Betalservern släpper bara igenom anrop från `APP_URL`. En app som kör på
   `capacitor://localhost` är ett annat ursprung och blockeras av CORS.
3. Rättningar når användaren direkt, utan ny APK.

Byt adress när domänen är på plats — ändra `server.url` i
`capacitor.config.json` och kör `npm run app:synka`.

### Ikoner

```
npm run ikoner
```

Ritar ikonen i alla storlekar som webben och Android behöver, från koden i
`verktyg/rita-ikon.mjs`. Inget bildprogram behövs. Ändra motivet där och kör
om, så uppdateras allt på en gång.
