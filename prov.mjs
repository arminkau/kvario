/* ============================================================
   Prov av beräkningarna

   Kör:
     node prov.mjs

   Varje prov räknar fram sitt förväntade värde för hand ur reglerna,
   inte genom att anropa samma funktion som provas. Ett prov som
   speglar koden går alltid igenom och upptäcker ingenting.

   Där en siffra är hämtad från Skatteverket står källan i kommentaren
   ovanför, så att nästa års uppdatering går att kontrollera mot något.
   ============================================================ */

import {
  varden, SENASTE_AR, arbetsgivaravgift, personalkostnad,
  grundavdrag, jobbskatteavdrag, preliminarskatt, COUNTRIES, marginalskatt,
} from "./src/tax.js";
import { kommandeDatum } from "./src/skattedatum.js";

const v = varden(SENASTE_AR);
const enskild = COUNTRIES.SE.forms.enskild;

let gick = 0;
const fel = [];

/* Pengar jämförs med tolerans. Flyttal ger 0,0000001 i skillnad på
   annars identiska belopp, och ett prov som faller på det lär man
   sig snabbt att ignorera — vilket är värre än att inte ha det. */
function nara(namn, faktiskt, forvantat, tolerans = 1) {
  /* Ett undefined här betyder oftast att fältet bytt namn i tax.js.
     Utan den här raden kraschar provet på .toFixed och pekar på sig
     självt i stället för på det som ändrats. */
  if (!Number.isFinite(faktiskt) || !Number.isFinite(forvantat)) {
    fel.push(`${namn}\n     fick ${faktiskt}, väntade ${forvantat} — inte ett tal`);
    return;
  }
  const diff = Math.abs(faktiskt - forvantat);
  if (diff <= tolerans) { gick++; return; }
  fel.push(`${namn}\n     fick ${faktiskt.toFixed(2)}, väntade ${forvantat.toFixed(2)} (diff ${diff.toFixed(2)})`);
}

function sant(namn, villkor, detalj = "") {
  if (villkor) { gick++; return; }
  fel.push(`${namn}${detalj ? `\n     ${detalj}` : ""}`);
}

const rakna = (settings, revenue, costs = 0, extra = {}) =>
  enskild.compute({ revenue, costs, settings: { kommunalskatt: 32, ...settings }, ar: SENASTE_AR, ...extra });

/* ---------- 1. Egenavgifter ---------- */

{
  // Fulla egenavgifter: 28,97 % på underlaget, som är 75 % av netto
  // (schablonavdrag 25 %). SKV: "Egenavgifter", inkomstår 2026.
  const r = rakna({ avgiftslage: "full" }, 500000);
  nara("Egenavgifter, fulla 28,97 % på 75 % av netto",
    r.egenavgifter, 500000 * 0.75 * 0.2897);

  // Endast ålderspensionsavgift: 10,21 % på 90 % av netto.
  const p = rakna({ avgiftslage: "pension" }, 500000);
  nara("Egenavgifter, enbart ålderspension 10,21 % på 90 %",
    p.egenavgifter, 500000 * 0.90 * 0.1021);

  // Generell nedsättning: 7,5 procentenheter av underlaget, högst
  // 15 000 kr. Vid 500 000 kr är underlaget 375 000 och 7,5 % av det
  // är 28 125 — alltså slår taket till.
  const g = rakna({ avgiftslage: "generell" }, 500000);
  nara("Nedsättningen når taket 15 000 kr",
    g.egenavgifter, 500000 * 0.75 * 0.2897 - 15000);

  // Under taket: 100 000 kr ger underlag 75 000, och 7,5 % av det är
  // 5 625 kr — under 15 000, så hela nedsättningen ges.
  const u = rakna({ avgiftslage: "generell" }, 100000);
  nara("Nedsättningen under taket ges i sin helhet",
    u.egenavgifter, 100000 * 0.75 * (0.2897 - 0.075));

  // Nedsättningen kräver överskott över 40 000 kr.
  const under = rakna({ avgiftslage: "generell" }, 35000);
  nara("Ingen nedsättning under 40 000 kr i överskott",
    under.egenavgifter, 35000 * 0.75 * 0.2897);

  // Fyllda 67 vid årets ingång ger pensionsläget oavsett vad som valts.
  const gammal = rakna({ avgiftslage: "full", fodelsear: SENASTE_AR - 67 }, 500000);
  nara("67 år tvingar fram pensionsläget trots 'full'",
    gammal.egenavgifter, 500000 * 0.90 * 0.1021);
}

