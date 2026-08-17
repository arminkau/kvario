/* ============================================================
   Märket som bild, till svarsmallen

   De automatiska breven ritar märket med tabellceller, eftersom
   Gmail och Outlook blockerar bilder tills mottagaren tillåter dem.
   Ett kvitto som öppnar med en tom ruta ser ut som skräppost.

   Men svarsmallen klistras in i webbmailens skrivfönster, och en
   sådan tolkar om HTML:en: höjderna på cellerna kastas och märket
   rasar isär till en pelare. Provat och sett.

   En bild överlever det. Den ligger på kvario.se och laddas därifrån
   — mottagaren av ett personligt svar har oftast redan tillåtit
   bilder från en avsändare de skrivit med.

   Ritas i dubbel storlek för skärmar med hög upplösning: 80 px fil
   som visas som 40.

   Kör:
     node verktyg/gor-brevlogga.mjs
   ============================================================ */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ritaIkon } from "./rita-ikon.mjs";

const HAR = dirname(fileURLToPath(import.meta.url));
const UT = join(HAR, "..", "public", "logo");

/* Samma marginal som appikonen, och utan alfakanal. Genomskinlighet
   i ett brev ger grå eller svart botten beroende på klient, och en
   logotyp ska inte byta utseende med mottagarens inställningar. */
const png = ritaIkon(80, false, 0.17, true);
writeFileSync(join(UT, "kvario-marke-80.png"), png);

const farg = png[25];
if (farg !== 2) {
  console.error(`Fel färgtyp: ${farg}, väntade 2 (RGB utan alfa).`);
  process.exit(1);
}
console.log(`skrev kvario-marke-80.png · 80px · RGB utan alfa · ${png.length} byte`);
