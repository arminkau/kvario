/* ============================================================
   Skattemotor

   All landsspecifik logik ligger här. Komponenterna innehåller
   inte en enda skattesats.

   Kvario räknar bara på enskild firma: vinsten är din inkomst,
   ett enda skattesteg.

   ÅRSVÄRDEN

   Varje sats och gräns som ändras mellan år ligger i AR nedan,
   ett block per inkomstår. Det finns ingen tjänst hos Skatteverket
   att hämta dem ifrån — de bestäms av lagstiftning och publiceras
   som tabeller varje höst — så uppdateringen är manuell. Poängen
   med tabellen är att den blir en enda redigering, och att appen
   kan säga ifrån när ett år saknas i stället för att tyst räkna
   vidare på fjolårets siffror.

   Så här lägger du till ett nytt år:
     1. Kopiera senaste blocket och byt årtal
     2. Uppdatera värdena mot Skatteverkets "Belopp och procent"
     3. Sätt kontrollerad till datumet du stämde av
   ============================================================ */

const AR = {
  2026: {
    kontrollerad: "2026-08-15",

    pbb: 59200,               // prisbasbelopp
    skiktgrans: 643000,       // statlig skatt börjar över denna
    statligSats: 0.20,

    // Egenavgifter
    egenavgift: 0.2897,
    egenavgiftPension: 0.1021,
    schablonavdrag: 0.25,
    schablonavdragPension: 0.10,
    nedsattningPp: 0.075,     // generell nedsättning, procentenheter
    nedsattningTak: 15000,
    nedsattningKrav: 40000,   // krävs överskott över detta

    // Arbetsgivaravgifter
    aga: 0.3142,
    agaPension: 0.1021,
    agaUng: 0.2081,
    agaVaxaTak: 35000,        // per månad
    agaUngTak: 25000,

    /* Räntefördelning. Statslåneräntan den 30 november året före
       styr satsen: positiv fördelning SLR + 6,0 procentenheter,
       negativ SLR + 1,0. SLR 30 nov 2025 var 2,55 %. */
    slr: 0.0255,
    rfPositivPp: 0.06,
    rfNegativPp: 0.01,
    rfGrans: 50000,           // kapitalunderlaget måste passera denna
    kapitalskatt: 0.30,

    // Periodiseringsfond, enskild näringsidkare
    pfAndel: 0.30,            // högst 30 % av resultatet
    pfAterforingAr: 6,

    // Moms
    momsgrans: 120000,        // omsättningsgräns för momsbefrielse
    ossTroskel: 99680,        // digitala tjänster till privatpersoner i EU

    pensionAndel: 0.35,       // eget pensionssparande, andel av överskott
    pensionTakPbb: 10,

    /* Grundavdragets brytpunkter. Skatteverkets tabell trappar i steg;
       här interpoleras linjärt mellan punkterna, vilket avviker med
       några hundralappar. */
    gaBrytpunkter: [
      [25100, 25100],         // upp hit är avdraget hela inkomsten
      [58900, 25100],
      [161000, 45600],
      [184900, 45600],
      [466000, 17400],
    ],
    gaGolv: 17400,

    // Jobbskatteavdrag: avtrappning börjar här, 3 % av överskjutande
    jsaAvtrappning: 703000,
    jsaAvtrappningSats: 0.03,

    begravningsavgift: 0.28,  // procent, betalas av alla
    kyrkoavgift: 1.03,        // procent, bara medlemmar

    /* Slutlig skatt mot inbetald preliminärskatt.

       Är för lite inbetalt löper kostnadsränta på underskottet. Den
       räknas från 13 februari året efter, men bara på det som
       överstiger 30 000 kr — betalar man in mellanskillnaden senast
       den 12 blir det ingen ränta alls. Det datumet är hela poängen
       med att visa siffran i tid.

       Låg ränta är basräntan plus 1,25 procentenheter, och basräntan
       följer statslåneräntan med golv på 1,25 %. */
    rantefriTak: 30000,
    kostnadsrantaLag: 0.0250,
    rantedatumManad: 1,       // februari, nollindexerad
    rantedatumDag: 12,        // sista dagen utan ränta
  },
};

/* Senaste året vi har kontrollerade värden för. */
export const SENASTE_AR = Math.max(...Object.keys(AR).map(Number));

/* Värden för ett inkomstår. Saknas året används det senaste vi har,
   och saknasAr sätts så att gränssnittet kan visa att siffrorna
   inte är avstämda mot det år användaren räknar på. */
