/* ============================================================
   Breven

   Ett brev per händelse. Varje funktion returnerar ämne, HTML och
   text — inget skickas härifrån, det gör epost.js.

   Regeln för vad som förtjänar ett brev: mottagaren ska behöva
   veta något, eller behöva göra något. Brev som bara säger att
   allt är som vanligt lär folk att sluta läsa dem, och då missas
   det som faktiskt betyder något.
   ============================================================ */

import { brev, textbrev, rader, ruta, knapp, fly, kr, datum, APP_URL, SALJARE, ARMOMSREGISTRERAD } from "./brevmall.js";

/* Momsen räknas baklänges ur bruttobeloppet, eftersom priset anges
   inklusive moms mot konsument.

   Är säljaren inte momsregistrerad finns ingen moms att räkna på.
   Att ändå visa "varav moms 25 %" vore att påstå att moms tagits ut,
   vilket är fel uppgift till både kunden och bokföringen — och något
   man inte får göra utan registrering. */
function momsdelar(bruttoOre, sats = 0.25) {
  if (!ARMOMSREGISTRERAD) return { netto: bruttoOre, moms: 0, brutto: bruttoOre, sats: 0 };
  const netto = Math.round(bruttoOre / (1 + sats));
  return { netto, moms: bruttoOre - netto, brutto: bruttoOre, sats };
}

/* Raderna som specificerar beloppet. Utan momsregistrering blir det
   en enda rad, plus upplysningen om varför momsen saknas — den är
   det första en bokföringskunnig kund letar efter. */
function beloppsrader(m, forsta) {
  if (!ARMOMSREGISTRERAD) {
    return rader([
      [forsta, `${kr(m.brutto)} kr`],
      ["Totalt betalt", `${kr(m.brutto)} kr`, true],
    ]);
  }
  return rader([
    [forsta, `${kr(m.brutto)} kr`],
    ["Varav netto", `${kr(m.netto)} kr`],
    [`Varav moms ${Math.round(m.sats * 100)} %`, `${kr(m.moms)} kr`],
    ["Totalt betalt", `${kr(m.brutto)} kr`, true],
  ]);
}

const MOMSFRI_TEXT =
  "Ingen moms är debiterad. Försäljningen är undantagen från skatteplikt.";

/* ---------- 1. Nytt konto ---------- */
export function valkommen({ epost, provDagar = 14 }) {
  const rubrik = "Välkommen till Kvario";
  return {
    amne: rubrik,
    html: brev({
      rubrik,
      ingress: `Kontot är skapat och din provperiod på ${provDagar} dagar har börjat. Allt är upplåst, och inget kort behövs.`,
      kropp: `
        <p style="margin:0 0 20px;font-size:13.5px;line-height:1.7;color:#4A5D68">
          Kvario räknar ut vad som blir kvar av det du fakturerar när moms, egenavgifter
          och skatt är betalda — och hur mycket du bör flytta undan redan nu.
        </p>
        <p style="margin:0 0 12px;font-size:13.5px;line-height:1.7;color:#4A5D68">
          Tre saker som är värda att göra först:
        </p>
        <ol style="margin:0 0 24px;padding-left:20px;font-size:13.5px;line-height:1.8;color:#4A5D68">
          <li>Lägg in det du fakturerat hittills i år</li>
          <li>Fyll i din kommunalskatt under Konto — den skiljer flera tusen på ett år</li>
          <li>Skriv in vad du betalar i preliminärskatt varje månad, så ser du om beloppet stämmer</li>
        </ol>
        ${knapp("Öppna Kvario", APP_URL)}`,
      fot: `Har du frågor går det bra att svara på det här brevet.`,
    }),
    text: textbrev({
      rubrik,
      stycken: [
        `Kontot är skapat och din provperiod på ${provDagar} dagar har börjat.`,
        "",
        "Tre saker att göra först:",
        "1. Lägg in det du fakturerat hittills i år",
        "2. Fyll i din kommunalskatt under Konto",
        "3. Skriv in din preliminärskatt per månad",
      ],
      fot: "Har du frågor går det bra att svara på det här brevet.",
    }),
  };
}

