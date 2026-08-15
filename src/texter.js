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

/* Etiketter i marginalräknaren. */
export const MG = {
  prislapp: "Prislapp",
  momsTillbaka: (vatName) => `${vatName} tillbaka`,
  verkligKostnad: "Verklig kostnad",
  besparing: "Lägre skatt och egenavgifter",
  besparingKort: "både inkomstskatt och egenavgifter",
  /* Två lägen, inte tre. "Ta ut netto" räknade samma sak som
     "Privat köp" — båda svarar på vad du måste fakturera för att ha
     ett visst belopp i handen — och två knappar för samma tal gör
     bara valet svårare. */
  lagen: [
    ["business", "Företagsköp"],
    ["private", "Privat köp"],
  ],
  forklaring:
    "Prislappen säger sällan vad något faktiskt kostar dig. Ett företagsköp sänker vinsten, " +
    "och med den allt som beräknas på vinsten. Det är både inkomstskatten och egenavgifterna " +
    "— egenavgifterna står för ungefär hälften. Är du momsregistrerad får du dessutom tillbaka " +
    "momsen. Ett privatköp betalar du däremot med pengar som redan passerat allt detta.",
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