export function varden(ar = SENASTE_AR) {
  const finns = AR[ar];
  return { ...(finns || AR[SENASTE_AR]), ar, saknasAr: finns ? null : ar };
}

/* Inga modulkonstanter för satser här. Tidigare låstes pbb och
   skiktgränsen till senaste året, medan funktionerna nedan tog emot
   ett årtal de inte använde. Så länge tabellen bara hade ett år gav
   det rätt svar — men den dag 2027 lades till hade grundavdrag,
   jobbskatteavdrag och statlig skatt tyst räknat vidare på 2026 års
   siffror, utan att något sagt ifrån. */

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

/* Behålls för gränssnittet, som visar satsen som text. Beräkningarna
   nedan läser den ur årstabellen i stället. */
export const AGA_FULL = AR[SENASTE_AR].aga;

export function arbetsgivaravgift({ manadslon, fodelsear, vaxa, ar = SENASTE_AR }) {
  const v = varden(ar);

  // Ogiltig indata ska ge noll, aldrig NaN. Ett NaN här sprider sig
  // genom hela beräkningen och blir svårt att spåra tillbaka hit.
  const lon = Number(manadslon);
  const arslon = Number.isFinite(lon) ? Math.max(0, lon * 12) : 0;
  if (arslon === 0) return { avgift: 0, sats: v.aga, regel: null, sparat: 0 };
  const manadslonSakrad = arslon / 12;

  const fullAvgift = arslon * v.aga;

  /* Samma form på båda nedsättningarna: nedsatt sats upp till ett tak
     per månad, full avgift på det som ligger över. */
  const delad = (tak, nedsattSats) => {
    const nedsattDel = Math.min(manadslonSakrad, tak) * 12;
    const restDel = Math.max(0, manadslonSakrad - tak) * 12;
    return nedsattDel * nedsattSats + restDel * v.aga;
  };

  if (vaxa) {
    const avgift = delad(v.agaVaxaTak, v.agaPension);
    return { avgift, sats: avgift / arslon, regel: "Växa-stöd", sparat: fullAvgift - avgift };
  }

  const alder = fodelsear ? ar - fodelsear : null;
  if (alder !== null && alder >= 19 && alder <= 23) {
    const avgift = delad(v.agaUngTak, v.agaUng);
    return { avgift, sats: avgift / arslon, regel: "Ungdomsnedsättning", sparat: fullAvgift - avgift };
  }

  if (alder !== null && alder >= 67) {
    const avgift = arslon * v.agaPension;
    return { avgift, sats: v.agaPension, regel: "Endast ålderspensionsavgift", sparat: fullAvgift - avgift };
  }

  return { avgift: fullAvgift, sats: v.aga, regel: null, sparat: 0 };
}

/* Summerar en personallista till lön, avgifter och besparing.
   ar skickas vidare: det styr både satserna och åldern, och en
   anställd byter åldersgrupp mellan två inkomstår. */
export function personalkostnad(employees = [], ar = SENASTE_AR) {
  let lon = 0, avgifter = 0, sparat = 0;
  const rader = [];
  employees.forEach((e, i) => {
    // Växa-stöd gäller bara de två första anställda
    const vaxa = e.vaxa && employees.filter((x, j) => x.vaxa && j < i).length < 2;
    const r = arbetsgivaravgift({ manadslon: e.monthly || 0, fodelsear: e.fodelsear, vaxa, ar });
    lon += (e.monthly || 0) * 12;
    avgifter += r.avgift;
    sparat += r.sparat;
    rader.push({ ...e, ...r, vaxaGiltig: vaxa });
  });
  return { lon, avgifter, sparat, total: lon + avgifter, rader };
}

/* Grundavdraget. Brytpunkterna är Skatteverkets och ligger i
   årstabellen; däremellan interpoleras linjärt, medan den riktiga
   tabellen trappar i steg. Avvikelsen är några hundralappar. */
export function grundavdrag(i, ar = SENASTE_AR) {
  const v = varden(ar);
  i = Math.max(0, i);

  const p = v.gaBrytpunkter;
  let g = v.gaGolv;

  if (i <= p[0][0]) {
    g = i;                                   // avdraget är hela inkomsten
  } else {
    for (let n = 1; n < p.length; n++) {
      const [x0, y0] = p[n - 1];
      const [x1, y1] = p[n];
      if (i <= x1) {
        g = x1 === x0 ? y1 : y0 + ((i - x0) * (y1 - y0)) / (x1 - x0);
        break;
      }
    }
  }
  return Math.ceil(g / 100) * 100;   // Skatteverket avrundar uppåt till hela hundratal
}