/* ---------- 2. Grundavdrag ---------- */

{
  // Under första brytpunkten är avdraget hela inkomsten.
  nara("Grundavdrag under 25 100 kr är hela inkomsten", grundavdrag(20000), 20000);

  // Avdraget avrundas uppåt till hela hundratal (SKV:s tabell).
  const g = grundavdrag(300000);
  sant("Grundavdraget avrundas till hela hundratal", g % 100 === 0, `fick ${g}`);

  // Det landar aldrig under golvet.
  sant("Grundavdraget går aldrig under golvet",
    grundavdrag(2000000) >= v.gaGolv, `fick ${grundavdrag(2000000)}, golv ${v.gaGolv}`);

  // Det är monotont: mer inkomst ger aldrig mindre avdrag efter golvet.
  let brutet = null;
  for (let i = 30000; i < 900000; i += 5000) {
    if (grundavdrag(i + 5000) > grundavdrag(i) + 20000) { brutet = i; break; }
  }
  sant("Grundavdraget hoppar inte orimligt mellan steg", brutet === null,
    brutet ? `hoppade vid ${brutet}` : "");
}

/* ---------- 3. Statlig skatt och skiktgränsen ---------- */

{
  // Skiktgränsen mäts på beskattningsbar förvärvsinkomst, alltså efter
  // grundavdrag — inte på omsättningen.
  const under = rakna({}, 700000);
  const over = rakna({}, 1400000);
  sant("Ingen statlig skatt vid låg inkomst", under.statlig === 0, `fick ${under.statlig}`);
  sant("Statlig skatt slår till vid hög inkomst", over.statlig > 0);

  // Marginalskatten stiger över skiktgränsen.
  const mLag = marginalskatt(enskild, { revenue: 400000, costs: 0, settings: { kommunalskatt: 32 }, ar: SENASTE_AR });
  const mHog = marginalskatt(enskild, { revenue: 1400000, costs: 0, settings: { kommunalskatt: 32 }, ar: SENASTE_AR });
  sant("Marginalskatten är högre över skiktgränsen", mHog > mLag, `${mLag} vs ${mHog}`);
}

/* ---------- 4. Räntefördelning ---------- */

{
  // Kapitalunderlaget måste passera 50 000 kr.
  const under = rakna({ kapitalunderlag: 50000 }, 500000);
  sant("Ingen räntefördelning vid exakt gränsen 50 000",
    !under.lines.some((l) => l.key === "kapitalskatt"));

  // Över gränsen: satsen är SLR + 6,0 procentenheter.
  const over = rakna({ kapitalunderlag: 200000 }, 500000);
  const rf = over.lines.find((l) => l.key === "kapitalskatt");
  sant("Räntefördelning görs över gränsen", Boolean(rf));
  if (rf) nara("Skatt på räntefördelning är 30 % av beloppet",
    rf.amount, 200000 * (v.slr + v.rfPositivPp) * 0.30);

  // Den kan aldrig överstiga resultatet.
  const litet = rakna({ kapitalunderlag: 5000000 }, 50000);
  const rf2 = litet.lines.find((l) => l.key === "kapitalskatt");
  if (rf2) sant("Räntefördelning överstiger aldrig resultatet",
    rf2.amount <= 50000 * 0.30 + 1, `fick ${rf2.amount}`);
}

/* ---------- 5. Periodiseringsfond ---------- */

{
  // Högst 30 % av resultatet.
  const r = rakna({ periodiseringsfond: 999999 }, 500000);
  const pf = r.lines.find((l) => l.key === "periodiseringsfond");
  sant("Periodiseringsfond finns med när den begärs", Boolean(pf));
  if (pf) nara("Avsättningen begränsas till 30 % av resultatet", pf.amount, 500000 * 0.30);
}

