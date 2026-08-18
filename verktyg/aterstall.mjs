/* ============================================================
   Återställ en backup till databasen

   Kör:
     node verktyg/aterstall.mjs                    visar vad som skulle hända
     node verktyg/aterstall.mjs --skriv            gör det på riktigt
     node verktyg/aterstall.mjs --tabell=user_state --skriv
     node verktyg/aterstall.mjs "2026-08-18 kl 13.43.05" --skriv

   Torrkörning som standard, med flit. Det här skriptet skriver över
   levande kunddata, och den som når hit gör det ofta stressad efter
   att något redan gått fel. Att första körningen bara visar vad som
   skulle hända gör att man hinner upptäcka att man valt fel backup
   innan den skrivits över den man ville ha.

   VAD SOM INTE GÅR ATT ÅTERSTÄLLA

   Konton i auth.users. Backupen innehåller uppgifterna men inte
   lösenordshasharna — Supabase lämnar inte ut dem, och det är rätt.
   Är konton borta måste de skapas på nytt, och användarna får sätta
   nytt lösenord via återställningslänken.

   Det spelar roll för ordningen: alla tabeller pekar på user_id i
   auth.users. Saknas kontot går raden inte att skriva tillbaka, och
   torrkörningen säger till om det innan du försöker.
   ============================================================ */

