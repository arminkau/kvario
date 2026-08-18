# Backup och återställning

Den här filen ligger i repot med flit. Klonar du Kvario på en främmande
dator följer instruktionerna med — en räddningsplan som bara finns på
maskinen som gått sönder är ingen plan.

Ingenting här kräver `npm install`. Backupverktygen använder bara Nodes
inbyggda moduler, så ett klonat repo räcker.

---

## Det du måste ha med dig

| | Behövs för | Var finns det |
|---|---|---|
| Backupmappen | allt | OneDrive, eller din kopia |
| Krypteringslösenordet | att läsa en krypterad backup | ditt huvud, eller papper |
| `SUPABASE_SERVICE_ROLE_KEY` | ta ny backup, skriva tillbaka | Supabase → Settings → API |

Lösenordet går inte att återskapa. Tappas det är krypterade backuper
förlorade, och det finns ingen väg runt — det är hela poängen med
kryptering. Skriv ner det på papper och förvara det någon annanstans än
i huset.

---

## Steg 1 — förbered datorn

Installera Node, och **öppna en ny terminal efteråt** så att `node`
hittas:

```powershell
winget install OpenJS.NodeJS.LTS
```

Hämta verktygen:

```powershell
cd $env:USERPROFILE
git clone https://github.com/arminkau/kvario.git
cd kvario
```

---

## Steg 2 — ange uppgifterna

Miljövariabler gäller bara i det terminalfönster du sätter dem i och
försvinner när du stänger det. De hamnar aldrig på disk, vilket är rätt
på en dator som inte är din.

Variablerna tar över nyckelfilen om båda finns, så det här fungerar även
på din egen maskin när du vill peka om något tillfälligt.

För att **läsa** en krypterad backup:

```powershell
$env:BACKUP_LOSENORD = "din mening här"
```

För att **ta en ny backup** eller **skriva tillbaka**, dessutom:

```powershell
$env:SUPABASE_URL = "https://sjdcxtalwnbtuaxgywbr.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "klistra in nyckeln här"
```

---

## Ta en backup från en främmande dator

```powershell
node verktyg/backup.mjs
```

Hämtar alla tabeller, kontona och kvittofilerna, och lägger dem i
`backup\<datum kl tid>`. Är `BACKUP_LOSENORD` satt krypteras allt utom
manifestet.

Slutar den med `Komplett.` är backupen hel. Slutar den med en felrad är
den det inte — då saknas rader, och en ofullständig backup är farligare
än ingen, eftersom den ser komplett ut.

---

## Läsa en krypterad backup

Lägg backupmappen i `kvario\backup\` så att sökvägen blir ungefär
`kvario\backup\2026-08-18 kl 13.43.05`. Sedan:

```powershell
node verktyg/las-backup.mjs
```

Utan argument tas den senaste. En särskild anges med namnet:

```powershell
node verktyg/las-backup.mjs "2026-08-18 kl 13.43.05"
```

Resultatet hamnar i en mapp som slutar på `(uppackad)`, bredvid
originalet. Aldrig på plats — den krypterade backupen ska finnas kvar
även efter att du tittat i den.

Nu ligger all data som vanlig JSON. **Här kan du sluta** om du bara
behövde komma åt uppgifterna: filerna går att öppna i vilken editor som
helst, utan Kvario och utan Supabase.

### Om det inte fungerar

Skriptet skiljer på två fel genom att räkna hur många filer som gick att
läsa:

- **Ingen fil gick att läsa** — nästan alltid fel lösenord.
- **Några gick, några inte** — lösenordet stämmer, och de filer som
  räknas upp är skadade. AES-GCM bär en autentiseringstagg, så en fil
  som ändrats av en trasig disk eller en halv OneDrive-synk vägrar
  dekrypteras i stället för att tyst ge skräp.

---

## Skriva tillbaka till databasen

Titta först. Det här skriver ingenting:

```powershell
node verktyg/aterstall.mjs
```

Du får en rad per tabell med hur många poster som finns i backupen mot i
databasen. Ser siffrorna rätt ut:

```powershell
node verktyg/aterstall.mjs --skriv
```

En enskild tabell, om bara en behöver lagas:

```powershell
node verktyg/aterstall.mjs --tabell=user_state --skriv
```

En äldre backup:

```powershell
node verktyg/aterstall.mjs "2026-08-18 kl 13.43.05" --skriv
```

### Vad återställningen gör och inte gör

**Lägger till och uppdaterar, raderar aldrig.** Skrivningen är en upsert
på primärnyckeln. Rader som finns i databasen men inte i backupen lämnas
i fred — annars hade en gammal backup kunnat kasta nyare data.

**Konton måste finnas först.** Alla tabeller pekar på `user_id` i
`auth.users`. Torrkörningen listar vilka konton i backupen som saknas i
databasen, och de raderna går inte in förrän kontona återskapats.

**Lösenord går inte att återställa.** Hasharna finns inte i backupen;
Supabase lämnar inte ut dem. Återskapade konton får sätta nytt lösenord
via återställningslänken i inloggningen.

**Kvittofiler laddas inte upp automatiskt.** De ligger kvar i
`kvitton\`-mappen i backupen och läggs tillbaka för hand.

---

## Efteråt

Radera `(uppackad)`-mappen. Den är i klartext och innehåller kunders
personuppgifter.

```powershell
Remove-Item "backup\<mappnamn> (uppackad)" -Recurse -Force
```

Stäng terminalfönstret, så försvinner lösenordet och nyckeln ur miljön.

Är datorn inte din: ta även bort det klonade repot och backupmappen.

---

## På din egen dator

Där behövs inget av ovanstående. Lösenordet och Supabase-uppgifterna
ligger i `%USERPROFILE%\.kvario-backup.env`, och verktygen läser dem
själva.

```powershell
node verktyg/satt-losenord.mjs   # sätt eller byt krypteringslösenordet
node verktyg/backup.mjs          # ta en backup nu
node verktyg/las-backup.mjs      # packa upp den senaste
node verktyg/aterstall.mjs       # visa vad en återställning skulle göra
```

En schemalagd uppgift kör backupen varje söndag. Kontrollera den med:

```powershell
Get-ScheduledTaskInfo -TaskName "Kvario backup" | Select-Object LastRunTime, LastTaskResult, NextRunTime
```

`LastTaskResult: 0` betyder att den lyckades.

---

## Vad Supabase själv sparar, och varför det inte räcker

Fria planen har inga automatiska backuper alls. Pro har de senaste sju
dagliga, Team fjorton, Enterprise trettio. Filer i Storage ingår inte på
någon plan — och kvittot är underlaget, siffran i appen är det inte.

De dagarna är en ångerknapp, inte ett arkiv. Bokföringslagen kräver sju
år, och det är backupmapparna som är arkivet. Radera dem aldrig, och se
till att de finns på mer än ett ställe.
