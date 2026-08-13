/* ============================================================
   Avdragsguide — enskild firma, Sverige

   Detta är vägledning, inte besked. Reglerna har undantag och
   beloppen ändras. Varje post pekar vidare till Skatteverket.

   verdict:  "ja"     — normalt avdragsgill
             "delvis" — bara verksamhetens andel, eller med tak
             "nej"    — normalt inte avdragsgill
   ============================================================ */

export const AVDRAG = [
  {
    id: "hemmakontor",
    name: "Kontor hemma",
    verdict: "delvis",
    short: "Schablonbelopp om du arbetar minst 800 timmar hemma.",
    detail:
      "Har du inget separat kontor får du dra av ett schablonbelopp för arbete i egen bostad, förutsatt att du arbetat minst 800 timmar där under året. Beloppet skiljer sig mellan villa och bostadsrätt eller hyresrätt. Har du ett rum som uteslutande används för verksamheten gäller andra regler och avdraget kan bli större.",
    tags: ["kontor", "hemma", "hemmakontor", "arbetsrum", "hyra", "bostad"],
  },
  {
    id: "dator",
    name: "Dator, skärm och teknik",
    verdict: "ja",
    short: "Direktavdrag under ett halvt prisbasbelopp, annars avskrivning.",
    detail:
      "Utrustning som huvudsakligen används i verksamheten är avdragsgill. Kostar den mindre än ett halvt prisbasbelopp exklusive moms drar du av hela summan direkt. Är den dyrare skrivs den av över flera år. Använder du den även privat i betydande omfattning ska du proportionera.",
    tags: ["dator", "laptop", "skärm", "mac", "pc", "tangentbord", "kamera", "utrustning", "inventarie"],
  },
  {
    id: "telefon",
    name: "Mobil och abonnemang",
    verdict: "delvis",
    short: "Bara verksamhetens andel — privat användning räknas bort.",
    detail:
      "Både telefonen och abonnemanget är avdragsgilla till den del de används i verksamheten. Har du bara ett nummer som du använder till allt förväntas du göra en rimlig uppdelning. Ett separat företagsabonnemang är enklare att motivera.",
    tags: ["telefon", "mobil", "abonnemang", "iphone", "samtal", "bredband", "internet"],
  },
  {
    id: "programvara",
    name: "Programvara och tjänster",
    verdict: "ja",
    short: "Licenser, molntjänster, webbhotell och domäner.",
    detail:
      "Löpande kostnader för verktyg du använder i arbetet är fullt avdragsgilla — designprogram, utvecklingsverktyg, lagring, webbhotell, domännamn och liknande. Betalar du i utländsk valuta gäller kursen på betalningsdagen.",
    tags: ["programvara", "licens", "prenumeration", "molntjänst", "webbhotell", "domän", "saas", "adobe", "verktyg"],
  },
  {
    id: "representation",
    name: "Representation och kundmåltider",
    verdict: "delvis",
    short: "Ingen inkomstskatteeffekt för måltider — men momsen får du dra.",
    detail:
      "Det här missförstås ofta. Sedan 2017 finns inget inkomstskattemässigt avdrag för måltider vid representation. Däremot får du dra av momsen på ett begränsat underlag per person och tillfälle. För enklare förtäring, som kaffe och fika, finns ett litet avdrag kvar. Anteckna alltid syfte och vilka som deltog.",
    tags: ["representation", "middag", "kund", "restaurang", "fika", "möte", "lunch med kund"],
  },
  {
    id: "egenlunch",
    name: "Din egen lunch",
    verdict: "nej",
    short: "Mat du äter själv är en privat levnadskostnad.",
    detail:
      "Lunch på jobbet, kaffe på stan och mat under en vanlig arbetsdag är aldrig avdragsgill, oavsett om du satt och arbetade. Undantag finns vid tjänsteresa med övernattning, där reglerna om ökade levnadskostnader gäller i stället.",
    tags: ["lunch", "mat", "kaffe", "frukost", "middag själv", "livsmedel"],
  },
  {
    id: "bil",
    name: "Egen bil i verksamheten",
    verdict: "delvis",
    short: "Schablon per mil för verksamhetsresor, mot körjournal.",
    detail:
      "Använder du din privata bil i verksamheten drar du av ett schablonbelopp per mil för de resor som hör till arbetet. Kravet är en körjournal med datum, sträcka, syfte och mätarställning. Utan journal underkänns avdraget ofta vid kontroll.",
    tags: ["bil", "mil", "körning", "bensin", "drivmedel", "resa", "körjournal", "parkering"],
  },
  {
    id: "tjansteresa",
    name: "Tjänsteresor och traktamente",
    verdict: "ja",
    short: "Resa, boende och schablon för ökade levnadskostnader.",
    detail:
      "Resor i verksamheten är avdragsgilla: tåg, flyg, hotell och taxi. Vid övernattning utanför den vanliga verksamhetsorten får du dessutom göra avdrag för ökade levnadskostnader enligt schablon. Spara biljetter och underlag som visar syftet med resan.",
    tags: ["resa", "tåg", "flyg", "hotell", "taxi", "konferens", "traktamente", "övernattning"],
  },
  {
    id: "utbildning",
    name: "Kurser och utbildning",
    verdict: "delvis",
    short: "Ja om den underhåller din kompetens, nej om den ger en ny.",
    detail:
      "Fortbildning som håller igång eller uppdaterar kunskaper du redan använder i verksamheten är avdragsgill. Utbildning som ger dig en helt ny kompetens eller yrkesbehörighet räknas normalt som en privat investering och är det inte. Gränsen är inte alltid självklar — dokumentera kopplingen till det du redan gör.",
    tags: ["kurs", "utbildning", "konferens", "certifiering", "workshop", "fortbildning", "bok"],
  },
  {
    id: "litteratur",
    name: "Facklitteratur och tidskrifter",
    verdict: "ja",
    short: "Om innehållet hör till verksamheten.",
    detail:
      "Böcker, branschtidningar och betalt fackinnehåll som du behöver i arbetet är avdragsgilla. Allmänna dagstidningar och nöjesläsning är det normalt inte, även om du läser dem på kontoret.",
    tags: ["bok", "böcker", "tidning", "tidskrift", "facklitteratur", "prenumeration tidning"],
  },
  {
    id: "klader",
    name: "Kläder",
    verdict: "nej",
    short: "Bara skydds- och arbetskläder som inte går att bära privat.",
    detail:
      "Vanliga kläder är aldrig avdragsgilla, hur mycket du än använder dem i arbetet. Undantaget är skyddskläder och uniformsliknande arbetskläder som är olämpliga för privat bruk, gärna med företagets logotyp.",
    tags: ["kläder", "skor", "kostym", "arbetskläder", "skyddskläder", "uniform"],
  },
  {
    id: "friskvard",
    name: "Friskvård och träning",
    verdict: "nej",
    short: "Friskvårdsbidraget är en anställningsförmån — inte för dig som egen.",
    detail:
      "Detta är ett av de vanligaste missförstånden. Har du enskild firma kan du inte dra av ditt eget gymkort eller massage, eftersom friskvårdsbidraget är en skattefri förmån för anställda. Har du anställd personal kan du ge dem friskvård, men inte dig själv.",
    tags: ["friskvård", "gym", "träning", "massage", "hälsa", "friskvårdsbidrag"],
  },
  {
    id: "forsakring",
    name: "Försäkringar",
    verdict: "delvis",
    short: "Företagsförsäkring ja, privata försäkringar nej.",
    detail:
      "Ansvarsförsäkring, egendomsförsäkring och andra försäkringar som hör till verksamheten är avdragsgilla. Privat hemförsäkring, livförsäkring och sjukvårdsförsäkring är det normalt inte, även om du är ensam i firman.",
    tags: ["försäkring", "ansvarsförsäkring", "företagsförsäkring", "hemförsäkring"],
  },
  {
    id: "pension",
    name: "Eget pensionssparande",
    verdict: "ja",
    short: "Upp till en andel av inkomsten, med ett tak.",
    detail:
      "Som enskild näringsidkare får du göra avdrag för eget pensionssparande upp till en viss andel av näringsinkomsten, med ett takbelopp kopplat till prisbasbeloppet. Det är ett av få avdrag som både sänker skatten och bygger något åt dig — men pengarna är låsta till pensionen.",
    tags: ["pension", "pensionssparande", "tjänstepension", "sparande"],
  },
  {
    id: "marknadsforing",
    name: "Marknadsföring och annonser",
    verdict: "ja",
    short: "Annonser, trycksaker, webbplats och reklam.",
    detail:
      "Kostnader för att få kunder är fullt avdragsgilla: annonsering, visitkort, webbplats, fotografering av produkter och liknande. Reklamgåvor med företagets namn är avdragsgilla upp till ett begränsat belopp per mottagare.",
    tags: ["marknadsföring", "annons", "reklam", "visitkort", "hemsida", "webbplats", "logotyp", "foto"],
  },
  {
    id: "konsult",
    name: "Redovisning och rådgivning",
    verdict: "ja",
    short: "Bokföringshjälp, revisor och juridisk rådgivning i firman.",
    detail:
      "Arvoden till redovisningskonsult, revisor och jurist för frågor som rör verksamheten är avdragsgilla. Rådgivning i dina privata angelägenheter är det inte, även om samma person hjälper dig med båda.",
    tags: ["redovisning", "bokföring", "revisor", "konsult", "jurist", "advokat", "rådgivning"],
  },
  {
    id: "kontorsmaterial",
    name: "Kontorsmaterial och möbler",
    verdict: "ja",
    short: "Papper, pennor, skrivbord och kontorsstol.",
    detail:
      "Förbrukningsmaterial dras av direkt. Möbler som skrivbord och stol är avdragsgilla när de används i verksamheten — står de i ett rum som också används privat kan avdraget ifrågasättas.",
    tags: ["kontorsmaterial", "papper", "penna", "skrivbord", "stol", "möbler", "lampa", "hylla"],
  },
  {
    id: "bank",
    name: "Bankavgifter och betalningar",
    verdict: "ja",
    short: "Avgifter på företagskontot och för betallösningar.",
    detail:
      "Kontoavgifter, transaktionsavgifter och kostnader för betallösningar som hör till verksamheten är avdragsgilla. Ränta på företagslån dras av i näringsverksamheten. Avgifter på ditt privatkonto är inte avdragsgilla — ett skäl att hålla kontona separerade.",
    tags: ["bank", "bankavgift", "swish", "stripe", "kortavgift", "ränta", "lån"],
  },
  {
    id: "arbetsresor",
    name: "Resor mellan hemmet och arbetsplatsen",
    verdict: "delvis",
    short: "Avdrag först över ett tröskelbelopp per år.",
    detail:
      "Dagliga resor till en fast arbetsplats behandlas annorlunda än resor i verksamheten. Avdrag medges bara för den del som överstiger ett tröskelbelopp under året, och det finns krav på tidsvinst jämfört med kollektivtrafik.",
    tags: ["arbetsresor", "pendling", "sl", "busskort", "månadskort", "kollektivtrafik"],
  },
  {
    id: "boter",
    name: "Böter och förseningsavgifter",
    verdict: "nej",
    short: "Aldrig avdragsgilla, inte ens i tjänsten.",
    detail:
      "Parkeringsböter, fortkörningsböter, förseningsavgifter till Skatteverket och andra sanktionsavgifter är aldrig avdragsgilla, även om de uppstod under en arbetsresa. Ränta på skattekontot är inte heller avdragsgill.",
    tags: ["böter", "parkeringsböter", "fortkörning", "förseningsavgift", "sanktionsavgift", "straffavgift"],
  },
];

/* Matchar en fritextsträng mot posterna. Används både i sökrutan
   och för att föreslå vägledning när användaren skriver in en kostnad. */
export function matchAvdrag(text, limit = 20) {
  const q = (text || "").toLowerCase().trim();
  if (!q) return AVDRAG.slice(0, limit);

  return AVDRAG
    .map((a) => {
      let score = 0;
      if (a.name.toLowerCase().includes(q)) score += 10;
      for (const t of a.tags) {
        if (t === q) score += 8;
        else if (t.includes(q) || q.includes(t)) score += 4;
      }
      if (a.short.toLowerCase().includes(q)) score += 2;
      return { a, score };
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map((x) => x.a);
}

export const VERDICT = {
  ja: { label: "Avdragsgill", tone: "yes" },
  delvis: { label: "Delvis", tone: "part" },
  nej: { label: "Inte avdragsgill", tone: "no" },
};
