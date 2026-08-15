import React from "react";
import { MARKE, STAPEL, ANSVAR } from "./texter";

/* ============================================================
   Rapporter

   Ingen PDF-generator. Rapporten renderas som riktig HTML och
   skrivs ut via webbläsarens egen PDF-motor.

   Skälet är kvalitet: jsPDF och liknande kräver att fonter bäddas
   in för att å, ä och ö ska fungera, ger raster i stället för text
   som går att söka i, och lägger ett par hundra kilobyte till
   paketet. Webbläsarens utskrift ger vektor, korrekt typografi och
   fungerar likadant på alla plattformar.
   ============================================================ */

const kr = (n) => Math.round(n || 0).toLocaleString("sv-SE").replace(/\u00a0/g, " ");
const datum = (d = new Date()) => d.toLocaleDateString("sv-SE");

export const RAPPORTER = [
  {
    id: "oversikt",
    namn: "Årsöversikt",
    beskrivning: "Hela bilden med förklaringar. Den att spara eller visa för någon annan.",
  },
  {
    id: "underlag",
    namn: "Underlag till redovisningskonsulten",
    beskrivning: "Rådata: alla fakturor, kostnader och anställda i tabellform.",
  },
  {
    id: "moms",
    namn: "Momsunderlag",
    beskrivning: "Utgående och ingående moms uppdelat per momssats.",
  },
  {
    id: "kunder",
    namn: "Resultat per kund",
    beskrivning: "Vilka kunder som står för intäkterna, och hur beroende du är av den största.",
  },
  {
    id: "perioder",
    namn: "Period för period",
    beskrivning: "Månad och kvartal jämfört, så att säsong och utveckling syns.",
  },
];

/* Poster utan datum är inlagda innan datumfältet fanns. De räknas
   till innevarande år men hamnar utanför periodindelningen, i
   stället för att gissas in i en månad de kanske inte hör hemma i. */
const period = (x) => (x.datum ? String(x.datum).slice(0, 7) : null);
const arAv = (x) => (x.datum ? Number(String(x.datum).slice(0, 4)) : null);

function Rad({ etikett, belopp, not, stark, negativ }) {
  return (
    <div className={`rRad ${stark ? "stark" : ""}`}>
      <span className="rEtikett">{etikett}</span>
      {not && <span className="rNot">{not}</span>}
      <span className="rBelopp">{negativ ? "−" : ""}{kr(belopp)} kr</span>
    </div>
  );
}

function Forklaring({ children }) {
  return <p className="rForklaring">{children}</p>;
}