/* ---------- 2. Provperioden tar slut ---------- */
export function provperiodSlutar({ dagarKvar, slutar }) {
  const rubrik = dagarKvar <= 1
    ? "Din provperiod tar slut i morgon"
    : `Din provperiod tar slut om ${dagarKvar} dagar`;

  return {
    amne: rubrik,
    html: brev({
      rubrik,
      ingress: `Provperioden löper ut ${datum(slutar)}. Din data ligger kvar oavsett vad du väljer.`,
      kropp: `
        <p style="margin:0 0 20px;font-size:13.5px;line-height:1.7;color:#4A5D68">
          Uträkningen av vad som blir kvar är gratis för alltid. Det som låses är
          marginalräknaren, årsprognosen, rapporterna och obegränsat med fakturor.
        </p>
        ${rader([
          ["Kvario Pro, månadsvis", "99 kr/mån"],
          ["Kvario Pro, årsvis", "990 kr/år"],
          ["Motsvarar per månad", "82 kr", true],
        ])}
        <div style="height:22px"></div>
        ${knapp("Fortsätt med Pro", `${APP_URL}/?flik=konto`)}`,
      fot: "Vill du inte fortsätta behöver du inte göra någonting alls.",
    }),
    text: textbrev({
      rubrik,
      stycken: [
        `Provperioden löper ut ${datum(slutar)}. Din data ligger kvar oavsett.`,
        "",
        "Kvario Pro: 99 kr/mån eller 990 kr/år (82 kr/mån).",
        "",
        `Fortsätt här: ${APP_URL}`,
      ],
      fot: "Vill du inte fortsätta behöver du inte göra någonting.",
    }),
  };
}

/* ---------- 3. Orderbekräftelse ----------
   TVÅ SAKER SOM MÅSTE VARA RÄTT:

   1. Momsen ska specificeras med belopp och sats. Köparen kan
      behöva den för sin egen bokföring.

   2. Ångerrätten för digitala tjänster upphör bara om kunden
      uttryckligen samtyckt till omedelbar leverans OCH bekräftat
      att ångerrätten då går förlorad. Samtycket måste dokumenteras
      — därför står det här och sparas i databasen. */
export function orderbekraftelse({
  ordernummer, epost, namn, belopp, interval, betaldatum,
  periodSlut, angerrattSamtycke, fakturaUrl,
}) {
  const m = momsdelar(belopp);
  const plan = interval === "month" ? "Kvario Pro, månadsvis" : "Kvario Pro, årsvis";
  const period = interval === "month" ? "1 månad" : "12 månader";
  const rubrik = "Tack för din beställning";

  const angerText = angerrattSamtycke
    ? `Du begärde att tjänsten skulle levereras omedelbart och bekräftade att ångerrätten
       då upphör när leveransen påbörjats. Tjänsten aktiverades ${datum(betaldatum)}.
       Du kan fortfarande säga upp prenumerationen när som helst och behåller tillgången
       till ${datum(periodSlut)}.`
    : `Som konsument har du 14 dagars ångerrätt från köpet. Du begär återbetalning
       direkt i appen under Konto, eller genom att kontakta ${fly(SALJARE.epost)}.
       Prenumerationen kan sägas upp när som helst och du behåller tillgången
       till ${datum(periodSlut)}.`;

  return {
    amne: `Orderbekräftelse ${ordernummer} — Kvario Pro`,
    html: brev({
      rubrik,
      ingress: "Din prenumeration är aktiverad och alla funktioner är upplåsta.",
      kropp: `
        ${rader([
          ["Ordernummer", `<span style="font-family:monospace">${fly(ordernummer)}</span>`],
          ["Betaldatum", datum(betaldatum)],
          ["Beställare", namn ? `${fly(namn)}<br><span style="color:#8698A1;font-size:12px">${fly(epost)}</span>` : fly(epost)],
        ])}

        <div style="height:26px"></div>
        <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8698A1;font-weight:600;margin-bottom:10px">Sammanfattning</div>
        ${beloppsrader(m, `${plan} · period ${period}, förnyas ${datum(periodSlut)}`)}
        ${ARMOMSREGISTRERAD ? "" : `
          <p style="margin:12px 0 0;font-size:11.5px;line-height:1.6;color:#8698A1">${MOMSFRI_TEXT}</p>`}

        ${fakturaUrl ? `<div style="height:22px"></div>${knapp("Ladda ner kvitto som PDF", fakturaUrl)}` : ""}

        <div style="height:26px"></div>
        ${ruta("Ångerrätt", angerText)}`,
      fot: `Prenumerationen förnyas automatiskt tills du säger upp den. Du hanterar den,
            byter kort och hämtar kvitton i appen under Konto.`,
    }),
    text: textbrev({
      rubrik,
      stycken: [
        `Ordernummer: ${ordernummer}`,
        namn ? `Beställare: ${namn}` : null,
        `Betaldatum: ${datum(betaldatum)}`,
        "",
        plan,
        ARMOMSREGISTRERAD ? `Netto: ${kr(m.netto)} kr` : null,
        ARMOMSREGISTRERAD ? `Moms ${Math.round(m.sats * 100)} %: ${kr(m.moms)} kr` : null,
        `Totalt betalt: ${kr(m.brutto)} kr`,
        ARMOMSREGISTRERAD ? null : MOMSFRI_TEXT,
        "",
        `Förnyas ${datum(periodSlut)}. Kan sägas upp när som helst.`,
      ].filter(Boolean),
    }),
  };
}

