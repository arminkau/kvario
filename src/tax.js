/* ============================================================
   Skattemotor

   All landsspecifik logik ligger här. Komponenterna innehåller
   inte en enda skattesats.

   Kvario räknar bara på enskild firma: vinsten är din inkomst,
   ett enda skattesteg.
   ============================================================ */

const PBB = 59200;      // prisbasbelopp 2026 (Skatteverket)
const SKIKTGRANS = 643000;

/* ---------- Arbetsgivaravgifter per anställd ----------
   Full avgift är 31,42 %, men flera nedsättningar finns och de
   är stora nog att avgöra om en anställning går ihop.

   Växa-stöd: de två första anställda kan få 10,21 % på ersättning
   upp till 35 000 kr i månaden, i upp till 24 månader. Nytt för 2026
   är att avgiften först betalas full och återbetalas i efterhand —
   likviditetsmässigt viktigt, men utfallet över året blir detsamma.

   Ålder: födda 2003-2007 har 20,81 % upp till 25 000 kr per månad.

   Kontrollera alltid mot Skatteverket. Reglerna ändras ofta och
   villkoren för växa-stöd har fler krav än vad som ryms här. */

export const AGA_FULL = 0.3142;
const AGA_PENSION = 0.1021;
const AGA_UNG = 0.2081;

export function arbetsgivaravgift({ manadslon, fodelsear, vaxa, ar = 2026 }) {
  // Ogiltig indata ska ge noll, aldrig NaN. Ett NaN här sprider sig
  // genom hela beräkningen och blir svårt att spåra tillbaka hit.
  const lon = Number(manadslon);
  const arslon = Number.isFinite(lon) ? Math.max(0, lon * 12) : 0;
  if (arslon === 0) return { avgift: 0, sats: AGA_FULL, regel: null, sparat: 0 };
  const manadslonSakrad = arslon / 12;

  const fullAvgift = arslon * AGA_FULL;

  if (vaxa) {
    // Nedsatt upp till 35 000 kr per månad, full avgift på överskjutande
    const nedsattDel = Math.min(manadslonSakrad, 35000) * 12;
    const restDel = Math.max(0, manadslonSakrad - 35000) * 12;
    const avgift = nedsattDel * AGA_PENSION + restDel * AGA_FULL;
    return { avgift, sats: avgift / arslon, regel: "Växa-stöd", sparat: fullAvgift - avgift };
  }

  const alder = fodelsear ? ar - fodelsear : null;
  if (alder !== null && alder >= 19 && alder <= 23) {
    const nedsattDel = Math.min(manadslonSakrad, 25000) * 12;
    const restDel = Math.max(0, manadslonSakrad - 25000) * 12;
    const avgift = nedsattDel * AGA_UNG + restDel * AGA_FULL;
    return { avgift, sats: avgift / arslon, regel: "Ungdomsnedsättning", sparat: fullAvgift - avgift };
  }

  if (alder !== null && alder >= 67) {
    const avgift = arslon * AGA_PENSION;
    return { avgift, sats: AGA_PENSION, regel: "Endast ålderspensionsavgift", sparat: fullAvgift - avgift };
  }

  return { avgift: fullAvgift, sats: AGA_FULL, regel: null, sparat: 0 };
}

/* Summerar en personallista till lön, avgifter och besparing. */
export function personalkostnad(employees = []) {
  let lon = 0, avgifter = 0, sparat = 0;
  const rader = [];
  employees.forEach((e, i) => {
    // Växa-stöd gäller bara de två första anställda
    const vaxa = e.vaxa && employees.filter((x, j) => x.vaxa && j < i).length < 2;
    const r = arbetsgivaravgift({ manadslon: e.monthly || 0, fodelsear: e.fodelsear, vaxa });
    lon += (e.monthly || 0) * 12;
    avgifter += r.avgift;
    sparat += r.sparat;
    rader.push({ ...e, ...r, vaxaGiltig: vaxa });
  });
  return { lon, avgifter, sparat, total: lon + avgifter, rader };
}

/* Grundavdrag inkomstår 2026. Brytpunkterna är Skatteverkets;
   däremellan interpoleras linjärt, medan den riktiga tabellen
   trappar i steg. Avvikelsen är några hundralappar. */
