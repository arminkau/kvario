/* ============================================================
   Deklarationsdatum

   Tidigare visade appen ett enda datum och påstod att inkomst-
   och momsdeklaration lämnas samtidigt. Det stämmer inte:

     Inkomstdeklaration        2 maj året efter
     Moms helår, utan EU-handel   12 maj året efter
     Moms helår, med EU-handel    26 februari året efter
     Moms kvartal              12:e i andra månaden efter periodens slut
     Moms månad                12:e i andra månaden efter periodens slut
     Periodisk sammanställning 25:e månaden efter (e-tjänst)

   EU-handel tidigarelägger momsdeklarationen med två och en halv
   månad. Det är skillnaden mellan att hinna och att missa, och
   appen vet redan om du sålt till företag i EU.

   Faller ett datum på lördag eller söndag flyttas det till
   nästkommande vardag. Röda dagar hanteras inte — de kan flytta
   datumet ytterligare en dag, så behandla datumen som "senast
   ungefär här" och stäm av mot Skatteverket.

   Källa: skatteverket.se, "När ska jag deklarera moms".
   ============================================================ */

/* Lördag och söndag skjuts fram till måndag. */
function vardag(d) {
  const dag = d.getDay();
  if (dag === 6) d.setDate(d.getDate() + 2);
  else if (dag === 0) d.setDate(d.getDate() + 1);
  return d;
}

const datum = (ar, manad, dag) => vardag(new Date(ar, manad, dag));

export const MOMSPERIODER = [
  ["helar", "En gång om året", "Omsättning upp till 1 miljon kr"],
  ["kvartal", "Varje kvartal", "Omsättning 1–40 miljoner kr"],
  ["manad", "Varje månad", "Omsättning över 40 miljoner kr"],
];

/* Momsperiodens slut och deklarationsdag för den period som
   ligger närmast i tiden efter "nu". */
function nastaMomsperiod(nu, period) {
  const ar = nu.getFullYear();
  const kandidater = [];

  if (period === "kvartal") {
    // Kvartalen deklareras den 12:e i andra månaden efter slutet:
    // jan–mar → 12 maj, apr–jun → 12 aug, jul–sep → 12 nov,
    // okt–dec → 12 februari året efter.
    for (const [startAr, kvartal] of [[ar - 1, 3], [ar, 0], [ar, 1], [ar, 2], [ar, 3], [ar + 1, 0]]) {
      const slutManad = kvartal * 3 + 2;
      const forfall = datum(startAr + (kvartal === 3 ? 1 : 0), (slutManad + 2) % 12, 12);
      kandidater.push({ forfall, etikett: `Kvartal ${kvartal + 1} ${startAr}` });
    }
  } else if (period === "manad") {
    for (let i = -2; i <= 3; i++) {
      const m = new Date(ar, nu.getMonth() + i, 1);
      const forfall = datum(m.getFullYear(), m.getMonth() + 2, 12);
      kandidater.push({
        forfall,
        etikett: m.toLocaleDateString("sv-SE", { month: "long", year: "numeric" }),
      });
    }
  }

  return kandidater
    .filter((k) => k.forfall > nu)
    .sort((a, b) => a.forfall - b.forfall)[0] || null;
}

/* Returnerar kommande datum, närmast först.
   momsregistrerad, momsperiod och euHandel styr vilka som gäller. */
export function kommandeDatum({
  nu = new Date(),
  momsregistrerad = true,
  momsperiod = "helar",
  euHandel = false,
} = {}) {
  const lista = [];

  /* ---- Inkomstdeklaration: 2 maj året efter inkomståret ---- */
  const ar = nu.getFullYear();
  let deklDatum = datum(ar, 4, 2);
  let inkomstar = ar - 1;
  if (nu > deklDatum) {
    deklDatum = datum(ar + 1, 4, 2);
    inkomstar = ar;
  }
  lista.push({
    id: "inkomst",
    rubrik: "Inkomstdeklaration",
    detalj: `Inkomstår ${inkomstar}, med NE-bilagan för firman`,
    forfall: deklDatum,
  });

  /* ---- Momsdeklaration ---- */
  if (momsregistrerad) {
    if (momsperiod === "helar") {
      // Med EU-handel: 26 februari. Utan: 12 maj.
      const manad = euHandel ? 1 : 4;
      const dag = euHandel ? 26 : 12;
      let momsDatum = datum(ar, manad, dag);
      let momsAr = ar - 1;
      if (nu > momsDatum) {
        momsDatum = datum(ar + 1, manad, dag);
        momsAr = ar;
      }
      lista.push({
        id: "moms",
        rubrik: "Momsdeklaration",
        detalj: euHandel
          ? `Helår ${momsAr}. Tidigare datum eftersom du säljer till företag i EU.`
          : `Helår ${momsAr}`,
        forfall: momsDatum,
      });
    } else {
      const p = nastaMomsperiod(nu, momsperiod);
      if (p) {
        lista.push({
          id: "moms",
          rubrik: "Momsdeklaration",
          detalj: p.etikett,
          forfall: p.forfall,
        });
      }
    }

    /* ---- Periodisk sammanställning ----
       Krävs bara vid försäljning till företag i EU. Lämnas den
       25:e månaden efter perioden när den skickas via e-tjänst. */
    if (euHandel) {
      let ps = datum(ar, nu.getMonth() + 1, 25);
      if (nu > ps) ps = datum(ar, nu.getMonth() + 2, 25);
      lista.push({
        id: "periodisk",
        rubrik: "Periodisk sammanställning",
        detalj: "Försäljning till företag i EU, rapporteras separat",
        forfall: ps,
      });
    }
  }

  return lista
    .map((p) => ({ ...p, dagarKvar: Math.ceil((p.forfall - nu) / 86400000) }))
    .sort((a, b) => a.forfall - b.forfall);
}