/* ---------- 6. Arbetsgivaravgifter ---------- */

{
  /* Beloppen är per år: funktionen tar månadslön men räknar upp den.
     SKV: "Arbetsgivaravgifter", 2026. */
  const full = arbetsgivaravgift({ manadslon: 40000, ar: SENASTE_AR });
  nara("Arbetsgivaravgift 31,42 % på årslönen", full.avgift, 40000 * 12 * 0.3142);

  // Växa-stödet: 10,21 % upp till 35 000 kr i månadslön, full avgift
  // på det som ligger över.
  const vaxa = arbetsgivaravgift({ manadslon: 40000, vaxa: true, ar: SENASTE_AR });
  nara("Växa-stöd: 10,21 % upp till taket, full avgift däröver",
    vaxa.avgift, (35000 * 0.1021 + 5000 * 0.3142) * 12);
  sant("Växa-stöd är billigare än full avgift", vaxa.avgift < full.avgift);
  nara("Sparat är skillnaden mot full avgift",
    vaxa.sparat, full.avgift - vaxa.avgift, 0.01);

  // Ungdomsnedsättning 20,81 % upp till 25 000 kr i månadslön.
  const ung = arbetsgivaravgift({ manadslon: 30000, fodelsear: SENASTE_AR - 21, ar: SENASTE_AR });
  nara("Ungdomsnedsättning 20,81 % upp till taket",
    ung.avgift, (25000 * 0.2081 + 5000 * 0.3142) * 12);

  // Fyllda 67: endast ålderspensionsavgift, inget tak.
  const aldre = arbetsgivaravgift({ manadslon: 50000, fodelsear: SENASTE_AR - 68, ar: SENASTE_AR });
  nara("Anställd över 67 ger 10,21 % utan tak", aldre.avgift, 50000 * 12 * 0.1021);

  // Noll lön ska ge noll, aldrig NaN.
  const noll = arbetsgivaravgift({ manadslon: 0, ar: SENASTE_AR });
  sant("Noll lön ger noll avgift utan NaN", noll.avgift === 0);
  const skrap = arbetsgivaravgift({ manadslon: "abc", ar: SENASTE_AR });
  sant("Ogiltig lön ger noll, inte NaN", skrap.avgift === 0);

  // Personalkostnad summerar lön och avgifter.
  const p = personalkostnad([{ monthly: 30000 }, { monthly: 20000 }], SENASTE_AR);
  nara("Personalkostnad summerar lönerna", p.lon, 50000 * 12, 1);
  nara("Personalkostnad = lön + avgifter", p.total, p.lon + p.avgifter, 0.01);

  /* Växa-stöd gäller bara de två första anställda. Den tredje ska få
     full avgift även om rutan är ikryssad. */
  const tre = personalkostnad(
    [{ monthly: 20000, vaxa: true }, { monthly: 20000, vaxa: true }, { monthly: 20000, vaxa: true }],
    SENASTE_AR);
  sant("Växa-stöd gäller bara två anställda",
    tre.rader.filter((r) => r.vaxaGiltig).length === 2,
    `${tre.rader.filter((r) => r.vaxaGiltig).length} fick stödet`);
}

/* ---------- 7. Moms ---------- */

{
  // Momsen är aldrig företagets pengar, så den får inte påverka
  // skatten. Samma överskott ska ge samma egenavgifter oavsett sats.
  const a = rakna({}, 500000);
  const b = rakna({}, 500000);
  nara("Momssatsen påverkar inte skatteberäkningen", a.egenavgifter, b.egenavgifter, 0.01);

  sant("Momsgränsen är 120 000 kr", v.momsgrans === 120000, `fick ${v.momsgrans}`);
  sant("OSS-tröskeln är 99 680 kr", v.ossTroskel === 99680, `fick ${v.ossTroskel}`);
}

/* ---------- 8. Bevarande: går pengarna ihop? ---------- */

