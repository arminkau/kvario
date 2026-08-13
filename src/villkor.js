/* ============================================================
   Användarvillkor

   VIKTIGT: detta är ett utkast, inte juridisk rådgivning.
   Låt en jurist granska texten innan lansering. Villkor kan
   inte avtala bort ansvar för grov vårdslöshet eller uppsåt,
   och oskäliga villkor mot konsumenter kan jämkas.

   Versionen sparas tillsammans med tidpunkten för godkännandet.
   Ändrar du villkoren, höj versionsnumret — då måste befintliga
   användare godkänna på nytt, och du kan visa exakt vilken text
   var och en accepterat.
   ============================================================ */

export const VILLKOR_VERSION = "2026-01";

export const VILLKOR = [
  {
    h: "1. Vad tjänsten är",
    p: `Kvario är ett beräknings- och planeringsverktyg. Tjänsten hjälper dig att uppskatta
    hur mycket av dina intäkter som går till moms, skatter och avgifter, utifrån de
    uppgifter du själv matar in.`,
  },
  {
    h: "2. Vad tjänsten inte är",
    p: `Kvario utgör inte skatterådgivning, juridisk rådgivning, redovisning, revision eller
    finansiell rådgivning, och ersätter inte kontakt med Skatteverket, en redovisningskonsult
    eller annan behörig rådgivare. Inget i tjänsten ska uppfattas som en rekommendation att
    vidta eller avstå från en viss åtgärd. Beslut du fattar med tjänsten som underlag fattar
    du på eget ansvar.`,
  },
  {
    h: "3. Beräkningarna är uppskattningar",
    p: `Skatteregler ändras, innehåller undantag och beror på omständigheter tjänsten inte
    känner till. Vissa delar av beräkningen bygger på förenklingar och approximationer, vilket
    anges i tjänsten där det är relevant. Resultaten kan därför avvika från din faktiska
    beskattning. Du ansvarar för att stämma av mot Skatteverket eller din rådgivare innan du
    använder siffrorna för deklaration, bokföring, löneuttag eller andra beslut.`,
  },
  {
    h: "4. Dina uppgifter",
    p: `Du ansvarar för att de uppgifter du matar in är korrekta och fullständiga. Felaktiga
    eller ofullständiga uppgifter ger felaktiga resultat. Du ansvarar också för att hålla dina
    inloggningsuppgifter skyddade.`,
  },
  {
    h: "5. Tillgänglighet",
    p: `Tjänsten tillhandahålls i befintligt skick. Vi strävar efter hög tillgänglighet men
    garanterar inte att tjänsten är fri från avbrott eller fel. Vi kan komma att ändra,
    begränsa eller avveckla funktioner. Vid avveckling av tjänsten får du skälig tid att
    exportera din data.`,
  },
  {
    h: "6. Ansvarsbegränsning",
    p: `I den utsträckning lagen tillåter ansvarar vi inte för indirekt skada, utebliven vinst,
    skattetillägg, förseningsavgifter, förlorad data eller andra följdskador som uppstår genom
    användning av tjänsten. Vårt sammanlagda ansvar är begränsat till det belopp du betalat för
    tjänsten under de tolv månader som föregick skadan. Begränsningarna gäller inte vid grov
    vårdslöshet eller uppsåt, eller där tvingande lag säger annat.`,
  },
  {
    h: "7. Prenumeration och betalning",
    p: `Betalda funktioner debiteras i förskott per månad eller år via vår betalningsleverantör.
    Prenumerationen förnyas automatiskt tills du säger upp den. Du kan säga upp när som helst
    och behåller tillgången till periodens slut. Konsumenter har ångerrätt enligt lag, men
    ångerrätten upphör när du uttryckligen begärt att den digitala tjänsten ska levereras
    omedelbart och tagit den i bruk.`,
  },
  {
    h: "8. Personuppgifter",
    p: `Vi behandlar personuppgifter enligt vår integritetspolicy och dataskyddsförordningen.
    Du kan när som helst begära utdrag, rättelse eller radering av dina uppgifter.`,
  },
  {
    h: "9. Ändringar av villkoren",
    p: `Vi kan komma att ändra dessa villkor. Vid väsentliga ändringar informerar vi dig i god
    tid och ber dig godkänna den nya versionen innan du fortsätter använda tjänsten.`,
  },
  {
    h: "10. Tillämplig lag",
    p: `Svensk rätt tillämpas. Är du konsument kan du vända dig till Allmänna
    reklamationsnämnden eller EU:s plattform för tvistlösning online.`,
  },
];
