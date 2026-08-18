/* ============================================================
   Läs en krypterad backup

   Kör:
     node verktyg/las-backup.mjs                       senaste backupen
     node verktyg/las-backup.mjs "2026-08-18 kl 13.45.20"

   Lösenordet läses ur BACKUP_LOSENORD, samma väg som backup.mjs:
   miljön först, annars nyckelfilen i hemkatalogen.

   Skriver en upppackad kopia bredvid originalet i stället för att
   packa upp på plats. Att skriva över den krypterade backupen vore
   att förstöra det man just bevisat fungerar — och den upppackade
   kopian är klartext, alltså något man vill kunna radera efteråt
   utan att förlora backupen.

   Verifieringen är inte kosmetisk. AES-GCM bär en autentiseringstagg,
   så en fil som ändrats — av en trasig disk, en halv OneDrive-synk
   eller någon som varit inne och petat — vägrar dekrypteras i stället
   för att tyst ge skräp. Det är skillnaden mellan att upptäcka det nu
   och att upptäcka det den dagen backupen behövs.
   ============================================================ */

import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { join, dirname, relative } from "node:path";
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
  } catch { /* saknas den är miljövariabler den vanliga vägen */ }
}
await lasNyckelfil();

const rot = join(dirname(fileURLToPath(import.meta.url)), "..");
const backupRot = join(rot, "backup");

/* ---------- Välj mapp ---------- */

const onskad = process.argv[2];
let mapp;

if (onskad) {
  mapp = join(backupRot, onskad);
  try { await stat(mapp); }
  catch { console.error(`Hittar ingen backup som heter "${onskad}" i ${backupRot}`); process.exit(1); }
} else {
  let mappar;
  try {
    mappar = (await readdir(backupRot, { withFileTypes: true }))
      .filter((d) => d.isDirectory() && !d.name.endsWith("(uppackad)"))
      .map((d) => d.name);
  } catch {
    console.error(`Ingen backupmapp än. Kör backup.mjs först.`);
    process.exit(1);
  }
  if (!mappar.length) { console.error("Backupmappen är tom."); process.exit(1); }

  /* Sorterat på mappens tidsstämpel, inte på namnet.

     Namnsortering såg ut att räcka — alla namn börjar med datum — men
     backuper tagna före namnbytet heter "2026-08-18T03-06-20-950Z" och
     nyare heter "2026-08-18 kl 13.34.25". Mellanslag sorteras före T,
     så den äldsta mappen hamnade sist och plockades som "senaste".
     Filsystemets tid vet vilken som faktiskt är nyast. */
  const medTid = await Promise.all(
    mappar.map(async (namn) => ({ namn, tid: (await stat(join(backupRot, namn))).mtimeMs }))
  );
  medTid.sort((a, b) => a.tid - b.tid);
  mapp = join(backupRot, medTid[medTid.length - 1].namn);
}

console.log(`Läser ${mapp}\n`);

/* ---------- Är den krypterad? ---------- */

let krypto = null;
try { krypto = JSON.parse(await readFile(join(mapp, "krypto.json"), "utf8")); } catch {}

if (!krypto) {
  console.log("Den här backupen är inte krypterad — filerna går att öppna direkt.");
  console.log("Sätt BACKUP_LOSENORD i nyckelfilen för att kryptera kommande backuper.");
  process.exit(0);
}

const LOSEN = process.env.BACKUP_LOSENORD;
if (!LOSEN) {
  console.error("Backupen är krypterad men BACKUP_LOSENORD är inte satt.");
  console.error(`Sätt den som miljövariabel, eller lägg den i ${NYCKELFIL}`);
  process.exit(1);
}

const nyckeln = scryptSync(LOSEN, Buffer.from(krypto.salt, "base64"), 32);

/* ---------- Packa upp ---------- */

function avkryptera(rad) {
  const iv = rad.subarray(0, 12);
  const tagg = rad.subarray(12, 28);
  const chiffer = createDecipheriv("aes-256-gcm", nyckeln, iv);
  chiffer.setAuthTag(tagg);
  return Buffer.concat([chiffer.update(rad.subarray(28)), chiffer.final()]);
}

const utMapp = `${mapp} (uppackad)`;
let klara = 0;
const trasiga = [];

const allt = await readdir(mapp, { recursive: true, withFileTypes: true });
for (const post of allt) {
  if (!post.isFile() || !post.name.endsWith(".kryptbin")) continue;

  const kalla = join(post.parentPath ?? post.path, post.name);
  const relativ = relative(mapp, kalla).replace(/\.kryptbin$/, "");
  const mal = join(utMapp, relativ);

  try {
    const ut = avkryptera(await readFile(kalla));
    await mkdir(dirname(mal), { recursive: true });
    await writeFile(mal, ut);
    console.log(`  ✓ ${relativ}`);
    klara++;
  } catch (e) {
    /* Ett fel här betyder antingen fel lösenord eller en skadad fil,
       och de går inte att skilja åt utifrån — GCM säger bara att det
       inte stämmer. Därför skiljer sammanfattningen nedan på fallen
       genom att titta på hur många som lyckades. */
    console.error(`  ✗ ${relativ} — ${e.message}`);
    trasiga.push(relativ);
  }
}

/* Manifestet är okrypterat och kopieras med, så att den uppackade
   mappen står för sig själv. */
try {
  await mkdir(utMapp, { recursive: true });
  await writeFile(join(utMapp, "manifest.json"), await readFile(join(mapp, "manifest.json")));
} catch {}

console.log("");
if (!klara && trasiga.length) {
  console.error("Ingen fil gick att läsa. Det betyder nästan alltid fel lösenord.");
  process.exit(1);
}
if (trasiga.length) {
  console.error(`${trasiga.length} filer gick inte att läsa, men ${klara} gjorde det.`);
  console.error("Lösenordet stämmer alltså — de här filerna är skadade:");
  for (const t of trasiga) console.error(`  ${t}`);
  process.exit(1);
}
console.log(`${klara} filer uppackade och verifierade.`);
console.log(`Ligger i ${utMapp}`);
console.log("\nRadera den mappen när du är klar — den är i klartext.");
