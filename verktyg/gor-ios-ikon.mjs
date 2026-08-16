/* ============================================================
   Byter ut Capacitors standardikon mot Kvarios, för iOS

   iOS vill ha en enda fil på 1024x1024 och gör resten själv.
   Två krav skiljer den från Androids:

     Inga runda hörn. iOS lägger sin egen mask över bilden, och
     en ikon som redan är rundad får hörnen klippta två gånger.
     Därför ritas den som fyrkant (maskable=true ger radie noll).

     Ingen alfakanal. Apple avvisar ikoner som har en, även när
     varje pixel är ogenomskinlig.

   Marginalen sätts till samma 17 procent som den vanliga ikonen.
   Androids maskable-marginal på 29 procent är tilltagen för att
   klara en cirkelbeskärning; iOS superellips tar långt mindre, och
   märket hade sett borttappat ut.

   Kör efter "npx cap add ios":
     node verktyg/gor-ios-ikon.mjs
   ============================================================ */

import { writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ritaIkon } from "./rita-ikon.mjs";

const HAR = dirname(fileURLToPath(import.meta.url));
const IKONER = join(HAR, "..", "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset");

if (!existsSync(IKONER)) {
  console.error("Hittar inte ios/App/App/Assets.xcassets/AppIcon.appiconset — kör 'npx cap add ios' först.");
  process.exit(1);
}

const png = ritaIkon(1024, true, 0.17, true);
writeFileSync(join(IKONER, "AppIcon-512@2x.png"), png);

// Kontrollera att den blev som iOS kräver, i stället för att anta det.
const farg = png[25];
if (farg !== 2) {
  console.error(`Fel färgtyp i PNG: ${farg}, väntade 2 (RGB utan alfa).`);
  process.exit(1);
}
console.log(`skrev AppIcon-512@2x.png · 1024px · RGB utan alfa · ${png.length} byte`);
