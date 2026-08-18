/* ============================================================
   Sätt lösenordet som backuperna krypteras med

   Kör:
     node verktyg/satt-losenord.mjs

   Frågar efter lösenordet, skriver det till nyckelfilen och läser
   tillbaka det med samma tolkare som backup.mjs använder. Därefter
   krypteras varje backup automatiskt — även den schemalagda, som
   läser samma fil.

   Varför inte bara redigera filen för hand: lösenordet syns då på
   skärmen, och tolkaren klipper blanksteg i kanterna. Ett lösenord
   som slutar med mellanslag hade sparats utan det, och felet hade
   inte märkts förrän en backup skulle läsas — alltså den dagen man
   minst vill upptäcka något nytt.
   ============================================================ */

import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { homedir } from "node:os";

const NYCKELFIL = join(homedir(), ".kvario-backup.env");
const MINSTA_LANGD = 12;

/* Frågar utan att visa svaret.

   readline sköter backsteg, inklistring och Ctrl-C åt oss — det som
   annars kräver raw-läge och egen hantering av styrtecken. Enda
   ingreppet är att tysta utskriften av det som skrivs: _writeToOutput
   anropas för varje tecken, och här släpps bara själva frågan fram. */
function fragaDolt(fraga) {
  return new Promise((klar, avbryt) => {
    if (!process.stdin.isTTY) {
      avbryt(new Error("Ingen terminal — kör kommandot direkt i PowerShell."));
      return;
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (text) => {
      if (text.includes(fraga)) rl.output.write(fraga);
    };
    rl.on("SIGINT", () => { rl.close(); process.stdout.write("\nAvbrutet.\n"); process.exit(1); });
    rl.question(fraga, (svar) => {
      rl.close();
      process.stdout.write("\n");
      klar(svar);
    });
  });
}

/* Samma tolkare som backup.mjs. Kopierad med flit: det är just den
   här funktionen vi vill prova att lösenordet överlever, så den ska
   vara identisk och inte importerad från ett skript som gör annat. */
function tolkaFil(text) {
  const ut = {};
  for (const rad of text.split(/\r?\n/)) {
    const traff = rad.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (traff) ut[traff[1]] = traff[2];
  }
  return ut;
}

/* ---------- Kör ---------- */

let befintligText = "";
try { befintligText = await readFile(NYCKELFIL, "utf8"); } catch {}
const befintligt = tolkaFil(befintligText);

if (!befintligt.SUPABASE_URL || !befintligt.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(`Nyckelfilen saknar Supabase-uppgifterna: ${NYCKELFIL}`);
  console.error("Sätt SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY där först.");
  process.exit(1);
}

if (befintligt.BACKUP_LOSENORD) {
  console.log("Det finns redan ett lösenord satt.\n");
  console.log("VARNING: byter du det går befintliga krypterade backuper");
  console.log("bara att läsa med det GAMLA lösenordet. Kryptering fungerar");
  console.log("inte bakåt — filerna som redan ligger på disk är låsta med");
  console.log("den nyckel de skrevs med.\n");
  console.log("Har du inte kvar det gamla är de backuperna borta för gott.\n");
}

console.log(`Lösenordet sparas i ${NYCKELFIL}`);
console.log("Det visas inte medan du skriver.\n");

/* Utan den här blev "ingen terminal" en ohanterad rejektion med
   stackspårning, och det verkliga beskedet försvann i bruset. Det
   här skriptet körs av någon som redan letar efter vad som är fel. */
let forsta, andra;
try {
  forsta = await fragaDolt("Lösenord: ");
  andra = await fragaDolt("Skriv igen: ");
} catch (fel) {
  console.error(fel.message);
  process.exit(1);
}

if (forsta !== andra) {
  console.error("De två stämde inte överens. Inget sparat.");
  process.exit(1);
}
if (forsta.length < MINSTA_LANGD) {
  console.error(`Minst ${MINSTA_LANGD} tecken. En mening du minns är både starkare och lättare än ett kort krångligt ord.`);
  process.exit(1);
}
/* Tolkaren klipper blanksteg i kanterna, så ett sådant lösenord hade
   sparats i en form som inte går att skriva in igen. Bättre att säga
   ifrån nu än att låta det gå igenom och gå sönder vid uppackning. */
if (forsta !== forsta.trim()) {
  console.error("Lösenordet får inte börja eller sluta med mellanslag.");
  process.exit(1);
}

/* Övriga rader behålls som de är. Filen kan innehålla annat, och det
   ska inte försvinna för att lösenordet sätts. */
const rader = befintligText.split(/\r?\n/).filter((r) => !/^\s*BACKUP_LOSENORD\s*=/.test(r));
while (rader.length && !rader[rader.length - 1].trim()) rader.pop();
rader.push(`BACKUP_LOSENORD=${forsta}`, "");
await writeFile(NYCKELFIL, rader.join("\n"), "utf8");

/* Läs tillbaka och jämför. Det är det här steget som fångar felen
   som annars upptäcks först vid en återställning: fel teckenkodning,
   en rad som inte matchar mönstret, ett tecken som försvunnit. */
const kontroll = tolkaFil(await readFile(NYCKELFIL, "utf8"));
if (kontroll.BACKUP_LOSENORD !== forsta) {
  console.error("Lösenordet skrevs men kom inte tillbaka oförändrat vid läsning.");
  console.error("Lita inte på det — något med filen stämmer inte.");
  process.exit(1);
}
if (!kontroll.SUPABASE_URL || !kontroll.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Supabase-uppgifterna försvann ur filen. Återställ den innan du kör backup.");
  process.exit(1);
}

console.log("Sparat och verifierat — värdet lästes tillbaka oförändrat.\n");
console.log("Varje backup krypteras nu automatiskt, även den schemalagda.\n");
console.log("Prova hela vägen nu, medan du säkert vet att lösenordet är rätt:");
console.log("  node verktyg/backup.mjs");
console.log("  node verktyg/las-backup.mjs");
