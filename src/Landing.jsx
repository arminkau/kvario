import React, { useState, useMemo } from "react";
import { COUNTRIES, marginalskatt } from "./tax";
import { MARKE, MG, STAPEL, ANSVAR } from "./texter";

/* Landningssidan räknar med SAMMA motor som appen.
   Tidigare fanns en egen kopia här som saknade jobbskatteavdraget
   och visade 24 000 kr för lite. En produkt om ekonomisk sanning
   får inte ha två uträkningar som säger olika saker. */

const kr = (n) => Math.round(n || 0).toLocaleString("sv-SE").replace(/\u00a0/g, " ");

const EX = { revenue: 420000, costs: 68000, vat: 105000 };
const INST = { kommunalskatt: 32, avgiftslage: "full", pension: 0, annanInkomst: 0 };
const FORM = COUNTRIES.SE.forms.enskild;

/* ============================================================
   Landningssida

   Ligger före inloggningen. Målet är ett enda: att besökaren
   ska förstå produkten och känna aha-upplevelsen INNAN vi ber
   om något. Räknaren nedan fungerar utan konto med flit.
   ============================================================ */


export default function Landing({ onStart, onDemo }) {
  const [amount, setAmount] = useState(12000);
  const [rate, setRate] = useState(850);
  const [mode, setMode] = useState("business");

  const calc = useMemo(() => {
    const r = FORM.compute({ revenue: EX.revenue, costs: EX.costs, settings: INST });
    const marginal = marginalskatt(FORM, { revenue: EX.revenue, costs: EX.costs, settings: INST });
    const exVat = amount / 1.25;
    const rr = Math.max(1, rate);
    return {
      marginal,
      kvar: r.kvar,
      egen: r.lines.find((x) => x.key === "egenavgifter").amount,
      skatt: r.lines.find((x) => x.key === "inkomstskatt").amount,
      total: EX.revenue + EX.vat,
      real: exVat * (1 - marginal),
      vatBack: amount - exVat,
      saving: exVat * marginal,
      businessHours: exVat / rr,
      privateGross: amount / (1 - marginal),
      privateHours: amount / (1 - marginal) / rr,
    };
  }, [amount, rate]);

  const segs = [
    { label: "Moms", amount: EX.vat, color: "var(--band-1)" },
    { label: STAPEL.egnaKostnader, amount: EX.costs, color: "var(--band-2)" },
    { label: "Egenavgifter", amount: calc.egen, color: "var(--band-3)" },
    { label: "Inkomstskatt", amount: calc.skatt, color: "var(--band-4)" },
  ];

  return (
    <div className="lp">
      <nav className="lpNav">
        <div className="brand"><h1>{MARKE}</h1></div>
        <div className="lpNavRight">
          <button className="linkbtn" onClick={onDemo}>Testa utan konto</button>
          <button className="upgrade" onClick={onStart}>Logga in</button>
        </div>
      </nav>

      {/* ---------- Hero ---------- */}
      <header className="lpHero">
        <h2 className="lpH1">
          Hur mycket av pengarna<br />på kontot är faktiskt dina?
        </h2>
        <p className="lpLead">
          Momsen är inte dina. Skatten är inte dina. Egenavgifterna är inte dina.
          Kvario uppskattar vad som blir kvar — innan du hinner göra av med det.
        </p>
        <div className="lpCta">
          <button className="add wide2" onClick={onStart}>Kom igång gratis</button>
          <span className="lpCtaNote">14 dagar med allt upplåst. Inget kort.</span>
        </div>
      </header>

      {/* ---------- Produkten i aktion ---------- */}
      <section className="lpPanel">
        <div className="eyebrow">Ett typiskt år som frilansare</div>
        <div className="lpSplitTop">
          <div>
            <div className="bignum">{kr(calc.kvar)}<span className="unit">kr</span></div>
            <div className="sub">
              av {kr(calc.total)} kr infakturerat · {Math.round((calc.kvar / (EX.revenue - EX.costs)) * 100)} % av vinsten
            </div>
          </div>
          <p className="lpSplitNote">
            Momsen var aldrig dina. Skatt och egenavgifter tar ungefär en fjärdedel av
            allt som faktureras. De flesta upptäcker hur mycket först vid deklarationen.
          </p>
        </div>

        <div className="bar">
          {segs.map((s) => (
            <div key={s.label} className="seg" style={{ flexGrow: s.amount / calc.total, background: s.color }} title={s.label} />
          ))}
          <div className="seg mine" style={{ flexGrow: calc.kvar / calc.total }} title={STAPEL.kvarTillDig} />
        </div>

        <div className="lpLegend">
          {segs.map((s) => (
            <span key={s.label}>
              <i style={{ background: s.color }} />{s.label} <b>{kr(s.amount)}</b>
            </span>
          ))}
          <span className="mine"><i style={{ background: "var(--brass)" }} />{STAPEL.kvarTillDig} <b>{kr(calc.kvar)}</b></span>
        </div>
      </section>

      {/* ---------- Aha-upplevelsen, utan konto ---------- */}
      <section className="lpPanel">
        <div className="eyebrow">Prova direkt</div>
        <h3 className="lpH2">Vad kostar ett köp dig egentligen?</h3>
        <p className="lpBody">{MG.forklaring} Skjut på siffrorna och se skillnaden.</p>

        <div className="segbtns">
          {MG.lagen.filter(([k]) => k !== "payout").map(([k, l]) => (
            <button key={k} className="sb" data-on={mode === k} onClick={() => setMode(k)}>{l}</button>
          ))}
        </div>

        <div className="lpSliders">
          <label>
            <span>Pris <b>{kr(amount)} kr</b></span>
            <input type="range" min="1000" max="60000" step="500" value={amount}
                   onChange={(e) => setAmount(+e.target.value)} />
          </label>
          <label>
            <span>Ditt timpris <b>{kr(rate)} kr</b></span>
            <input type="range" min="300" max="2000" step="50" value={rate}
                   onChange={(e) => setRate(+e.target.value)} />
          </label>
        </div>

        {mode === "business" ? (
          <div className="lpResult">
            <p className="mgLead">
              Kostar dig i själva verket <b className="brass">{kr(calc.real)} kr</b>.
            </p>
            <div className="mgRows">
              <div><span>{MG.prislapp}</span><b>{kr(amount)} kr</b></div>
              <div><span>{MG.momsTillbaka("Moms")}</span><b>−{kr(calc.vatBack)} kr</b></div>
              <div><span>{MG.besparing("enskild")}</span><b>−{kr(calc.saving)} kr</b></div>
              <div className="tot"><span>{MG.verkligKostnad}</span><b>{kr(calc.real)} kr</b></div>
            </div>
            <p className="mgHours">Motsvarar <b>{calc.businessHours.toFixed(1)} arbetstimmar</b>.</p>
            <p className="mgSmalt">
              Besparingen bygger på marginalen {(calc.marginal * 100).toFixed(1).replace(".", ",")} %,
              där egenavgifterna står för ungefär hälften.
            </p>
          </div>
        ) : (
          <div className="lpResult">
            <p className="mgLead">
              Kräver att du fakturerar <b className="brass">{kr(calc.privateGross)} kr</b>.
            </p>
            <p className="mgHours">
              Det är <b>{calc.privateHours.toFixed(1)} arbetstimmar</b> — mot{" "}
              {calc.businessHours.toFixed(1)} timmar om samma sak köps via firman.
            </p>
          </div>
        )}
      </section>

      {/* ---------- Vad du får ---------- */}
      <section className="lpFeatures">
        {[
          ["Undanlagt", "Se vad som borde stå på ett separat konto just nu, och hur långt du har kvar dit."],
          ["Årsprognos", "Få veta i förväg när du är på väg att passera en skattegräns — medan du fortfarande kan göra något åt det."],
          ["Avdragsguiden", "Gymkortet, lunchen, hemmakontoret. Svar på de tjugo frågor alla ställer, precis när du ställer dem."],
          ["Enskild firma och AB", "Båda formerna beräknas, med löneoptimering och brytpunkt så du ser åt vilket håll det lutar."],
        ].map(([t, d]) => (
          <div className="lpFeat" key={t}>
            <h4>{t}</h4>
            <p>{d}</p>
          </div>
        ))}
      </section>

      {/* ---------- Pris ---------- */}
      <section className="lpPanel lpPrice">
        <div>
          <div className="eyebrow">Pris</div>
          <h3 className="lpH2">990 kr om året</h3>
          <p className="lpBody">
            Eller 99 kr i månaden. Uträkningen "kvar till dig" är gratis för alltid —
            du betalar för marginalräknaren, prognosen och obegränsat med fakturor.
          </p>
        </div>
        <div className="lpPriceCta">
          <button className="add wide2" onClick={onStart}>Kom igång gratis</button>
          <span className="lpCtaNote">14 dagar med allt upplåst, inget kort</span>
        </div>
      </section>

      <footer className="lpFoot">
        <span>{ANSVAR}</span>
        <button className="linkbtn" onClick={onDemo}>Se appen med exempeldata</button>
      </footer>
    </div>
  );
}