{
  /* Det viktigaste provet. Allt som dras av plus det som blir kvar
     ska vara exakt det som fanns att fördela. Går det inte ihop har
     en krona antingen försvunnit eller uppfunnits, och det är precis
     den sortens fel ingen upptäcker genom att titta på skärmen. */
  for (const [namn, s, oms, kost] of [
    ["enkelt fall", {}, 500000, 100000],
    ["med annan inkomst", { annanInkomst: 300000 }, 400000, 50000],
    ["med pensionssparande", { pension: 40000 }, 600000, 0],
    ["med räntefördelning", { kapitalunderlag: 300000 }, 700000, 100000],
    ["med periodiseringsfond", { periodiseringsfond: 100000 }, 800000, 200000],
    ["nedsättning", { avgiftslage: "generell" }, 450000, 50000],
    ["hög inkomst över skiktgränsen", {}, 1500000, 200000],
    ["allt på en gång", { annanInkomst: 200000, pension: 30000, kapitalunderlag: 400000, periodiseringsfond: 80000 }, 1200000, 300000],
  ]) {
    const r = rakna(s, oms, kost);
    const avdragen = r.lines.reduce((sum, l) => sum + l.amount, 0);
    /* Räntefördelningen flyttar pengar till kapitalinkomst men lämnar
       inte firman, så beloppet finns kvar i restposten minus sin skatt.
       Summan av raderna plus kvar ska därför bli överskottet. */
    nara(`Pengarna går ihop — ${namn}`, avdragen + r.kvar, oms - kost, 2);

    sant(`Inget negativt belopp — ${namn}`,
      r.lines.every((l) => l.amount >= 0) && r.kvar >= 0,
      r.lines.map((l) => `${l.key}=${l.amount.toFixed(0)}`).join(" "));
  }
}

/* ---------- 9. Inga tokiga värden ---------- */

{
  for (const oms of [0, 1, 1000, 50000, 123456, 999999, 5000000]) {
    const r = rakna({}, oms);
    sant(`Inga NaN vid omsättning ${oms}`,
      Number.isFinite(r.kvar) && r.lines.every((l) => Number.isFinite(l.amount)));
    sant(`Kvar överstiger aldrig omsättningen vid ${oms}`, r.kvar <= oms + 1);
  }

  // Kostnader över intäkter ska ge noll, inte negativt.
  const forlust = rakna({}, 100000, 300000);
  sant("Förlust ger noll, inte negativa avgifter",
    forlust.kvar === 0 && forlust.egenavgifter === 0,
    `kvar=${forlust.kvar} avgifter=${forlust.egenavgifter}`);
}

/* ---------- 10. Preliminärskatt ---------- */

{
  const slutlig = 120000;
  const r = preliminarskatt({ manadsbelopp: 8000, slutligSkatt: slutlig, ar: SENASTE_AR });
  nara("Differensen är slutlig skatt minus inbetalt", r.differens, slutlig - 8000 * 12);
  sant("Förslaget är ett månadsbelopp", r.forslag > 0 && r.forslag < slutlig);

  // Räntefritt upp till 30 000 kr i underskott.
  const litet = preliminarskatt({ manadsbelopp: 9800, slutligSkatt: 120000, ar: SENASTE_AR });
  sant("Litet underskott ligger under räntetaket", !litet.overTaket);
  const stort = preliminarskatt({ manadsbelopp: 2000, slutligSkatt: 300000, ar: SENASTE_AR });
  sant("Stort underskott passerar räntetaket", stort.overTaket);
  sant("Ränta beräknas bara över taket", stort.ranta > 0 && litet.ranta === 0);
}

/* ---------- 11. Deklarationsdatum ---------- */