/* ---------- 4. Betalningen gick inte igenom ----------
   Det enda brevet som är brådskande. Stripe försöker igen några
   gånger, men kortet måste bytas av kunden. */
export function betalningMisslyckades({ belopp, nastaForsok, portalUrl }) {
  const rubrik = "Betalningen gick inte igenom";
  return {
    amne: rubrik,
    html: brev({
      rubrik,
      ingress: `Vi kunde inte dra ${kr(belopp)} kr för din prenumeration. Oftast har kortet gått ut eller saknat täckning.`,
      kropp: `
        ${ruta("Vad som händer nu",
          nastaForsok
            ? `Vi försöker igen ${datum(nastaForsok)}. Byter du kort innan dess dras beloppet direkt
               och prenumerationen fortsätter utan avbrott.`
            : `Byt kort så dras beloppet direkt och prenumerationen fortsätter utan avbrott.
               Sker inget avslutas den automatiskt.`,
          "varning")}
        <div style="height:22px"></div>
        ${knapp("Byt betalkort", portalUrl || `${APP_URL}/?flik=konto`)}
        <p style="margin:20px 0 0;font-size:12.5px;line-height:1.65;color:#4A5D68">
          Din data ligger kvar. Avslutas prenumerationen fortsätter uträkningen av vad
          som blir kvar att fungera — det är rapporterna och verktygen som låses.
        </p>`,
    }),
    text: textbrev({
      rubrik,
      stycken: [
        `Vi kunde inte dra ${kr(belopp)} kr för din prenumeration.`,
        nastaForsok ? `Vi försöker igen ${datum(nastaForsok)}.` : "",
        "",
        `Byt kort: ${portalUrl || APP_URL}`,
        "",
        "Din data ligger kvar oavsett.",
      ].filter(Boolean),
    }),
  };
}

/* ---------- 5. Prenumerationen är uppsagd ---------- */
export function uppsagd({ slutar }) {
  const rubrik = "Din prenumeration är uppsagd";
  return {
    amne: rubrik,
    html: brev({
      rubrik,
      ingress: `Du har kvar alla Pro-funktioner till ${datum(slutar)}. Sedan går kontot över till den gratis versionen.`,
      kropp: `
        <p style="margin:0 0 20px;font-size:13.5px;line-height:1.7;color:#4A5D68">
          Ingenting raderas. Dina fakturor, kostnader och inställningar ligger kvar, och
          uträkningen av vad som blir kvar fungerar som vanligt. Det som låses är
          marginalräknaren, årsprognosen, rapporterna och antalet fakturor.
        </p>
        ${ruta("Ångrar du dig",
          `Du kan starta prenumerationen igen när som helst i appen under Konto. Allt
           finns kvar precis som du lämnade det.`)}
        <div style="height:22px"></div>
        ${knapp("Öppna Kvario", APP_URL)}`,
      fot: `Vill du berätta varför du slutade tar vi tacksamt emot det — svara bara på
            det här brevet. Det är så tjänsten blir bättre.`,
    }),
    text: textbrev({
      rubrik,
      stycken: [
        `Du har kvar alla Pro-funktioner till ${datum(slutar)}.`,
        "",
        "Ingenting raderas. Uträkningen av vad som blir kvar fungerar som vanligt.",
        "",
        `Starta om när du vill: ${APP_URL}`,
      ],
    }),
  };
}

/* ---------- Till dig själv ----------
   Ett kort brev per händelse som betyder något. Meningen är att du
   ska veta hur det går utan att logga in och leta — men bara för
   det som faktiskt är nyheter. Brev om sådant man kan räkna ut lär
   en att sluta läsa dem. */