export function grundavdrag(i) {
  i = Math.max(0, i);
  let g;
  if (i <= 25100) g = i;
  else if (i <= 58900) g = 25100;
  else if (i <= 161000) g = 25100 + ((i - 58900) * (45600 - 25100)) / (161000 - 58900);
  else if (i <= 184900) g = 45600;
  else if (i <= 466000) g = 45600 - ((i - 184900) * (45600 - 17400)) / (466000 - 184900);
  else g = 17400;
  return Math.ceil(g / 100) * 100;   // Skatteverket avrundar uppåt till hela hundratal
}

/* Jobbskatteavdraget sänker skatten på arbetsinkomst i fyra steg
   och trappas av på höga inkomster. Gäller både lön och aktiv
   näringsverksamhet. Approximation — den exakta formeln har fler
   parametrar som ändras varje år. */
export function jobbskatteavdrag(arbetsinkomst, ga, skattesats) {
  const ai = Math.max(0, arbetsinkomst);
  let bas;
  if (ai <= 0.91 * PBB) bas = ai;
  else if (ai <= 3.24 * PBB) bas = 0.91 * PBB + 0.3874 * (ai - 0.91 * PBB);
  else if (ai <= 8.08 * PBB) bas = 1.703 * PBB + 0.1195 * (ai - 3.24 * PBB);
  else bas = 2.28 * PBB;

  let jsa = Math.max(0, bas - ga) * skattesats;
  const avtrappning = 703000;
  if (ai > avtrappning) jsa = Math.max(0, jsa - (ai - avtrappning) * 0.03);
  return jsa;
}

/* Skatt på inkomst av tjänst. Används av båda företagsformerna. */
function tjansteskatt(taxerad, arbetsinkomst, kommunalskatt, avgifter = {}) {
  const rate = kommunalskatt / 100;
  const ga = grundavdrag(taxerad);
  const beskattningsbar = Math.max(0, taxerad - ga);
  const kommunal = beskattningsbar * rate;
  const statlig = Math.max(0, beskattningsbar - SKIKTGRANS) * 0.2;
  const jsa = jobbskatteavdrag(arbetsinkomst, ga, rate);

  /* Begravningsavgiften betalas av alla. Kyrkoavgiften bara av
     medlemmar i Svenska kyrkan. Ingen av dem omfattas av
     jobbskatteavdraget. */
  const begravning = beskattningsbar * ((avgifter.begravning ?? 0.28) / 100);
  const kyrka = avgifter.kyrkomedlem
    ? beskattningsbar * ((avgifter.kyrkoavgift ?? 1.03) / 100)
    : 0;

  return {
    skatt: Math.max(0, kommunal + statlig - jsa) + begravning + kyrka,
    ga, statlig, jsa, beskattningsbar, begravning, kyrka,
  };
}

/* ---------- Enskild firma ---------- */

