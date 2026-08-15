/* ============================================================
   Genererar webbens ikoner till public/

   Kör: node verktyg/gor-ikoner.mjs
   Motivet ritas i rita-ikon.mjs — samma bild används av
   Android-ikonerna i gor-android-ikoner.mjs.
   ============================================================ */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ritaIkon } from "./rita-ikon.mjs";

const HAR = dirname(fileURLToPath(import.meta.url));
const UT = join(HAR, "..", "public");

mkdirSync(UT, { recursive: true });

const filer = [
  ["ikon-192.png", 192, false],
  ["ikon-512.png", 512, false],
  ["ikon-maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, false],
];

for (const [namn, storlek, maskable] of filer) {
  writeFileSync(join(UT, namn), ritaIkon(storlek, maskable));
  console.log("skrev", namn, storlek + "px");
}

/* Profilbild för sociala medier. Facebook och Instagram beskär till
   cirkel. Hörnen lämnas därför raka, och marginalen sätts till 16
   procent: med maskable-marginalen på 29 blir märket så litet att
   det tappas bort i en liten avatar, medan 14 gör att cirkeln
   nyper av översta bandets hörn. 1024 px räcker överallt. */
mkdirSync(join(UT, "logo"), { recursive: true });
writeFileSync(join(UT, "logo", "kvario-profilbild-1024.png"), ritaIkon(1024, true, 0.16));
console.log("skrev logo/kvario-profilbild-1024.png 1024px");