export function adminNyttKonto({ epost, antal }) {
  const rubrik = "Ny registrering";
  return {
    amne: `Kvario: ny registrering — ${epost}`,
    html: brev({
      rubrik,
      ingress: `<b>${fly(epost)}</b> har skapat ett konto och börjat sin provperiod.`,
      kropp: rader([
        ["Adress", fly(epost)],
        ["Tidpunkt", new Date().toLocaleString("sv-SE")],
        ...(antal ? [["Konton totalt", String(antal), true]] : []),
      ]),
    }),
    text: textbrev({
      rubrik,
      stycken: [`${epost} har skapat ett konto.`, `Tidpunkt: ${new Date().toLocaleString("sv-SE")}`],
    }),
  };
}

export function adminNyPrenumeration({ epost, namn, ordernummer, belopp, interval }) {
  const rubrik = "Ny prenumeration";
  const plan = interval === "month" ? "månadsvis" : "årsvis";
  return {
    amne: `Kvario: ny prenumeration — ${kr(belopp)} kr ${plan}`,
    html: brev({
      rubrik,
      ingress: `<b>${fly(namn || epost)}</b> har tecknat Kvario Pro, ${plan}.`,
      kropp: rader([
        ["Ordernummer", `<span style="font-family:monospace">${fly(ordernummer)}</span>`],
        ["Kund", fly(namn ? `${namn} (${epost})` : epost)],
        ["Plan", `Pro, ${plan}`],
        ["Belopp", `${kr(belopp)} kr`, true],
      ]),
    }),
    text: textbrev({
      rubrik,
      stycken: [
        `${namn || epost} har tecknat Kvario Pro, ${plan}.`,
        `Ordernummer: ${ordernummer}`,
        `Belopp: ${kr(belopp)} kr`,
      ],
    }),
  };
}

/* En uppsägning. Inte brådskande, men det enda tillfället att få
   veta varför någon slutade — och det är den upplysningen som är
   värd mest av allt i det här brevet. */
export function adminUppsagd({ epost, slutar }) {
  const rubrik = "En prenumeration är uppsagd";
  return {
    amne: `Kvario: uppsägning — ${epost}`,
    html: brev({
      rubrik,
      ingress: `<b>${fly(epost)}</b> har sagt upp sin prenumeration. Tillgången gäller till ${datum(slutar)}.`,
      kropp: `
        ${rader([
          ["Kund", fly(epost)],
          ["Har Pro till", datum(slutar)],
        ])}
        <div style="height:22px"></div>
        ${ruta("Värt att göra",
          "Kunden har fått ett brev där vi frågar varför. Svarar de, spara svaret — " +
          "återkommande skäl är det billigaste sättet att veta vad som saknas i tjänsten.")}`,
    }),
    text: textbrev({
      rubrik,
      stycken: [`${epost} har sagt upp sin prenumeration.`, `Har Pro till ${datum(slutar)}.`],
    }),
  };
}

/* En betalning som inte gick igenom. Brådskande på ett annat sätt än
   ångerrätten: här är det intäkt som håller på att försvinna, och
   oftast av ett skäl kunden själv inte märkt. */
export function adminBetalningsfel({ epost, belopp, nastaForsok }) {
  const rubrik = "En betalning gick inte igenom";
  return {
    amne: `Kvario: betalning nekad — ${epost}`,
    html: brev({
      rubrik,
      ingress: `Kortet för <b>${fly(epost)}</b> nekades på ${kr(belopp)} kr.`,
      kropp: `
        ${rader([
          ["Kund", fly(epost)],
          ["Belopp", `${kr(belopp)} kr`],
          ...(nastaForsok ? [["Stripe försöker igen", datum(nastaForsok)]] : []),
        ])}
        <div style="height:22px"></div>
        ${ruta("Du behöver inte göra något",
          "Kunden har fått ett brev om att byta kort, och Stripe försöker igen automatiskt " +
          "några gånger. Går det ändå inte avslutas prenumerationen av sig själv. " +
          "Hör kunden av sig är det oftast ett utgånget kort.")}`,
    }),
    text: textbrev({
      rubrik,
      stycken: [
        `Kortet för ${epost} nekades på ${kr(belopp)} kr.`,
        nastaForsok ? `Stripe försöker igen ${datum(nastaForsok)}.` : "",
        "Kunden har fått besked. Du behöver inte göra något.",
      ].filter(Boolean),
    }),
  };
}