import { readFile, readdir, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { createDecipheriv, scryptSync } from "node:crypto";

const NYCKELFIL = join(homedir(), ".kvario-backup.env");

async function lasNyckelfil() {
  try {
    const text = await readFile(NYCKELFIL, "utf8");
    for (const rad of text.split(/\r?\n/)) {
      const traff = rad.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
      if (traff && !process.env[traff[1]]) process.env[traff[1]] = traff[2];
    }
  } catch {}
}
await lasNyckelfil();

const ADRESS = process.env.SUPABASE_URL;
const NYCKEL = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
if (!ADRESS || !NYCKEL) {
  console.error(`Saknar SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY i ${NYCKELFIL}`);
  process.exit(1);
}
const bas = ADRESS.replace(/\/+$/, "");
const huvuden = { apikey: NYCKEL, Authorization: `Bearer ${NYCKEL}` };

/* Samma ordning som i backup.mjs. Främmande nycklar pekar bakåt i
   listan, så en rak genomkörning uppifrån och ner fungerar utan att
   stänga av kontroller. */
const TABELLER = [
  "roller", "subscriptions", "user_state", "terms_acceptance",
  "order_serie", "orders", "aterbetalningar", "delade_rapporter", "kvitton",
];

/* ---------- Argument ---------- */

const arg = process.argv.slice(2);
const skriv = arg.includes("--skriv");
const baraTabell = arg.find((a) => a.startsWith("--tabell="))?.split("=")[1] || null;
const onskadMapp = arg.find((a) => !a.startsWith("--")) || null;

if (baraTabell && !TABELLER.includes(baraTabell)) {
  console.error(`Okänd tabell: ${baraTabell}`);
  console.error(`Välj en av: ${TABELLER.join(", ")}`);
  process.exit(1);
}

/* ---------- Välj backup ---------- */

const rot = join(dirname(fileURLToPath(import.meta.url)), "..");
const backupRot = join(rot, "backup");
let mapp;

if (onskadMapp) {
  mapp = join(backupRot, onskadMapp);
  try { await stat(mapp); }
  catch { console.error(`Hittar ingen backup som heter "${onskadMapp}"`); process.exit(1); }
} else {
  let mappar;
  try {
    mappar = (await readdir(backupRot, { withFileTypes: true }))
      .filter((d) => d.isDirectory() && !d.name.endsWith("(uppackad)"))
      .map((d) => d.name);
  } catch { console.error("Ingen backupmapp än."); process.exit(1); }
  if (!mappar.length) { console.error("Backupmappen är tom."); process.exit(1); }
  /* Tidsstämpel, inte namn: mappar från före namnbytet sorteras
     annars fel eftersom mellanslag kommer före T. */
  const medTid = await Promise.all(
    mappar.map(async (n) => ({ n, t: (await stat(join(backupRot, n))).mtimeMs }))
  );
  medTid.sort((a, b) => a.t - b.t);
  mapp = join(backupRot, medTid[medTid.length - 1].n);
}

console.log(`Backup: ${mapp}`);
console.log(`Databas: ${bas}`);
console.log(skriv ? "\nLÄGE: SKRIVER PÅ RIKTIGT\n" : "\nLäge: torrkörning — ingenting skrivs\n");

/* ---------- Läs, med dekryptering vid behov ---------- */

let nyckeln = null;
try {
  const krypto = JSON.parse(await readFile(join(mapp, "krypto.json"), "utf8"));
  const losen = process.env.BACKUP_LOSENORD;
  if (!losen) {
    console.error("Backupen är krypterad men BACKUP_LOSENORD saknas.");
    console.error("Kör: node verktyg/satt-losenord.mjs");
    process.exit(1);
  }
  nyckeln = scryptSync(losen, Buffer.from(krypto.salt, "base64"), 32);
} catch (e) {
  if (e?.code !== "ENOENT" && !(e instanceof SyntaxError)) throw e;
}

async function lasFil(namn) {
  if (nyckeln) {
    const rad = await readFile(join(mapp, `${namn}.kryptbin`));
    const chiffer = createDecipheriv("aes-256-gcm", nyckeln, rad.subarray(0, 12));
    chiffer.setAuthTag(rad.subarray(12, 28));
    return JSON.parse(Buffer.concat([chiffer.update(rad.subarray(28)), chiffer.final()]).toString("utf8"));
  }
  return JSON.parse(await readFile(join(mapp, namn), "utf8"));
}

/* Manifestet är alltid okrypterat. En backup med fel i sig ska inte
   skrivas tillbaka utan att man vet om det — den kan sakna rader. */
const manifest = JSON.parse(await readFile(join(mapp, "manifest.json"), "utf8"));
if (manifest.fel?.length) {
  console.log("VARNING: den här backupen hade fel när den togs:");
  for (const f of manifest.fel) console.log(`  ${f}`);
  console.log("Den kan vara ofullständig.\n");
}

/* ---------- Finns kontona kvar? ---------- */

async function nuvarandeAntal(tabell) {
  const svar = await fetch(`${bas}/rest/v1/${tabell}?select=*&limit=1`, {
    headers: { ...huvuden, Prefer: "count=exact" },
  });
  if (!svar.ok) return null;
  return Number(svar.headers.get("content-range")?.split("/")[1] ?? 0);
}

const sakradeKonton = new Set();
try {
  const svar = await fetch(`${bas}/auth/v1/admin/users?page=1&per_page=1000`, { headers: huvuden });
  const { users = [] } = await svar.json();
  for (const u of users) sakradeKonton.add(u.id);
} catch {}

const backadeKonton = await lasFil("auth_users.json").catch(() => []);
const saknade = backadeKonton.filter((u) => !sakradeKonton.has(u.id));
if (saknade.length) {
  console.log(`${saknade.length} av ${backadeKonton.length} konton i backupen finns inte i databasen:`);
  for (const u of saknade) console.log(`  ${u.email}`);
  console.log("Rader som pekar på dem går inte att skriva tillbaka förrän kontona");
  console.log("återskapats. Lösenorden finns inte i backupen — de får sättas om");
  console.log("via återställningslänken.\n");
}

/* ---------- Gå igenom tabellerna ---------- */

const listan = baraTabell ? [baraTabell] : TABELLER;
let skrivna = 0;
const problem = [];

for (const tabell of listan) {
  let rader;
  try { rader = await lasFil(`${tabell}.json`); }
  catch (e) { problem.push(`${tabell}: kunde inte läsas — ${e.message}`); continue; }

  const nu = await nuvarandeAntal(tabell);
  const skillnad = nu === null ? "?" : rader.length - nu;
  console.log(`${tabell.padEnd(18)} backup ${String(rader.length).padStart(4)}   databas ${String(nu ?? "?").padStart(4)}   ${skillnad > 0 ? `+${skillnad} saknas` : skillnad === 0 ? "lika" : `${-skillnad} fler i databasen`}`);

  if (!skriv || !rader.length) continue;

  /* merge-duplicates gör skrivningen till en upsert på primärnyckeln:
     rader som finns uppdateras, rader som saknas läggs till. Rader som
     finns i databasen men inte i backupen lämnas i fred — att radera
     dem vore att låta en gammal backup kasta nyare data. */
  const svar = await fetch(`${bas}/rest/v1/${tabell}`, {
    method: "POST",
    headers: { ...huvuden, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rader),
  });
  if (!svar.ok) {
    const text = await svar.text();
    problem.push(`${tabell}: ${svar.status} ${text.slice(0, 200)}`);
    console.log(`  MISSLYCKADES: ${svar.status}`);
  } else {
    skrivna += rader.length;
    console.log(`  skrev ${rader.length} rader`);
  }
}

/* ---------- Sammanfattning ---------- */

console.log("");
if (problem.length) {
  console.error(`${problem.length} problem:`);
  for (const p of problem) console.error(`  ${p}`);
}
if (!skriv) {
  console.log("Ingenting skrevs. Lägg till --skriv när siffrorna ovan ser rätt ut.");
  console.log("Kvittofiler återställs inte automatiskt — de ligger kvar i");
  console.log("backupmappen och laddas upp för hand om de behövs.");
} else {
  console.log(`Klart: ${skrivna} rader skrivna.`);
}
process.exit(problem.length ? 1 : 0);