const ENSKILD = {
  id: "enskild",
  name: "Enskild firma",
  blurb: "Vinsten är din inkomst. Ett skattesteg, inget uttag att beskatta.",
  settings: [
    {
      key: "kommunalskatt", label: "Kommunalskatt", type: "percent", default: 32.0,
      hint: "Varierar mellan cirka 29 % och 35 % beroende på kommun.",
      presets: [["Stockholm", 29.98], ["Göteborg", 32.6], ["Malmö", 32.42], ["Karlstad", 33.65]],
    },
    {
      key: "avgiftslage", label: "Egenavgifter", type: "val", default: "full",
      val: [["full", "Fulla 28,97 %"], ["generell", "Med nedsättning"], ["pension", "Endast ålderspension"]],
      hint: "Fulla egenavgifter är 28,97 %. Den generella nedsättningen är 7,5 procentenheter, högst 15 000 kr per år, och kräver överskott över 40 000 kr. Endast ålderspensionsavgift 10,21 % gäller om du fyllt 67 år vid årets ingång, eller har hel ålders-, sjuk- eller aktivitetsersättning. Kontrollera vad som gäller dig hos Skatteverket.",
    },
    {
      key: "momsregistrerad", label: "Momsregistrerad", type: "toggle", default: true,
      hint: "Är du inte momsregistrerad lägger du ingen moms på dina fakturor — men du får heller inte dra av momsen på dina inköp. Då blir hela inköpspriset din kostnad. Undantaget gäller upp till 120 000 kr i omsättning per år.",
    },
    {
      key: "momsperiod", label: "Redovisar moms", type: "val", default: "helar",
      val: [["helar", "En gång om året"], ["kvartal", "Varje kvartal"], ["manad", "Varje månad"]],
      hint: "Styr när momsdeklarationen ska vara inne. Upp till 1 miljon kr i omsättning får du redovisa en gång om året, mellan 1 och 40 miljoner varje kvartal, däröver varje månad. Du kan alltid välja att redovisa oftare än du måste — kolla vad som står i ditt registreringsbevis.",
    },
    {
      key: "annanInkomst", label: "Annan inkomst av tjänst", type: "number", default: 0, suffix: "kr/år",
      hint: "Lön från anställning, pension eller a-kassa. Företagets inkomst läggs ovanpå den, så den avgör om du hamnar över skiktgränsen — och därmed hela din marginalskatt.",
    },
    {
      key: "pension", label: "Eget pensionssparande", type: "number", default: 0, suffix: "kr/år",
      hint: "Avdragsgillt upp till en andel av inkomsten. Sänker skatten men låser pengarna.",
    },
  ],
  /* Testas mot det faktiska beräkningsresultatet, inte mot överskottet.
     Skiktgränsen mäts på beskattningsbar förvärvsinkomst — alltså efter
     egenavgifter och grundavdrag — inte på vinsten. */
  milestones: [
    {
      key: "statlig", label: "Statlig skatt börjar",
      note: "Skiktgränsen på 643 000 kr mäts på beskattningsbar förvärvsinkomst, alltså efter egenavgifter och grundavdrag. Över den tillkommer 20 % statlig skatt på den överskjutande delen.",
      hit: (r) => r.statlig > 0,
    },
  ],

  compute({ revenue, costs, settings, payroll = 0, payrollAvgifter = null }) {
    // Anställdas löner och arbetsgivaravgifter är kostnader i firman.
    const agaPersonal = payrollAvgifter !== null ? payrollAvgifter : payroll * AGA_FULL;
    const overskott = Math.max(0, revenue - costs - payroll - agaPersonal);
    const pension = Math.min(settings.pension || 0, overskott * 0.35, 10 * PBB);
    const netto = Math.max(0, overskott - pension);

    /* Tre lägen enligt Skatteverket:
       full      — 28,97 %, schablonavdrag 25 %
       generell  — nedsättning 7,5 procentenheter, tak 15 000 kr,
                   kräver överskott över 40 000 kr, aldrig under 10,21 %
       pension   — endast ålderspensionsavgift 10,21 %, schablonavdrag 10 %.
                   Gäller den som fyllt 67 vid årets ingång (från 2026) eller
                   har hel ålders-, sjuk- eller aktivitetsersättning. */
    /* Har du fyllt 67 vid årets ingång gäller endast
       ålderspensionsavgift, oavsett vad som valts manuellt. */
    const alder = settings.fodelsear ? 2026 - settings.fodelsear : null;
    const lage = alder !== null && alder >= 67 ? "pension" : (settings.avgiftslage || "full");
    const schablon = lage === "pension" ? 0.1 : 0.25;
    const underlag = netto * (1 - schablon);

    let egenavgifter;
    if (lage === "pension") {
      egenavgifter = underlag * 0.1021;
    } else {
      egenavgifter = underlag * 0.2897;
      if (lage === "generell" && netto > 40000) {
        const nedsattning = Math.min(underlag * 0.075, 15000);
        egenavgifter = Math.max(underlag * 0.1021, egenavgifter - nedsattning);
      }
    }

    const naringsinkomst = Math.max(0, netto - egenavgifter);
    const annan = Math.max(0, settings.annanInkomst || 0);

    // Företagets inkomst läggs ovanpå eventuell annan tjänsteinkomst.
    // Skatten som hör till företaget är skillnaden mellan att ha det
    // och att inte ha det — alltså den marginella effekten.
    const utan = tjansteskatt(annan, annan, settings.kommunalskatt, settings);
    const med = tjansteskatt(annan + naringsinkomst, annan + naringsinkomst, settings.kommunalskatt, settings);
    const t = { ...med, skatt: Math.max(0, med.skatt - utan.skatt) };
    const kvar = Math.max(0, netto - egenavgifter - t.skatt);

    const lines = [
      { key: "egenavgifter", label: "Egenavgifter", amount: egenavgifter,
        note: lage === "pension" ? "10,21 % ålderspensionsavgift av underlaget"
            : lage === "generell" ? "28,97 % minus generell nedsättning, högst 15 000 kr"
            : "28,97 % av underlaget" },
      { key: "inkomstskatt", label: "Inkomstskatt", amount: t.skatt,
        note: annan > 0
          ? `Ovanpå ${Math.round(annan).toLocaleString("sv-SE")} kr i annan inkomst${med.statlig > 0 ? ", varav en del över skiktgränsen" : ""}`
          : `Kommunal ${settings.kommunalskatt} %${t.statlig > 0 ? " plus statlig 20 %" : ""}, efter jobbskatteavdrag ${Math.round(t.jsa).toLocaleString("sv-SE")} kr` },
    ];
    if (pension > 0) {
      lines.splice(0, 0, { key: "pension", label: "Pensionssparande", amount: pension,
        note: "Ditt, men låst till pensionen" });
    }

    if (payroll > 0) {
      lines.splice(0, 0, { key: "personal", label: "Löner och avgifter", amount: payroll + agaPersonal,
        note: `${Math.round(payroll).toLocaleString("sv-SE")} kr i löner plus 31,42 % i arbetsgivaravgifter` });
    }

    return {
      overskott, kvar, lines, payroll, agaPersonal,
      statlig: med.statlig, tjanstedel: 0,
      owed: egenavgifter + t.skatt + agaPersonal,
      caveat: "Uppskattning för enskild firma, inkomstår 2026. Grundavdraget interpoleras mellan Skatteverkets brytpunkter och jobbskatteavdraget är approximerat. Räntefördelning, periodiseringsfond och expansionsfond ingår inte.",
    };
  },
};