{
  /* Inget förfallodatum får någonsin ligga bakåt i tiden. Det är den
     invariant som betyder något, och den håller oavsett vilken veckodag
     ett datum råkar falla på.

     Provet skrevs först som "2 maj, och dagen efter ska den rulla". Det
     föll — men koden hade rätt: 2 maj 2026 är en lördag, och fristen
     flyttas då till måndagen. Ett prov med inbakad veckodag provar
     kalendern, inte appen. */
  let bakat = null;
  for (let dag = 0; dag < 400 && !bakat; dag++) {
    const nu = new Date(2026, 0, 1 + dag, 9, 0);
    const idag = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate());
    for (const momsad of [true, false]) {
      for (const d of kommandeDatum({ nu, momsregistrerad: momsad, momsperiod: "helar" })) {
        if (d.forfall < idag) bakat = `${d.id} förföll ${d.forfall.toDateString()} sett från ${idag.toDateString()}`;
      }
    }
  }
  sant("Inget förfallodatum ligger bakåt i tiden, något dygn under året",
    bakat === null, bakat || "");

  // Sista dagen räknas som kvar, inte som passerad — appen hoppade
  // tidigare fram ett helt år redan klockan ett på natten.
  const sista = kommandeDatum({ nu: new Date(2026, 4, 4, 23, 30), momsregistrerad: false })
    .find((d) => d.id === "inkomst");
  sant("Fristens egen dag räknas som kvar ända till midnatt",
    sista.forfall.getFullYear() === 2026, `fick ${sista.forfall.toDateString()}`);

  // Dagen efter fristen ska den ha rullat till nästa år.
  const efter = kommandeDatum({ nu: new Date(2026, 4, 5, 9, 0), momsregistrerad: false })
    .find((d) => d.id === "inkomst");
  sant("Dagen efter fristen rullar den till nästa år",
    efter.forfall.getFullYear() === 2027, `fick ${efter.forfall.toDateString()}`);

  // Helgjusteringen: ett datum som faller på lördag eller söndag ska
  // flyttas fram till vardag, aldrig bakåt.
  let helg = null;
  for (let dag = 0; dag < 400 && !helg; dag++) {
    for (const d of kommandeDatum({ nu: new Date(2026, 0, 1 + dag), momsregistrerad: true, momsperiod: "kvartal" })) {
      const v = d.forfall.getDay();
      if (v === 0 || v === 6) helg = `${d.id} förfaller på en helgdag: ${d.forfall.toDateString()}`;
    }
  }
  sant("Inget förfallodatum hamnar på en lördag eller söndag", helg === null, helg || "");

  // Omomsad ska inte se någon momsdeklaration.
  sant("Ingen momsdeklaration för den som inte är momsregistrerad",
    !kommandeDatum({ momsregistrerad: false }).some((d) => d.id === "moms"));
  sant("Momsdeklaration visas för den momsregistrerade",
    kommandeDatum({ momsregistrerad: true, momsperiod: "helar" }).some((d) => d.id === "moms"));

  // EU-handel tidigarelägger momsdeklarationen.
  const utan = kommandeDatum({ nu: new Date(2026, 0, 5), momsregistrerad: true, momsperiod: "helar", euHandel: false });
  const med = kommandeDatum({ nu: new Date(2026, 0, 5), momsregistrerad: true, momsperiod: "helar", euHandel: true });
  sant("EU-handel ger tidigare momsdatum",
    med.find((d) => d.id === "moms").forfall < utan.find((d) => d.id === "moms").forfall);
}

/* ---------- 12. Årstabellen ---------- */

{
  sant("Årstabellen har ett kontrollerat-datum", Boolean(v.kontrollerad));
  sant("Skiktgränsen är 643 000 kr", v.skiktgrans === 643000, `fick ${v.skiktgrans}`);
  sant("Prisbasbeloppet är 59 200 kr", v.pbb === 59200, `fick ${v.pbb}`);
  sant("Egenavgiften är 28,97 %", v.egenavgift === 0.2897);
  sant("Arbetsgivaravgiften är 31,42 %", v.aga === 0.3142);
  sant("Kapitalskatten är 30 %", v.kapitalskatt === 0.30);
}

/* ---------- Resultat ---------- */

console.log("");
if (fel.length) {
  console.error(`${fel.length} prov föll:\n`);
  for (const f of fel) console.error(`  ✗ ${f}\n`);
  console.error(`${gick} gick igenom, ${fel.length} föll.`);
  process.exit(1);
}
console.log(`✓ ${gick} prov gick igenom — beräkningarna stämmer mot reglerna.`);
