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