/* ---------- Länder ---------- */

/* ---------- Fakturatyper ----------
   Var kunden finns avgör om moms ska tas ut, och skapar olika
   rapporteringsskyldigheter. Detta är den vanligaste orsaken till
   att en frilansares moms blir fel. */

export const FAKTURATYPER = {
  se: {
    namn: "Sverige", kort: "SE", moms: true,
    text: "Vanlig svensk försäljning. Moms tas ut enligt vald sats.",
  },
  eub2b: {
    namn: "Företag i EU", kort: "EU-företag", moms: false,
    text: "Omvänd betalningsskyldighet. Ingen moms på fakturan, men kundens VAT-nummer måste anges och köparen redovisar momsen i sitt land. Försäljningen ska rapporteras i periodisk sammanställning till Skatteverket.",
    fakturatext: "Omvänd betalningsskyldighet, artikel 196 mervärdesskattedirektivet.",
    kravVatnr: true, periodisk: true,
  },
  eub2c: {
    namn: "Privatperson i EU", kort: "EU-privat", moms: true,
    text: "Digitala tjänster till privatpersoner i EU. Under tröskeln 99 680 kr per år tas svensk moms ut. Över tröskeln ska kundens lands momssats användas och redovisas via One Stop Shop.",
    trosk: 99680,
  },
  export: {
    namn: "Utanför EU", kort: "Export", moms: false,
    text: "Export av tjänst utanför EU. Ingen svensk moms tas ut.",
    fakturatext: "Omsättning utanför EU, ej svensk moms.",
  },
};

export const COUNTRIES = {
  SE: {
    name: "Sverige", currency: "SEK", vatName: "Moms",
    vatRates: [25, 12, 6, 0], defaultVat: 25,
    threshold: 120000,
    thresholdNote: "Momsbefrielse gäller upp till 120 000 kr omsättning exklusive moms. Gränsen höjdes från 80 000 kr den 1 januari 2025. Villkoret gäller även de två föregående beskattningsåren, och momsplikten börjar direkt vid den faktura som passerar gränsen — utan beslut från Skatteverket.",
    taxModule: "live",
    forms: { enskild: ENSKILD },
  },
};

/* Marginalen mäts numeriskt: vad kostar nästa tusenlapp?
   Därför blir den automatiskt rätt vid varje gräns, i båda formerna. */
export function marginalskatt(form, { revenue, costs, settings, payroll = 0, payrollAvgifter = null }) {
  const step = 1000;
  const a = form.compute({ revenue, costs, settings, payroll, payrollAvgifter });
  const b = form.compute({ revenue: revenue + step, costs, settings, payroll, payrollAvgifter });
  const m = ((b.owed - a.owed) / step);
  return Math.min(0.95, Math.max(0, m));
}