/* Jobbskatteavdraget sänker skatten på arbetsinkomst i fyra steg
   och trappas av på höga inkomster. Gäller både lön och aktiv
   näringsverksamhet. Approximation — den exakta formeln har fler
   parametrar som ändras varje år. */
export function jobbskatteavdrag(arbetsinkomst, ga, skattesats, ar = SENASTE_AR) {
  const v = varden(ar);
  const pbb = v.pbb;
  const ai = Math.max(0, arbetsinkomst);

  let bas;
  if (ai <= 0.91 * pbb) bas = ai;
  else if (ai <= 3.24 * pbb) bas = 0.91 * pbb + 0.3874 * (ai - 0.91 * pbb);
  else if (ai <= 8.08 * pbb) bas = 1.703 * pbb + 0.1195 * (ai - 3.24 * pbb);
  else bas = 2.28 * pbb;

  let jsa = Math.max(0, bas - ga) * skattesats;
  if (ai > v.jsaAvtrappning) {
    jsa = Math.max(0, jsa - (ai - v.jsaAvtrappning) * v.jsaAvtrappningSats);
  }
  return jsa;
}

/* Skatt på inkomst av tjänst. Används av båda företagsformerna. */
function tjansteskatt(taxerad, arbetsinkomst, kommunalskatt, avgifter = {}, ar = SENASTE_AR) {
  const v = varden(ar);
  const rate = kommunalskatt / 100;
  const ga = grundavdrag(taxerad, ar);
  const beskattningsbar = Math.max(0, taxerad - ga);
  const kommunal = beskattningsbar * rate;
  const statlig = Math.max(0, beskattningsbar - v.skiktgrans) * v.statligSats;
  const jsa = jobbskatteavdrag(arbetsinkomst, ga, rate, ar);

  /* Begravningsavgiften betalas av alla. Kyrkoavgiften bara av
     medlemmar i Svenska kyrkan. Ingen av dem omfattas av
     jobbskatteavdraget. */
  const begravning = beskattningsbar * ((avgifter.begravning ?? v.begravningsavgift) / 100);
  const kyrka = avgifter.kyrkomedlem
    ? beskattningsbar * ((avgifter.kyrkoavgift ?? v.kyrkoavgift) / 100)
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
      /* Den som inte är momsregistrerad lämnar ingen momsdeklaration, och
         då finns ingen period att välja. Valet ligger kvar i inställningarna
         och tas fram igen vid registrering — annars hade den som råkat
         kryssa fel fått börja om. */
      visas: (s) => s.momsregistrerad !== false,
    },
    {
      key: "annanInkomst", label: "Annan inkomst av tjänst", type: "number", default: 0, suffix: "kr/år",
      hint: "Lön från anställning, pension eller a-kassa. Företagets inkomst läggs ovanpå den, så den avgör om du hamnar över skiktgränsen — och därmed hela din marginalskatt.",
    },
    {
      key: "pension", label: "Eget pensionssparande", type: "number", default: 0, suffix: "kr/år",
      hint: "Avdragsgillt upp till en andel av inkomsten. Sänker skatten men låser pengarna.",
    },
    {
      key: "kapitalunderlag", label: "Kapitalunderlag", type: "number", default: 0, suffix: "kr",
      hint: "Ditt egna kapital i firman vid årets ingång: tillgångar minus skulder. Överstiger det 50 000 kr får du göra positiv räntefördelning — en del av vinsten flyttas då till inkomst av kapital och beskattas med 30 % i stället för din marginalskatt. Är det oklart står siffran i förra årets NE-bilaga, ruta B10. Lämna 0 om du är osäker.",
    },
    {
      key: "periodiseringsfond", label: "Avsätt till periodiseringsfond", type: "number", default: 0, suffix: "kr/år",
      hint: "Du får skjuta upp skatten på högst 30 % av vinsten i upp till sex år. Pengarna stannar i firman och beskattas när fonden återförs — bra ett bra år, dyrt om ett sämre år aldrig kommer. Till skillnad från aktiebolag betalar enskild firma ingen schablonränta på avsättningen.",
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

  compute({ revenue, costs, settings, payroll = 0, payrollAvgifter = null, ar }) {
    const v = varden(ar);

    // Anställdas löner och arbetsgivaravgifter är kostnader i firman.
    const agaPersonal = payrollAvgifter !== null ? payrollAvgifter : payroll * v.aga;
    const overskott = Math.max(0, revenue - costs - payroll - agaPersonal);
    const pension = Math.min(settings.pension || 0, overskott * v.pensionAndel, v.pensionTakPbb * v.pbb);
    const efterPension = Math.max(0, overskott - pension);

    /* ---------- Räntefördelning ----------
       Har du eget kapital i firman får en tänkt avkastning på det
       flyttas från näringsverksamhet till inkomst av kapital, där
       skatten är 30 % i stället för din marginalskatt. För den som
       ligger över skiktgränsen är skillnaden stor.

       Satsen är statslåneräntan den 30 november året före plus 6,0
       procentenheter. Kapitalunderlaget måste passera 50 000 kr —
       under den gränsen finns ingen fördelning att göra. */
    const kapitalunderlag = Math.max(0, settings.kapitalunderlag || 0);
    const rfSats = v.slr + v.rfPositivPp;
    const rfMojlig = kapitalunderlag > v.rfGrans ? kapitalunderlag * rfSats : 0;
    // Får aldrig överstiga resultatet — man kan inte fördela mer än
    // vad verksamheten gett.
    const rantefordelning = Math.min(rfMojlig, efterPension);
    const rfSkatt = rantefordelning * v.kapitalskatt;
    const efterRf = Math.max(0, efterPension - rantefordelning);

    /* ---------- Periodiseringsfond ----------
       Högst 30 % av resultatet får skjutas upp i sex år. Pengarna
       stannar i firman, obeskattade tills fonden återförs. Enskild
       näringsidkare betalar ingen schablonränta på avsättningen —
       det gäller bara juridiska personer. */
    const pfTak = efterRf * v.pfAndel;
    const periodiseringsfond = Math.min(Math.max(0, settings.periodiseringsfond || 0), pfTak);
    const netto = Math.max(0, efterRf - periodiseringsfond);

    /* Tre lägen enligt Skatteverket:
       full      — 28,97 %, schablonavdrag 25 %
       generell  — nedsättning 7,5 procentenheter, tak 15 000 kr,
                   kräver överskott över 40 000 kr, aldrig under 10,21 %
       pension   — endast ålderspensionsavgift 10,21 %, schablonavdrag 10 %.
                   Gäller den som fyllt 67 vid årets ingång (från 2026) eller
                   har hel ålders-, sjuk- eller aktivitetsersättning. */
    /* Har du fyllt 67 vid årets ingång gäller endast
       ålderspensionsavgift, oavsett vad som valts manuellt. */
    const alder = settings.fodelsear ? v.ar - settings.fodelsear : null;
    const lage = alder !== null && alder >= 67 ? "pension" : (settings.avgiftslage || "full");
    const schablon = lage === "pension" ? v.schablonavdragPension : v.schablonavdrag;
    const underlag = netto * (1 - schablon);

    let egenavgifter;
    if (lage === "pension") {
      egenavgifter = underlag * v.egenavgiftPension;
    } else {
      egenavgifter = underlag * v.egenavgift;
      if (lage === "generell" && netto > v.nedsattningKrav) {
        const nedsattning = Math.min(underlag * v.nedsattningPp, v.nedsattningTak);
        egenavgifter = Math.max(underlag * v.egenavgiftPension, egenavgifter - nedsattning);
      }
    }

    const naringsinkomst = Math.max(0, netto - egenavgifter);
    const annan = Math.max(0, settings.annanInkomst || 0);

    // Företagets inkomst läggs ovanpå eventuell annan tjänsteinkomst.
    // Skatten som hör till företaget är skillnaden mellan att ha det
    // och att inte ha det — alltså den marginella effekten.
    const utan = tjansteskatt(annan, annan, settings.kommunalskatt, settings, v.ar);
    const med = tjansteskatt(annan + naringsinkomst, annan + naringsinkomst, settings.kommunalskatt, settings, v.ar);
    const t = { ...med, skatt: Math.max(0, med.skatt - utan.skatt) };

    /* Restposten: vad som blir över av näringsdelen, plus den
       räntefördelade delen efter kapitalskatt. Periodiseringsfonden
       räknas inte in — de pengarna ligger kvar i firman. */
    const kvar = Math.max(0, netto - egenavgifter - t.skatt) + (rantefordelning - rfSkatt);

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

    if (rantefordelning > 0) {
      lines.splice(0, 0, { key: "kapitalskatt", label: "Skatt på räntefördelning", amount: rfSkatt,
        note: `30 % på ${Math.round(rantefordelning).toLocaleString("sv-SE")} kr som flyttats till kapital` });
    }
    if (periodiseringsfond > 0) {
      lines.splice(0, 0, { key: "periodiseringsfond", label: "Periodiseringsfond", amount: periodiseringsfond,
        note: `Kvar i firman, beskattas senast om ${v.pfAterforingAr} år` });
    }
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
      /* Mellanstegen fram till det som faktiskt deklareras. Resultat-
         rapporten visar dem rad för rad och ska inte räkna om dem
         själv — två uppställningar av samma kedja hade förr eller
         senare börjat säga olika saker. */
      pension, netto, schablon, egenavgifter, naringsinkomst,
      inkomstskatt: t.skatt,
      rantefordelning, rfSkatt, rfSats, rfMojlig, kapitalunderlag,
      periodiseringsfond, pfTak,
      ar: v.ar, saknasAr: v.saknasAr, kontrollerad: v.kontrollerad,
      owed: egenavgifter + t.skatt + agaPersonal + rfSkatt,
      caveat: `Uppskattning för enskild firma, inkomstår ${v.ar}. Grundavdraget interpoleras mellan Skatteverkets brytpunkter och jobbskatteavdraget är approximerat. Expansionsfond och sparade underskott ingår inte.`,
    };
  },
};

