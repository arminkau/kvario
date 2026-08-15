/* ============================================================
   Byter ut Capacitors standardikoner mot Kvarios

   Android vill ha ikonen i fem tätheter, plus ett separat lager
   för adaptiva ikoner (foreground) som systemet får beskära till
   cirkel, squircle eller vad tillverkaren nu använder. Därför
   ritas foreground med extra marginal.

   Kör efter "npx cap add android":
     node verktyg/gor-android-ikoner.mjs
   ============================================================ */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ritaIkon } from "./rita-ikon.mjs";

const HAR = dirname(fileURLToPath(import.meta.url));
const RES = join(HAR, "..", "android", "app", "src", "main", "res");

if (!existsSync(RES)) {
  console.error("Hittar inte android/app/src/main/res — kör 'npx cap add android' först.");
  process.exit(1);
}

const TATHETER = [
  ["mipmap-mdpi", 48],
  ["mipmap-hdpi", 72],
  ["mipmap-xhdpi", 96],
  ["mipmap-xxhdpi", 144],
  ["mipmap-xxxhdpi", 192],
];

for (const [mapp, storlek] of TATHETER) {
  const dir = join(RES, mapp);
  mkdirSync(dir, { recursive: true });
  const vanlig = ritaIkon(storlek, false);
  writeFileSync(join(dir, "ic_launcher.png"), vanlig);
  writeFileSync(join(dir, "ic_launcher_round.png"), vanlig);
  // Foreground ritas som maskable: motivet håller sig inom mitten
  // så att inget viktigt försvinner när systemet beskär.
  writeFileSync(join(dir, "ic_launcher_foreground.png"), ritaIkon(storlek * 2, true));
  console.log("skrev", mapp, storlek + "px");
}

// Bakgrundsfärgen för adaptiva ikoner ska matcha ikonens egen botten.
writeFileSync(
  join(RES, "values", "ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#131E26</color>
</resources>
`
);
console.log("skrev ic_launcher_background.xml");
