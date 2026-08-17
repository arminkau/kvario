/* ============================================================
   Kontroll av dubbletter

   Körs med: npm run kontroll

   Fångar det fel som återkommit flest gånger under utvecklingen:
   samma text skriven på två ställen, rättad på ett av dem.
   Alla delade etiketter ska hämtas från src/texter.js.
   ============================================================ */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const SRC = "src";
const filer = readdirSync(SRC).filter((f) => f.endsWith(".jsx") || f.endsWith(".js"));

/* Texter som bara får förekomma i texter.js */
const FORBJUDNA = [
  "Lägre skatt",
  "Verklig kostnad",
  "Kvar till dig",
  "Egna kostnader",
  "Företagsköp",
  "Privat köp",
  "Redan utbetalt",
  "Redovisas vidare",
  "Fritt att ta ut",
];

/* Skattesatser och gränsbelopp får bara stå i tax.js.
   Listan är handhållen, vilket är dess svaghet: OSS-tröskeln låg
   hårdkodad i en jämförelse i App.jsx i månader utan att fångas,
   eftersom 99680 aldrig lagts till här. Lägg till varje nytt tal
   som styr en beräkning. */
const SATSER = [
  /0\.2897/, /0\.3142/, /0\.206/, /0\.1021/, /0\.2081/,
  /643000/, /83400/, /59200/,
  /99680/, /99 680/,        // OSS-tröskeln
  /120000/,                 // omsättningsgränsen för moms
  /703000/,                 // avtrappning av jobbskatteavdraget
];

let fel = 0;

for (const f of filer) {
  if (f === "texter.js") continue;
  const t = readFileSync(join(SRC, f), "utf8");

  for (const ord of FORBJUDNA) {
    // Tillåt förekomst som kommentar
    const rader = t.split("\n").filter((r) => r.includes(ord) && !r.trim().startsWith("//") && !r.trim().startsWith("*"));
    if (rader.length) {
      console.error(`✗ ${f}: "${ord}" är hårdkodad — hämta den från texter.js`);
      fel++;
    }
  }

  if (f !== "tax.js") {
    for (const s of SATSER) {
      if (s.test(t)) {
        console.error(`✗ ${f}: skattesatsen ${s} förekommer utanför tax.js`);
        fel++;
      }
    }
  }
}

if (fel) {
  console.error(`\n${fel} problem hittade. Rätta innan du deployar.`);
  process.exit(1);
}
console.log("✓ Inga dubblerade texter eller skattesatser utanför tax.js");
