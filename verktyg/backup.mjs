#!/usr/bin/env node
/* ============================================================
   Kvario — fullständig backup av databasen

   Körs med:
     node verktyg/backup.mjs

   Kräver två miljövariabler:
     SUPABASE_URL
     SUPABASE_SERVICE_ROLE_KEY   (Settings -> API -> service_role)

   Service_role-nyckeln går förbi RLS. Det är hela poängen här —
   en backup som bara ser en användares rader är ingen backup — men
   det gör också att nyckeln aldrig får hamna i en publik miljö,
   i git, eller i webbläsaren. Skriptet skriver aldrig ut den.

   VARFÖR DET HÄR SKRIPTET FINNS

   Supabase egna backuper täcker inte allt vi behöver:

   1. Fria planen har inga automatiska backuper alls.
   2. Pro-planen har dagliga med sju dagars historik. Bokföringslagen
      kräver att underlag sparas i sju ÅR. Orders och kvitton faller
      alltså utanför.
   3. Filerna i Storage ingår inte i databasbackupen. Kvittona ligger
      där, och de är underlaget — siffran i appen är det inte.

   Det som sparas här går att läsa utan Supabase: vanlig JSON och
   filerna i original.
   ============================================================ */

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

/* Nycklarna läses i första hand ur miljön, i andra hand ur en fil i
   hemkatalogen. Filen finns för schemalagda körningar: ett veckojobb
   kan inte be någon klistra in en nyckel, och att baka in den i
   uppgiftens kommandorad lägger den i klartext i Windows
   uppgiftsschemaläggare där den syns för vem som helst som öppnar den.

   Hemkatalogen och inte repot, av två skäl: filen kan aldrig råka
   committas, och den ligger utanför de mappar OneDrive synkar. */
const NYCKELFIL = join(homedir(), ".kvario-backup.env");

async function lasNyckelfil() {
  try {
    const text = await readFile(NYCKELFIL, "utf8");
    for (const rad of text.split(/\r?\n/)) {
      const traff = rad.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
      /* Miljön vinner över filen, så en manuell körning kan peka om
         skriptet mot ett testprojekt utan att filen ändras. */
      if (traff && !process.env[traff[1]]) process.env[traff[1]] = traff[2];
    }
  } catch {
    /* Finns den inte är det inget fel — miljövariabler är den
       vanliga vägen vid manuell körning. */
  }
}

await lasNyckelfil();

const ADRESS = process.env.SUPABASE_URL;
const NYCKEL = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!ADRESS || !NYCKEL) {
  console.error("Saknar SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY.");
  console.error(`Sätt dem som miljövariabler, eller lägg dem i ${NYCKELFIL}`);
  console.error("på formen NAMN=värde, en per rad.");
  process.exit(1);
}

const bas = ADRESS.replace(/\/+$/, "");
const huvuden = { apikey: NYCKEL, Authorization: `Bearer ${NYCKEL}` };

/* Tabellerna i den ordning de behöver återställas. Främmande nycklar
   pekar bakåt i listan, så en rak genomkörning uppifrån och ner
   fungerar utan att stänga av kontroller. */
const TABELLER = [
  "roller",
  "subscriptions",
  "user_state",
  "terms_acceptance",
  "order_serie",
  "orders",
  "aterbetalningar",
  "delade_rapporter",
  "kvitton",
];

/* PostgREST tar max 1000 rader per svar oavsett vad man ber om.
   Utan sidhämtning ser en backup av 1500 konton komplett ut och
   saknar 500 — det värsta sortens fel, eftersom det upptäcks först
   den dagen backupen ska användas. */
async function hamtaTabell(namn) {
  const rader = [];
  const steg = 1000;
  for (let start = 0; ; start += steg) {
    const svar = await fetch(
      `${bas}/rest/v1/${namn}?select=*&limit=${steg}&offset=${start}`,
      { headers: huvuden }
    );
    if (!svar.ok) throw new Error(`${namn}: ${svar.status} ${await svar.text()}`);
    const del = await svar.json();
    rader.push(...del);
    if (del.length < steg) break;
  }
  return rader;
}

/* auth.users går inte att nå via REST — schemat är inte exponerat,
   med flit. Admin-API:et är vägen in. Lösenordshasharna följer inte
   med, och det är rätt: de går ändå inte att återanvända. */