export default function Rapport({ typ, state, form, d, personal, forecast, owed, email }) {
  const momsreg = d.momsreg !== false;
  const { invoices, costs, employees = [], setAside } = state;
  const FX = { SEK: 1, EUR: 11.5, USD: 10.6, GBP: 13.5, NOK: 0.95, DKK: 1.54 };
  const iSek = (x) => x.amount * FX[x.currency];

  /* Moms per sats — det redovisningskonsulten faktiskt behöver */
  const TYPER = { se: "Sverige", eub2b: "Företag i EU", eub2c: "Privatperson i EU", export: "Utanför EU" };
  const perTyp = {};
  invoices.forEach((i) => {
    const k = i.typ || "se";
    perTyp[k] = (perTyp[k] || 0) + iSek(i);
  });

  const momsPerSats = {};
  invoices.filter((i) => !i.typ || i.typ === "se" || i.typ === "eub2c").forEach((i) => {
    const k = i.vat;
    momsPerSats[k] = momsPerSats[k] || { ut: 0, utBas: 0, in: 0, inBas: 0 };
    momsPerSats[k].utBas += iSek(i);
    momsPerSats[k].ut += iSek(i) * (i.vat / 100);
  });
  costs.forEach((c) => {
    const k = c.vat;
    momsPerSats[k] = momsPerSats[k] || { ut: 0, utBas: 0, in: 0, inBas: 0 };
    momsPerSats[k].inBas += iSek(c);
    momsPerSats[k].in += iSek(c) * (c.vat / 100);
  });
  const satser = Object.keys(momsPerSats).map(Number).sort((a, b) => b - a);

  /* ---------- Per kund ----------
     Beloppen är exklusive moms, alltså det som faktiskt är intäkt.
     Obetalt särredovisas — en stor kund som inte betalar är en helt
     annan sak än en stor kund som gör det. */
  const perKund = {};
  invoices.forEach((i) => {
    const namn = i.client || "Namnlös";
    perKund[namn] = perKund[namn] || { namn, belopp: 0, antal: 0, obetalt: 0 };
    perKund[namn].belopp += iSek(i);
    perKund[namn].antal++;
    if (!i.paid) perKund[namn].obetalt += iSek(i);
  });
  const summaKund = Object.values(perKund).reduce((s, k) => s + k.belopp, 0);
  const kunder = Object.values(perKund)
    .map((k) => ({ ...k, andel: summaKund ? (k.belopp / summaKund) * 100 : 0 }))
    .sort((a, b) => b.belopp - a.belopp);

  /* ---------- Per månad och år ---------- */
  const perManad = {};
  const perAr = {};
  let utanDatum = 0;

  const bokfor = (x, falt) => {
    const p = period(x);
    if (!p) { if (falt === "intakt") utanDatum++; return; }
    perManad[p] = perManad[p] || { k: p, intakt: 0, kostnad: 0, antal: 0 };
    perManad[p][falt] += iSek(x);
    if (falt === "intakt") perManad[p].antal++;

    const a = arAv(x);
    perAr[a] = perAr[a] || { ar: a, intakt: 0, kostnad: 0, antal: 0 };
    perAr[a][falt] += iSek(x);
    if (falt === "intakt") perAr[a].antal++;
  };
  invoices.forEach((i) => bokfor(i, "intakt"));
  costs.forEach((c) => bokfor(c, "kostnad"));

  const manadsnamn = (k) => {
    const [ar, m] = k.split("-");
    return new Date(Number(ar), Number(m) - 1, 1)
      .toLocaleDateString("sv-SE", { month: "long", year: "numeric" });
  };
  const manader = Object.values(perManad)
    .sort((a, b) => a.k.localeCompare(b.k))
    .map((m) => ({ ...m, namn: manadsnamn(m.k) }));
  const arsrader = Object.values(perAr).sort((a, b) => a.ar - b.ar);

  const rubrik = RAPPORTER.find((r) => r.id === typ)?.namn || "Rapport";
  const formNamn = form?.name || "";

  return (
    <div className="rapport">
      <header className="rHuvud">
        <div>
          <div className="rMarke">{MARKE}</div>
          <h1>{rubrik}</h1>
        </div>
        <div className="rMeta">
          <div>{formNamn}</div>
          <div>Inkomstår 2026</div>
          <div>Utskriven {datum()}</div>
          {email && <div>{email}</div>}
        </div>
      </header>

      {/* ---------- ÅRSÖVERSIKT ---------- */}
      {typ === "oversikt" && (
        <>
          <section>
            <h2>Vad som blir kvar</h2>
            <Forklaring>
              Kedjan nedan visar vad som händer med varje krona som faktureras.
              {momsreg
                ? " Momsen var aldrig din — den samlas in åt staten."
                : " Du är inte momsregistrerad, så ingen moms tas ut. Momsen du betalar på inköp får du inte dra av, utan den ingår i kostnaderna."}{" "}
              Kostnaderna är pengar du valt att lägga på verksamheten. Först därefter kommer
              avgifter och skatt.
            </Forklaring>
            <Rad etikett={momsreg ? "Infakturerat inklusive moms" : "Fakturerat"} belopp={d.revenue + d.outVat} />
            {momsreg && (
              <Rad etikett="Moms att redovisa" belopp={d.vatDue} negativ
                   not="Utgående minus ingående moms" />
            )}
            <Rad etikett={STAPEL.egnaKostnader} belopp={d.costBase} negativ
                 not={momsreg ? "Exklusive moms" : "Inklusive moms, som inte får dras av"} />
            {d.tax?.lines.map((l) => (
              <Rad key={l.key} etikett={l.label} belopp={l.amount} not={l.note} negativ />
            ))}
            <Rad etikett={STAPEL.kvarTillDig} belopp={d.tax?.kvar} stark />
            {d.tax && (
              <Forklaring>
                Det motsvarar {Math.round((d.tax.kvar / Math.max(1, d.tax.overskott)) * 100)} %
                av vinsten. Din marginalskatt är {(d.tax.marginal * 100).toFixed(1).replace(".", ",")} %,
                vilket betyder att nästa intjänade hundralapp ger dig{" "}
                {Math.round(100 - d.tax.marginal * 100)} kr efter skatt och avgifter.
              </Forklaring>
            )}
          </section>

          <section>
            <h2>Undanlagt</h2>
            <Forklaring>
              Skatter och avgifter betalas i efterhand. Summan nedan är vad som bör stå på ett
              separat konto redan nu, så att pengarna finns kvar när de ska betalas in.
            </Forklaring>
            <Rad etikett="Bör vara undanlagt" belopp={owed} />
            <Rad etikett="Faktiskt undanlagt" belopp={setAside} />
            <Rad etikett={owed - setAside > 0 ? "Saknas" : "Marginal"}
                 belopp={Math.abs(owed - setAside)} stark />
          </section>

          {forecast && (
            <section>
              <h2>Prognos för året</h2>
              <Forklaring>
                Framskrivning av siffrorna hittills till årets slut. Den förutsätter att resten
                av året liknar den del som gått — vid säsongsvariation blir den missvisande.
              </Forklaring>
              <Rad etikett="Beräknad omsättning" belopp={forecast.projRevenue} />
              <Rad etikett="Beräknad vinst" belopp={forecast.projOverskott} />
              <Rad etikett="Beräknat kvar till dig" belopp={forecast.projKvar} stark />
              {forecast.hits.map((m) => (
                <Forklaring key={m.label}>
                  <b>{m.label}</b> — {m.note}
                </Forklaring>
              ))}
            </section>
          )}

          {employees.length > 0 && (
            <section>
              <h2>Personal</h2>
              <Forklaring>
                Arbetsgivaravgiften är 31,42 % som huvudregel. Flera nedsättningar finns —
                växa-stöd för de två första anställda, lägre sats för unga, och endast
                ålderspensionsavgift för den som fyllt 67.
              </Forklaring>
              <table className="rTabell">
                <thead>
                  <tr><th>Namn</th><th>Lön/mån</th><th>Avgiftssats</th><th>Regel</th><th className="h">Avgift/år</th></tr>
                </thead>
                <tbody>
                  {personal.rader.map((e) => (
                    <tr key={e.id}>
                      <td>{e.name}</td>
                      <td>{kr(e.monthly)} kr</td>
                      <td>{(e.sats * 100).toFixed(2)} %</td>
                      <td>{e.regel || "Full avgift"}</td>
                      <td className="h">{kr(e.avgift)} kr</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {personal.sparat > 0 && (
                <Forklaring>
                  Nedsättningarna sparar {kr(personal.sparat)} kr per år jämfört med full avgift
                  för samtliga.
                </Forklaring>
              )}
            </section>
          )}
        </>
      )}

      {/* ---------- UNDERLAG ---------- */}
      {typ === "underlag" && (
        <>
          <section>
            <h2>Fakturor</h2>
            <table className="rTabell">
              <thead>
                <tr><th>Datum</th><th>Kund</th><th>Belopp</th><th>Valuta</th><th>Moms</th><th>Status</th><th className="h">I SEK</th></tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td>{i.datum || "—"}</td>
                    <td>{i.client}</td><td>{kr(i.amount)}</td><td>{i.currency}</td>
                    <td>{i.vat} %</td><td>{i.paid ? "Betald" : "Obetald"}</td>
                    <td className="h">{kr(iSek(i))} kr</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan="6">Summa exklusive moms</td><td className="h">{kr(d.revenue)} kr</td></tr></tfoot>
            </table>
          </section>

          <section>
            <h2>Kostnader</h2>
            <table className="rTabell">
              <thead><tr><th>Datum</th><th>Vad</th><th>Belopp</th><th>Valuta</th><th>Moms</th><th className="h">I SEK</th></tr></thead>
              <tbody>
                {costs.map((c) => (
                  <tr key={c.id}>
                    <td>{c.datum || "—"}</td>
                    <td>{c.label}</td><td>{kr(c.amount)}</td><td>{c.currency}</td>
                    <td>{c.vat} %</td><td className="h">{kr(iSek(c))} kr</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan="5">Summa exklusive moms</td><td className="h">{kr(d.costBase)} kr</td></tr></tfoot>
            </table>
          </section>

          {employees.length > 0 && (
            <section>
              <h2>Anställda</h2>
              <table className="rTabell">
                <thead><tr><th>Namn</th><th>Födelseår</th><th>Lön/mån</th><th>Sats</th><th className="h">Avgift/år</th></tr></thead>
                <tbody>
                  {personal.rader.map((e) => (
                    <tr key={e.id}>
                      <td>{e.name}</td><td>{e.fodelsear || "—"}</td><td>{kr(e.monthly)} kr</td>
                      <td>{(e.sats * 100).toFixed(2)} %</td><td className="h">{kr(e.avgift)} kr</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan="4">Total personalkostnad</td><td className="h">{kr(personal.total)} kr</td></tr></tfoot>
              </table>
            </section>
          )}
        </>
      )}

      {/* ---------- MOMS ---------- */}
      {typ === "moms" && (
        <section>
          <h2>Moms per skattesats</h2>
          <Forklaring>
            Utgående moms är den du tagit ut av dina kunder. Ingående moms är den du betalat
            på dina inköp och får dra av. Skillnaden är vad som ska betalas in — eller
            återfås om den är negativ.
          </Forklaring>
          <table className="rTabell">
            <thead>
              <tr><th>Sats</th><th>Underlag försäljning</th><th>Utgående moms</th><th>Underlag inköp</th><th className="h">Ingående moms</th></tr>
            </thead>
            <tbody>
              {satser.map((s) => (
                <tr key={s}>
                  <td>{s} %</td>
                  <td>{kr(momsPerSats[s].utBas)} kr</td>
                  <td>{kr(momsPerSats[s].ut)} kr</td>
                  <td>{kr(momsPerSats[s].inBas)} kr</td>
                  <td className="h">{kr(momsPerSats[s].in)} kr</td>
                </tr>
              ))}
            </tbody>
          </table>
          {Object.keys(perTyp).some((k) => k !== "se") && (
            <>
              <h2 style={{ marginTop: 26 }}>Försäljning per typ</h2>
              <Forklaring>
                Försäljning till företag i EU har omvänd betalningsskyldighet och ska rapporteras
                i periodisk sammanställning. Export utanför EU är inte momspliktig i Sverige.
                Ingen av dem ingår i momsunderlaget ovan.
              </Forklaring>
              <table className="rTabell">
                <thead><tr><th>Typ</th><th className="h">Belopp</th></tr></thead>
                <tbody>
                  {Object.entries(perTyp).map(([k, v]) => (
                    <tr key={k}><td>{TYPER[k] || k}</td><td className="h">{kr(v)} kr</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div style={{ marginTop: 18 }}>
            <Rad etikett="Utgående moms totalt" belopp={d.outVat} />
            <Rad etikett="Ingående moms totalt" belopp={d.inVat} negativ />
            <Rad etikett={d.outVat - d.inVat >= 0 ? "Att betala in" : "Att få tillbaka"}
                 belopp={Math.abs(d.outVat - d.inVat)} stark />
          </div>
        </section>
      )}

      {/* ---------- RESULTAT PER KUND ---------- */}
      {typ === "kunder" && (
        <section>
          <h2>Resultat per kund</h2>
          <Forklaring>
            Vad varje kund faktiskt dragit in, exklusive moms. Sorterat efter storlek.
            Andelen är värd att titta på: står en enda kund för mer än halva omsättningen
            är det inte en kund, det är en arbetsgivare — och en risk om den försvinner.
          </Forklaring>

          {kunder.length === 0 && <Forklaring>Inga fakturor inlagda än.</Forklaring>}

          {kunder.length > 0 && (
            <>
              <table className="rTabell">
                <thead>
                  <tr><th>Kund</th><th>Fakturor</th><th>Varav obetalt</th><th>Andel</th><th className="h">Exkl. moms</th></tr>
                </thead>
                <tbody>
                  {kunder.map((k) => (
                    <tr key={k.namn}>
                      <td>{k.namn}</td>
                      <td>{k.antal}</td>
                      <td>{k.obetalt > 0 ? `${kr(k.obetalt)} kr` : "—"}</td>
                      <td>{Math.round(k.andel)} %</td>
                      <td className="h">{kr(k.belopp)} kr</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan="4">Summa</td><td className="h">{kr(d.revenue)} kr</td></tr>
                </tfoot>
              </table>

              {kunder[0] && kunder[0].andel > 50 && (
                <Forklaring>
                  <b>{kunder[0].namn} står för {Math.round(kunder[0].andel)} % av omsättningen.</b>{" "}
                  Vid den koncentrationen kan Skatteverket i vissa fall ifrågasätta om det
                  är näringsverksamhet eller förtäckt anställning. Det är också en ren
                  affärsrisk — faller den kunden bort faller det mesta.
                </Forklaring>
              )}
            </>
          )}
        </section>
      )}

      {/* ---------- PERIOD FÖR PERIOD ---------- */}
      {typ === "perioder" && (
        <section>
          <h2>Period för period</h2>
          <Forklaring>
            Fakturerat och inköpt per månad, efter datumen du lagt in. Säsongsvariation
            syns här — och den är skälet att vara försiktig med årsprognosen, som antar
            att resten av året liknar det som gått.
          </Forklaring>

          {manader.length === 0 ? (
            <Forklaring>
              Inga poster med datum än. Datum fylls i när du lägger till en faktura eller
              kostnad; äldre poster saknar det och räknas därför inte med här.
            </Forklaring>
          ) : (
            <>
              <table className="rTabell">
                <thead>
                  <tr><th>Månad</th><th>Fakturor</th><th>Intäkt</th><th>Kostnader</th><th className="h">Netto</th></tr>
                </thead>
                <tbody>
                  {manader.map((m) => (
                    <tr key={m.k}>
                      <td>{m.namn}</td>
                      <td>{m.antal}</td>
                      <td>{kr(m.intakt)} kr</td>
                      <td>{kr(m.kostnad)} kr</td>
                      <td className="h">{kr(m.intakt - m.kostnad)} kr</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="2">Summa</td>
                    <td>{kr(manader.reduce((s, m) => s + m.intakt, 0))} kr</td>
                    <td>{kr(manader.reduce((s, m) => s + m.kostnad, 0))} kr</td>
                    <td className="h">{kr(manader.reduce((s, m) => s + m.intakt - m.kostnad, 0))} kr</td>
                  </tr>
                </tfoot>
              </table>

              {utanDatum > 0 && (
                <Forklaring>
                  {utanDatum} {utanDatum === 1 ? "post saknar" : "poster saknar"} datum och
                  ingår inte i tabellen ovan. De räknas däremot med i alla andra siffror.
                </Forklaring>
              )}

              {arsrader.length > 1 && (
                <>
                  <h2 style={{ marginTop: 26 }}>År mot år</h2>
                  <table className="rTabell">
                    <thead>
                      <tr><th>År</th><th>Fakturor</th><th>Intäkt</th><th>Kostnader</th><th className="h">Netto</th></tr>
                    </thead>
                    <tbody>
                      {arsrader.map((a) => (
                        <tr key={a.ar}>
                          <td>{a.ar}</td>
                          <td>{a.antal}</td>
                          <td>{kr(a.intakt)} kr</td>
                          <td>{kr(a.kostnad)} kr</td>
                          <td className="h">{kr(a.intakt - a.kostnad)} kr</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </>
          )}
        </section>
      )}

      <footer className="rFot">
        <p>
          <b>Detta är inte skatterådgivning.</b> {ANSVAR}{" "}
          {d.tax?.caveat || "Siffrorna är uppskattningar och innehåller förenklingar."}{" "}
          Stäm av mot Skatteverket eller din redovisningskonsult innan du använder underlaget
          för deklaration eller bokföring.
        </p>
        <p className="rSid">{MARKE} · {datum()}</p>
      </footer>
    </div>
  );
}
