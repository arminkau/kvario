/* ============================================================
   Gemensamma texter

   Allt som förekommer på både landningssidan och i appen ligger
   här. Skälet är konkret: de två har glidit isär fyra gånger under
   utvecklingen — etiketter har rättats på ett ställe och glömts på
   det andra, och användaren har fått olika svar beroende på var
   hen tittade.

   Regel: står samma ord på två ställen i gränssnittet ska det
   hämtas härifrån, inte skrivas två gånger.
   ============================================================ */

export const MARKE = "Kvario";
export const TAGLINE = "Vad av pengarna som faktiskt är dina";

/* Etiketter i marginalräknaren. Beror på företagsform, eftersom
   det som sjunker när vinsten sjunker inte är detsamma. */
export const MG = {
  prislapp: "Prislapp",
  momsTillbaka: (vatName) => `${vatName} tillbaka`,
  verkligKostnad: "Verklig kostnad",
  besparing: (form) =>
    form === "ab" ? "Lägre bolags- och utdelningsskatt" : "Lägre skatt och egenavgifter",
  besparingKort: (form) =>
    form === "ab" ? "bolagsskatt och skatt på utdelning" : "både inkomstskatt och egenavgifter",
  lagen: [
    ["business", "Företagsköp"],
    ["private", "Privat köp"],
    ["payout", "Ta ut netto"],
  ],
  forklaring:
    "Prislappen säger sällan vad något faktiskt kostar dig. Ett företagsköp sänker vinsten, " +
    "och med den allt som beräknas på vinsten. I enskild firma är det både inkomstskatten och " +
    "egenavgifterna — egenavgifterna står för ungefär hälften. I aktiebolag är det bolagsskatten " +
    "och skatten på den utdelning som annars hade blivit av vinsten. Är du momsregistrerad får du " +
    "dessutom tillbaka momsen. Ett privatköp betalar du däremot med pengar som redan passerat allt detta.",
};

/* Posterna i fördelningsstapeln. */
export const STAPEL = {
  kvarTillDig: "Kvar till dig",
  egnaKostnader: "Egna kostnader",
  kvarNot: "Fritt att ta ut",
  momsNot: "Redovisas vidare, var aldrig dina",
  kostnadNot: "Redan utbetalt",
  in: "Kommer in",
  ut: "Blir kvar",
};

export const ANSVAR =
  `${MARKE} är ett beräknings- och planeringsverktyg, inte skatterådgivning.`;
