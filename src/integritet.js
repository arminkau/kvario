/* ============================================================
   Integritetspolicy och lagringsinformation

   UTKAST — inte juridisk rådgivning. Fyll i dina egna uppgifter
   där det står [...] och låt någon granska innan lansering.

   Två saker som avgör om texten stämmer i praktiken:

   1. Välj EU-region i Supabase (Frankfurt eller Stockholm).
      Ligger databasen i USA blir tredjelandsöverföring en fråga
      du måste hantera separat, och texten nedan blir felaktig.

   2. Teckna personuppgiftsbiträdesavtal med Supabase, Vercel
      och Stripe. Alla tre erbjuder standardavtal — det är några
      klick, men utan dem saknar du en rättslig grund för att
      låta dem behandla dina användares uppgifter.
   ============================================================ */

export const POLICY_VERSION = "2026-01";

export const ANSVARIG = {
  namn: "[Ditt företagsnamn]",
  orgnr: "[Organisationsnummer]",
  epost: "[din@epost.se]",
};

export const INTEGRITET = [
  {
    h: "Vem som ansvarar",
    p: `${ANSVARIG.namn}, organisationsnummer ${ANSVARIG.orgnr}, är personuppgiftsansvarig för
    behandlingen av dina uppgifter. Kontakta oss på ${ANSVARIG.epost} vid frågor eller om du vill
    utöva någon av dina rättigheter.`,
  },
  {
    h: "Vilka uppgifter vi behandlar",
    p: `Din e-postadress, som används för inloggning. De uppgifter du själv matar in i tjänsten:
    fakturabelopp, kundnamn, kostnader, löneuppgifter och inställningar. Teknisk information som
    behövs för att tjänsten ska fungera, exempelvis inloggningssession och tidpunkt för
    godkännande av villkoren. Betalar du för Pro behandlar vår betalningsleverantör dessutom
    betaluppgifter — vi lagrar aldrig ditt kortnummer.`,
  },
  {
    h: "Varför och med vilken rätt",
    p: `Vi behandlar uppgifterna för att kunna leverera tjänsten du beställt. Den rättsliga grunden
    är fullgörande av avtal. För bokföring av betalningar är grunden rättslig förpliktelse.
    Skickar vi nyhetsbrev sker det bara med ditt samtycke, som du kan återkalla när som helst.
    Vi säljer aldrig dina uppgifter och använder dem inte för profilering eller annonsering.`,
  },
  {
    h: "Vilka som får tillgång",
    p: `Vi anlitar personuppgiftsbiträden för drift: en databas- och inloggningsleverantör, en
    webbhotelleverantör och en betalningsleverantör. Samtliga behandlar uppgifterna enligt avtal
    och endast på våra instruktioner. Datan lagras inom EU. Vi lämnar inte ut uppgifter till
    andra utom när lagen kräver det.`,
  },
  {
    h: "Hur länge vi sparar",
    p: `Dina uppgifter sparas så länge du har ett konto. Raderar du kontot tas dina uppgifter bort
    inom 30 dagar, med undantag för underlag som bokföringslagen kräver att vi behåller i sju år.
    Ett konto som varit inaktivt i tre år raderas efter att vi hört av oss först.`,
  },
  {
    h: "Dina rättigheter",
    p: `Du har rätt att få veta vilka uppgifter vi har om dig, att få felaktigheter rättade, att få
    dina uppgifter raderade, att invända mot behandlingen och att få ut din data i ett läsbart
    format. Du kan exportera och radera allt direkt i tjänsten, under Din data. Är du missnöjd med
    hur vi behandlar dina uppgifter kan du klaga hos Integritetsskyddsmyndigheten, IMY.`,
  },
  {
    h: "Lagring i din webbläsare",
    p: `Vi använder inga annonscookies och spårar dig inte mellan webbplatser. För att inloggningen
    ska fungera lagras en sessionsnyckel i din webbläsare — den är nödvändig för tjänsten och kan
    inte väljas bort utan att du loggas ut. Väljer du att tillåta statistik lagrar vi dessutom
    anonym information om hur tjänsten används, så att vi kan förbättra den. Det valet kan du
    ändra när som helst.`,
  },
  {
    h: "Ändringar",
    p: `Vid väsentliga ändringar av denna policy informerar vi dig innan de börjar gälla.`,
  },
];

/* Nödvändig lagring kan inte väljas bort — utan den fungerar
   inte inloggningen. Statistik är avstängd tills användaren
   aktivt väljer till den. Förvalt "på" är inte samtycke. */
export const LAGRING = [
  {
    id: "nodvandig",
    namn: "Nödvändig",
    alltid: true,
    text: "Inloggningssession och dina sparade inställningar. Utan detta kan du inte vara inloggad.",
  },
  {
    id: "statistik",
    namn: "Statistik",
    alltid: false,
    text: "Anonym information om vilka funktioner som används, så att vi vet vad vi ska förbättra. Inga annonser, ingen spårning mellan webbplatser.",
  },
];
