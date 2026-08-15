/* ============================================================
   Frivilliga uppgifter

   Fälten motsvarar regler som faktiskt är byggda — vi frågar aldrig
   efter något vi inte använder, eftersom det skulle antyda en
   precision som inte finns.

   Verktyget förblir en uppskattning även när allt är ifyllt.
   Räntefördelning och periodiseringsfond ingår numera; det som
   fortfarande saknas står i UTELAMNAT nedan.

   OBS: kommunalskattesatserna är ungefärliga och ska kontrolleras
   mot Skatteverkets aktuella tabell. De ändras varje år och beror
   på kommun plus region. Fältet går alltid att skriva över.
   ============================================================ */

export const KOMMUNER = [
  ["Stockholm", 29.98], ["Göteborg", 32.60], ["Malmö", 32.42], ["Uppsala", 32.85],
  ["Linköping", 31.20], ["Västerås", 31.75], ["Örebro", 32.20], ["Helsingborg", 31.24],
  ["Norrköping", 32.05], ["Jönköping", 32.42], ["Umeå", 33.65], ["Lund", 31.19],
  ["Borås", 33.30], ["Huddinge", 31.98], ["Eskilstuna", 33.06], ["Nacka", 30.13],
  ["Södertälje", 33.03], ["Karlstad", 33.65], ["Täby", 29.63], ["Växjö", 32.24],
  ["Halmstad", 31.98], ["Sundsvall", 33.88], ["Luleå", 33.40], ["Gävle", 33.52],
  ["Trollhättan", 33.58], ["Östersund", 33.87], ["Falun", 34.14], ["Kalmar", 33.16],
  ["Skellefteå", 33.30], ["Kiruna", 34.30],
];

export const BEGRAVNINGSAVGIFT = 0.28;   // procent, betalas av alla
export const KYRKOAVGIFT_SNITT = 1.03;   // procent, endast medlemmar

/* Vad som fortfarande inte räknas. Visas öppet i appen så att
   ingen tror att siffran är fullständig. */
export const UTELAMNAT = [
  "Expansionsfond",
  "Sparade underskott från tidigare år",
  "Återföring av tidigare periodiseringsfonder",
];
