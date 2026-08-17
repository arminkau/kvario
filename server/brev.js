/* ============================================================
   Breven

   Ett brev per händelse. Varje funktion returnerar ämne, HTML och
   text — inget skickas härifrån, det gör epost.js.

   Regeln för vad som förtjänar ett brev: mottagaren ska behöva
   veta något, eller behöva göra något. Brev som bara säger att
   allt är som vanligt lär folk att sluta läsa dem, och då missas
   det som faktiskt betyder något.
   ============================================================ */

import { brev, textbrev, rader, ruta, knapp, fly, kr, datum, APP_URL, SALJARE } from "./brevmall.js";

/* Momsen räknas baklänges ur bruttobeloppet, eftersom priset anges
   inklusive moms mot konsument. */
function momsdelar(bruttoOre, sats = 0.25) {
  const netto = Math.round(bruttoOre / (1 + sats));
  return { netto, moms: bruttoOre - netto, brutto: bruttoOre, sats };
}

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
        ${rader([
          [`${plan} · period ${period}, förnyas ${datum(periodSlut)}`, `${kr(m.brutto)} kr`],
          ["Varav netto", `${kr(m.netto)} kr`],
          [`Varav moms ${Math.round(m.sats * 100)} %`, `${kr(m.moms)} kr`],
          ["Totalt betalt", `${kr(m.brutto)} kr`, true],
        ])}

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
        `Netto: ${kr(m.netto)} kr`,
        `Moms ${Math.round(m.sats * 100)} %: ${kr(m.moms)} kr`,
        `Totalt betalt: ${kr(m.brutto)} kr`,
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
          ["Återbetalt netto", `${kr(m.netto)} kr`],
          [`Varav moms ${Math.round(m.sats * 100)} %`, `${kr(m.moms)} kr`],
          ["Totalt återbetalt", `${kr(belopp)} kr`, true],
        ])}
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
        `Varav moms ${Math.round(m.sats * 100)} %: ${kr(m.moms)} kr`,
        "",
        "Pengarna är tillbaka på kortet inom tre till fem bankdagar.",
      ],
      fot: "Spara det här brevet som underlag för din bokföring.",
    }),
  };
}