/* ---------- Preliminärskatt ----------
   Enskild firma betalar debiterad preliminärskatt varje månad. Beloppet
   sattes av Skatteverket utifrån förra årets deklaration, och nästan
   ingen ändrar det.

   Går det bättre än i fjol växer en kvarskatt som inte syns förrän i
   maj året därpå. Går det sämre lånar man ut pengar till staten
   räntefritt i ett år. Båda går att rätta med en preliminär
   inkomstdeklaration — men bara om man vet om det i tid.

   manadsbelopp är vad som faktiskt dras varje månad.
   slutligSkatt är vad beräkningen landar på, alltså owed. */
export function preliminarskatt({ manadsbelopp, slutligSkatt, ar = SENASTE_AR, nu = new Date() }) {
  const v = varden(ar);
  const perManad = Math.max(0, Number(manadsbelopp) || 0);
  const inbetalt = perManad * 12;
  const slutlig = Math.max(0, Number(slutligSkatt) || 0);

  // Positivt = för lite inbetalt (kvarskatt), negativt = för mycket.
  const differens = slutlig - inbetalt;
  const borde = slutlig / 12;

  /* Räntan löper på den del som passerar det räntefria taket, från
     dagen efter sista betalningsdag. Vi visar årsräntan på det
     överskjutande — den exakta räntan beror på när pengarna kommer in,
     och att räkna dagar här skulle ge en falsk precision. */
  const overTaket = Math.max(0, differens - v.rantefriTak);
  const ranta = overTaket * v.kostnadsrantaLag;

  // Sista dagen utan ränta ligger året efter inkomståret.
  const rantefriTill = new Date(v.ar + 1, v.rantedatumManad, v.rantedatumDag);
  const dagarKvar = Math.ceil((rantefriTill - nu) / 86400000);

  return {
    perManad, inbetalt, slutlig, differens, borde,
    // Vad månadsbeloppet borde ändras till, avrundat uppåt till hundra.
    forslag: Math.ceil(borde / 100) * 100,
    overTaket, ranta,
    rantefriTill, dagarKvar,
    rantefriTak: v.rantefriTak,
    // För lite inbetalt och nog stor differens för att räntan ska bita.
    varning: differens > v.rantefriTak,
    ar: v.ar,
  };
}

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
   Därför blir den automatiskt rätt vid varje gräns.

   ar måste skickas med samma värde som huvudberäkningen. Annars kan
   marginalen räknas med ett annat års satser än siffrorna den står
   bredvid — en skillnad som är svår att upptäcka just för att båda
   ser rimliga ut. */
export function marginalskatt(form, { revenue, costs, settings, payroll = 0, payrollAvgifter = null, ar }) {
  const step = 1000;
  const a = form.compute({ revenue, costs, settings, payroll, payrollAvgifter, ar });
  const b = form.compute({ revenue: revenue + step, costs, settings, payroll, payrollAvgifter, ar });
  const m = ((b.owed - a.owed) / step);
  return Math.min(0.95, Math.max(0, m));
}