async function hamtaAnvandare() {
  const alla = [];
  for (let sida = 1; ; sida++) {
    const svar = await fetch(
      `${bas}/auth/v1/admin/users?page=${sida}&per_page=1000`,
      { headers: huvuden }
    );
    if (!svar.ok) throw new Error(`auth.users: ${svar.status} ${await svar.text()}`);
    const { users = [] } = await svar.json();
    alla.push(...users);
    if (users.length < 1000) break;
  }
  return alla;
}

/* Kvitto-tabellen vet var varje fil ligger, så vi behöver inte gå
   igenom bucketen mapp för mapp. Listan i databasen är dessutom
   den vi vill matcha mot — en fil utan rad är ändå oanvändbar. */
async function hamtaKvittofiler(kvitton, mapp) {
  let hamtade = 0;
  const saknade = [];
  for (const k of kvitton) {
    const svar = await fetch(`${bas}/storage/v1/object/kvitton/${k.sokvag}`, { headers: huvuden });
    if (!svar.ok) { saknade.push({ sokvag: k.sokvag, status: svar.status }); continue; }
    const mal = join(mapp, k.sokvag);
    await mkdir(dirname(mal), { recursive: true });
    await writeFile(mal, Buffer.from(await svar.arrayBuffer()));
    hamtade++;
  }
  return { hamtade, saknade };
}

/* ---------- Kör ---------- */

const stampel = new Date().toISOString().replace(/[:.]/g, "-");

/* Räknat från skriptets egen plats, inte från katalogen man råkar stå
   i. Med process.cwd() hamnade backupen där kommandot kördes — kör man
   från server/ en gång och från roten nästa gång ligger historiken på
   två ställen, och den man letar i ser ut att sakna veckor. */
const rot = join(dirname(fileURLToPath(import.meta.url)), "..");
const mapp = join(rot, "backup", stampel);
await mkdir(mapp, { recursive: true });

const manifest = { tagen: new Date().toISOString(), projekt: bas, tabeller: {}, fel: [] };
let kvitton = [];

for (const namn of TABELLER) {
  try {
    const rader = await hamtaTabell(namn);
    await writeFile(join(mapp, `${namn}.json`), JSON.stringify(rader, null, 2));
    manifest.tabeller[namn] = rader.length;
    if (namn === "kvitton") kvitton = rader;
    console.log(`  ${namn}: ${rader.length} rader`);
  } catch (e) {
    manifest.fel.push(String(e.message));
    console.error(`  ${namn}: MISSLYCKADES — ${e.message}`);
  }
}

try {
  const anvandare = await hamtaAnvandare();
  await writeFile(join(mapp, "auth_users.json"), JSON.stringify(anvandare, null, 2));
  manifest.tabeller["auth.users"] = anvandare.length;
  console.log(`  auth.users: ${anvandare.length} konton`);
} catch (e) {
  manifest.fel.push(String(e.message));
  console.error(`  auth.users: MISSLYCKADES — ${e.message}`);
}

if (kvitton.length) {
  try {
    const { hamtade, saknade } = await hamtaKvittofiler(kvitton, join(mapp, "kvitton"));
    manifest.kvittofiler = { hamtade, saknade };
    console.log(`  kvittofiler: ${hamtade} av ${kvitton.length}`);
    /* En saknad fil är ett verkligt fel, inte brus: raden finns kvar i
       databasen men underlaget är borta. Det märks aldrig i appen. */
    if (saknade.length) {
      manifest.fel.push(`${saknade.length} kvittofiler saknas i Storage`);
      console.error(`  ${saknade.length} kvitton saknas i Storage`);
    }
  } catch (e) {
    manifest.fel.push(`kvittofiler: ${e.message}`);
    console.error(`  kvittofiler: MISSLYCKADES — ${e.message}`);
  }
}

await writeFile(join(mapp, "manifest.json"), JSON.stringify(manifest, null, 2));

console.log(`\nSparat i ${mapp}`);
if (manifest.fel.length) {
  console.error(`\n${manifest.fel.length} fel — backupen är INTE komplett.`);
  process.exit(1);
}
console.log("Komplett.");