/* Begäran om återbetalning. Den enda av adminbreven som är
   brådskande: ångerrätten ger kunden pengarna tillbaka inom 14
   dagar från att du fått veta, och en begäran som ligger osedd i
   adminpanelen är en frist som rinner ut. */
export function adminAterbetalningBegard({ epost, belopp, orsak, automatisk }) {
  const rubrik = automatisk ? "Återbetalning ska beviljas" : "Begäran om återbetalning";
  return {
    amne: `Kvario: ${automatisk ? "ångerrätt åberopad" : "återbetalning begärd"} — ${kr(belopp)} kr`,
    html: brev({
      rubrik,
      ingress: `<b>${fly(epost)}</b> har begärt ${kr(belopp)} kr tillbaka.`,
      kropp: `
        ${rader([
          ["Kund", fly(epost)],
          ["Belopp", `${kr(belopp)} kr`],
          ...(orsak ? [["Angiven orsak", fly(orsak)]] : []),
        ])}
        <div style="height:22px"></div>
        ${automatisk
          ? ruta("Inom ångerfristen",
              "Köpet gjordes för mindre än 14 dagar sedan och kunden har inte avsagt sig ångerrätten. " +
              "Återbetalningen ska beviljas — det är inte en bedömningsfråga. Enligt distansavtalslagen " +
              "ska pengarna vara tillbaka inom 14 dagar från att begäran kom in.", "varning")
          : ruta("Utanför ångerfristen",
              "Köpet ligger mer än 14 dagar tillbaka. Du avgör själv om du vill bevilja, men " +
              "en nöjd före detta kund talar oftare väl om tjänsten än en missnöjd.")}
        <div style="height:22px"></div>
        ${knapp("Hantera i adminpanelen", `${APP_URL}/?flik=konto`)}`,
    }),
    text: textbrev({
      rubrik,
      stycken: [
        `${epost} har begärt ${kr(belopp)} kr tillbaka.`,
        orsak ? `Orsak: ${orsak}` : null,
        "",
        automatisk
          ? "Inom ångerfristen — ska beviljas. Pengarna ska vara tillbaka inom 14 dagar."
          : "Utanför ångerfristen — du avgör själv.",
        "",
        APP_URL,
      ].filter(Boolean),
    }),
  };
}

/* ---------- 6. Återbetalning ---------- */
export function aterbetalning({ ordernummer, belopp, helt }) {
  const m = momsdelar(belopp);
  const rubrik = helt ? "Din betalning är återbetald" : "En del av din betalning är återbetald";
  return {
    amne: `${rubrik} — ${ordernummer}`,
    html: brev({
      rubrik,
      ingress: `${kr(belopp)} kr är på väg tillbaka till kortet du betalade med. Det tar normalt tre till fem bankdagar.`,
      kropp: `
        ${rader([
          ["Ordernummer", `<span style="font-family:monospace">${fly(ordernummer)}</span>`],
          ...(ARMOMSREGISTRERAD ? [
            ["Återbetalt netto", `${kr(m.netto)} kr`],
            [`Varav moms ${Math.round(m.sats * 100)} %`, `${kr(m.moms)} kr`],
          ] : []),
          ["Totalt återbetalt", `${kr(belopp)} kr`, true],
        ])}
        ${ARMOMSREGISTRERAD ? "" : `
          <p style="margin:12px 0 0;font-size:11.5px;line-height:1.6;color:#8698A1">${MOMSFRI_TEXT}</p>`}
        <div style="height:24px"></div>
        <p style="margin:0;font-size:12.5px;line-height:1.65;color:#4A5D68">
          ${helt
            ? "Prenumerationen är avslutad och Pro-funktionerna är låsta. Din data ligger kvar."
            : "Prenumerationen löper vidare som vanligt."}
        </p>`,
      fot: "Spara det här brevet som underlag för din bokföring.",
    }),
    text: textbrev({
      rubrik,
      stycken: [
        `Ordernummer: ${ordernummer}`,
        `Totalt återbetalt: ${kr(belopp)} kr`,
        ARMOMSREGISTRERAD ? `Varav moms ${Math.round(m.sats * 100)} %: ${kr(m.moms)} kr` : MOMSFRI_TEXT,
        "",
        "Pengarna är tillbaka på kortet inom tre till fem bankdagar.",
      ].filter(Boolean),
      fot: "Spara det här brevet som underlag för din bokföring.",
    }),
  };
}
