import React, { useState, useMemo } from "react";

/* ============================================================
   Adminpanel

   Syns bara för användare med adminroll. Rollen läses från
   databasen, aldrig från klienten — annars kunde vem som helst
   göra sig till admin med två rader i webbläsarkonsolen.

   Alla åtgärder som ändrar något går via servern med
   service_role-nyckeln. Panelen är ett gränssnitt, inte en
   genväg förbi säkerheten.
   ============================================================ */

/* Öre visas när de finns, annars inte.

   maximumFractionDigits: 0 gjorde 9,90 kr till "10 kr" och summan
   108,90 till "109" — i en panel som ska stämma mot bokföringen. Ett
   avrundat belopp där är inte en förenkling, det är en felaktig siffra.

   Men jämna hundralappar ska inte heller släpa på ",00" i varje rad,
   så decimalerna kommer bara när beloppet faktiskt har öre. */
const kr = (ore) => {
  const belopp = (ore || 0) / 100;
  const harOre = Math.round(ore || 0) % 100 !== 0;
  return belopp.toLocaleString("sv-SE", {
    minimumFractionDigits: harOre ? 2 : 0,
    maximumFractionDigits: harOre ? 2 : 0,
  });
};
const datum = (d) => (d ? new Date(d).toLocaleDateString("sv-SE") : "—");

const FLIKAR = [
  ["oversikt", "Översikt"],
  ["kunder", "Kunder"],
  ["ordrar", "Ordrar"],
  ["aterbetalningar", "Återbetalningar"],
  ["siffror", "Siffror"],
  ["utskick", "Utskick"],
];

const MANADER = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

function Nyckeltal({ etikett, varde, not, ton }) {
  return (
    <div className="nyckeltal">
      <span className="eyebrow">{etikett}</span>
      <b className={ton}>{varde}</b>
      {not && <small>{not}</small>}
    </div>
  );
}

export default function Admin({ data, epost, onAterbetala, onUtskick, onStang }) {
  const [flik, setFlik] = useState("oversikt");
  const [sok, setSok] = useState("");
  const [utskick, setUtskick] = useState({ mottagare: "alla", amne: "", text: "" });
  const [bekraftar, setBekraftar] = useState(null);

  const { kunder = [], ordrar = [], aterbetalningar = [] } = data;

  const stat = useMemo(() => {
    const betalda = ordrar.filter((o) => o.status !== "aterbetald");
    const brutto = betalda.reduce((s, o) => s + o.belopp_ore - (o.aterbetalt_ore || 0), 0);
    const moms = betalda.reduce((s, o) => s + o.moms_ore, 0);
    const pro = kunder.filter((k) => k.plan === "pro").length;
    const trial = kunder.filter((k) => {
      if (k.plan === "pro" || !k.trial_start) return false;
      return (Date.now() - new Date(k.trial_start)) / 86400000 < 14;
    }).length;
    const arDagar = 30;
    const senaste = ordrar.filter((o) => (Date.now() - new Date(o.betald_at)) / 86400000 < arDagar);
    return {
      brutto, moms, pro, trial,
      totalt: kunder.length,
      konvertering: kunder.length ? Math.round((pro / kunder.length) * 100) : 0,
      senasteBrutto: senaste.reduce((s, o) => s + o.belopp_ore, 0),
      vantande: aterbetalningar.filter((a) => a.status === "begard").length,
    };
  }, [kunder, ordrar, aterbetalningar]);

  /* Samma uträkningar som SQL-frågorna i README, men gjorda på
     datan vi redan hämtat. Vid tusentals ordrar flyttar man dem
     till servern — vid hundratals är det onödigt. */
  const siffror = useMemo(() => {
    const perManad = {};
    ordrar.forEach((o) => {
      const d = new Date(o.betald_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      perManad[k] = perManad[k] || { k, ar: d.getFullYear(), man: d.getMonth(), antal: 0, brutto: 0, moms: 0, aterbetalt: 0 };
      perManad[k].antal++;
      perManad[k].brutto += o.belopp_ore;
      perManad[k].moms += o.moms_ore;
      perManad[k].aterbetalt += o.aterbetalt_ore || 0;
    });
    const manader = Object.values(perManad).sort((x, y) => y.k.localeCompare(x.k));
    const max = Math.max(1, ...manader.map((m) => m.brutto));

    // Löpande intäkt per månad: årsplaner slås ut på tolv månader
    const mrr = kunder.filter((k) => k.plan === "pro").reduce((s, k) => {
      const o = ordrar.filter((x) => x.epost === k.epost).sort((x, y) => new Date(y.betald_at) - new Date(x.betald_at))[0];
      if (!o) return s;
      return s + (o.belopp_ore >= 50000 ? o.belopp_ore / 12 : o.belopp_ore);
    }, 0);

    const nu = Date.now();
    const utgar = kunder
      .filter((k) => k.plan !== "pro" && k.trial_start)
      .map((k) => ({ ...k, slut: new Date(k.trial_start).getTime() + 14 * 86400000 }))
      .filter((k) => k.slut > nu && k.slut < nu + 7 * 86400000)
      .sort((x, y) => x.slut - y.slut);

    const utgangna = kunder.filter((k) => {
      if (k.plan === "pro" || !k.trial_start) return false;
      return new Date(k.trial_start).getTime() + 14 * 86400000 < nu;
    });

    const aterbetalt = ordrar.reduce((s, o) => s + (o.aterbetalt_ore || 0), 0);
    const brutto = ordrar.reduce((s, o) => s + o.belopp_ore, 0);

    return { manader, max, mrr, utgar, utgangna, aterbetalt, brutto,
             andelAterbetalt: brutto ? (aterbetalt / brutto) * 100 : 0 };
  }, [ordrar, kunder]);

  const exportera = () => {
    const rader = [["Ordernummer", "Namn", "E-post", "Datum", "Brutto", "Moms", "Aterbetalt", "Status"]];
    ordrar.forEach((o) => rader.push([o.ordernummer, o.namn || "", o.epost, (o.betald_at || "").slice(0, 10),
      (o.belopp_ore / 100).toFixed(2), (o.moms_ore / 100).toFixed(2),
      ((o.aterbetalt_ore || 0) / 100).toFixed(2), o.status]));
    const blob = new Blob(["\uFEFF" + rader.map((r) => r.join(";")).join("\n")], { type: "text/csv" });
    const el = document.createElement("a");
    el.href = URL.createObjectURL(blob);
    el.download = `kvario-ordrar-${new Date().toISOString().slice(0, 10)}.csv`;
    el.click();
  };

  const filtrerade = (lista, falt) =>
    !sok ? lista : lista.filter((x) => falt.some((f) => String(x[f] || "").toLowerCase().includes(sok.toLowerCase())));

  return (
    <div className="adminVy">
      <div className="adminTopp">
        <div>
          <div className="eyebrow">Administration</div>
          <h1 className="adminH1">Kvario</h1>
        </div>
        <div className="adminIdentitet">
          {epost && <span>{epost}</span>}
          <button className="linkbtn" onClick={onStang}>Logga ut</button>
        </div>
      </div>

      <div className="adminFlikar">
        {FLIKAR.map(([k, l]) => (
          <button key={k} className="sb" data-on={flik === k} onClick={() => setFlik(k)}>
            {l}
            {k === "aterbetalningar" && stat.vantande > 0 && <span className="prick">{stat.vantande}</span>}
          </button>
        ))}
      </div>

      {/* ---------- ÖVERSIKT ---------- */}
      {flik === "oversikt" && (
        <>
          <div className="nyckeltalRad">
            <Nyckeltal etikett="Intäkter totalt" varde={`${kr(stat.brutto)} kr`} not="Efter återbetalningar" ton="brass" />
            <Nyckeltal etikett="Senaste 30 dagarna" varde={`${kr(stat.senasteBrutto)} kr`} />
            <Nyckeltal etikett="Moms att redovisa" varde={`${kr(stat.moms)} kr`} />
          </div>
          <div className="nyckeltalRad">
            <Nyckeltal etikett="Betalande" varde={stat.pro} not={`av ${stat.totalt} konton`} ton="brass" />
            <Nyckeltal etikett="Pågående provperioder" varde={stat.trial} />
            <Nyckeltal etikett="Konvertering" varde={`${stat.konvertering} %`} />
          </div>

          {stat.vantande > 0 && (
            <div className="alert">
              <span className="bang">!</span>
              <p>
                <strong>{stat.vantande} återbetalning{stat.vantande === 1 ? "" : "ar"} väntar på beslut.</strong>{" "}
                <button className="linkbtn" onClick={() => setFlik("aterbetalningar")}>Hantera nu</button>
              </p>
            </div>
          )}

          <div className="adminPanel">
            <h3>Senaste ordrar</h3>
            <table className="rTabell">
              <thead><tr><th>Order</th><th>Kund</th><th>Datum</th><th className="h">Belopp</th></tr></thead>
              <tbody>
                {ordrar.slice(0, 8).map((o) => (
                  <tr key={o.id}>
                    <td className="mono">{o.ordernummer}</td>
                    <td>{o.epost}</td>
                    <td>{datum(o.betald_at)}</td>
                    <td className="h">{kr(o.belopp_ore)} kr</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ---------- KUNDER ---------- */}
      {flik === "kunder" && (
        <div className="adminPanel">
          <input className="adminSok" placeholder="Sök på e-post…" value={sok} onChange={(e) => setSok(e.target.value)} />
          <table className="rTabell">
            <thead><tr><th>E-post</th><th>Plan</th><th>Provperiod</th><th>Period</th><th className="h">Betalt totalt</th></tr></thead>
            <tbody>
              {filtrerade(kunder, ["epost"]).map((k) => {
                const kOrdrar = ordrar.filter((o) => o.epost === k.epost);
                const summa = kOrdrar.reduce((s, o) => s + o.belopp_ore - (o.aterbetalt_ore || 0), 0);
                return (
                  <tr key={k.user_id}>
                    <td>{k.epost}</td>
                    <td>
                      <span className={`plantag ${k.plan}`}>{k.plan === "pro" ? "Pro" : "Gratis"}</span>
                      {k.uppsagd_at && <span className="regelTag">Uppsagd</span>}
                    </td>
                    <td>{datum(k.trial_start)}</td>
                    {/* Kolumnen hette "Förnyas" och visade periodslutet
                        även för en uppsagd prenumeration — som alltså
                        inte förnyas alls. Samma datum, motsatt betydelse. */}
                    <td>{k.uppsagd_at ? <>Slutar {datum(k.current_period_end)}</> : datum(k.current_period_end)}</td>
                    <td className="h">{kr(summa)} kr</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- ORDRAR ---------- */}
      {flik === "ordrar" && (
        <div className="adminPanel">
          <input className="adminSok" placeholder="Sök på ordernummer, namn eller e-post…" value={sok} onChange={(e) => setSok(e.target.value)} />
          <table className="rTabell">
            <thead><tr><th>Order</th><th>Kund</th><th>Datum</th><th>Status</th><th className="h">Belopp</th><th></th></tr></thead>
            <tbody>
              {filtrerade(ordrar, ["ordernummer", "epost", "namn"]).map((o) => {
                const kvarAtt = o.belopp_ore - (o.aterbetalt_ore || 0);
                return (
                  <tr key={o.id}>
                    <td className="mono">{o.ordernummer}</td>
                    <td>{o.namn ? <>{o.namn}<div className="dim">{o.epost}</div></> : o.epost}</td>
                    <td>{datum(o.betald_at)}</td>
                    <td>
                      <span className={`plantag ${o.status === "betald" ? "pro" : "gratis"}`}>
                        {o.status === "betald" ? "Betald" : o.status === "aterbetald" ? "Återbetald" : "Delvis"}
                      </span>
                    </td>
                    <td className="h">
                      {kr(o.belopp_ore)} kr
                      {o.aterbetalt_ore > 0 && <div className="dim">−{kr(o.aterbetalt_ore)} kr</div>}
                    </td>
                    <td className="h">
                      {kvarAtt > 0 && (
                        <button className="linkbtn" onClick={() => setBekraftar({ order: o, belopp: kvarAtt })}>
                          Återbetala
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- ÅTERBETALNINGAR ---------- */}
      {flik === "aterbetalningar" && (
        <div className="adminPanel">
          <p className="adminHjalp">
            Begäran inom ångerfristen på 14 dagar godkänns automatiskt om kunden inte avsagt sig
            ångerrätten vid köpet. Övriga hamnar här för beslut. Kom ihåg att momsen följer med —
            återbetalar du 990 kr ska 198 kr moms justeras i nästa deklaration.
          </p>
          {aterbetalningar.length === 0 && <p className="empty">Inga begäranden just nu.</p>}
          <table className="rTabell">
            <thead><tr><th>Begärd</th><th>Kund</th><th>Orsak</th><th>Status</th><th className="h">Belopp</th><th></th></tr></thead>
            <tbody>
              {aterbetalningar.map((a) => (
                <tr key={a.id}>
                  <td>{datum(a.begard_at)}</td>
                  <td>{a.epost}</td>
                  <td>{a.orsak || "—"}</td>
                  <td>
                    <span className={`plantag ${a.status === "genomford" ? "pro" : "gratis"}`}>
                      {a.status === "begard" ? "Väntar" : a.status === "genomford" ? "Genomförd" : a.status}
                    </span>
                    {a.automatisk && <span className="regelTag">Automatisk</span>}
                  </td>
                  <td className="h">{kr(a.belopp_ore)} kr</td>
                  <td className="h">
                    {a.status === "begard" && (
                      <button className="linkbtn" onClick={() => setBekraftar({ begaran: a, belopp: a.belopp_ore })}>
                        Godkänn
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- SIFFROR ---------- */}
      {flik === "siffror" && (
        <>
          <div className="nyckeltalRad">
            <Nyckeltal etikett="Löpande per månad" varde={`${kr(siffror.mrr)} kr`}
                       not="Årsplaner utslagna på 12 månader" ton="brass" />
            <Nyckeltal etikett="På årsbasis" varde={`${kr(siffror.mrr * 12)} kr`} />
            <Nyckeltal etikett="Återbetalat" varde={`${siffror.andelAterbetalt.toFixed(1)} %`}
                       not={`${kr(siffror.aterbetalt)} kr av ${kr(siffror.brutto)} kr`}
                       ton={siffror.andelAterbetalt > 5 ? "warn" : ""} />
          </div>

          <div className="adminPanel">
            <div className="panelRad">
              <h3>Intäkter per månad</h3>
              <button className="linkbtn" onClick={exportera}>Exportera CSV</button>
            </div>
            {siffror.manader.length === 0 && <p className="empty">Inga ordrar än.</p>}
            {siffror.manader.map((m) => (
              <div className="manadRad" key={m.k}>
                <span className="manadNamn">{MANADER[m.man]} {m.ar}</span>
                <div className="manadStapel">
                  <div className="manadFyll" style={{ width: `${(m.brutto / siffror.max) * 100}%` }} />
                </div>
                <span className="manadAntal">{m.antal} st</span>
                <span className="manadBelopp">{kr(m.brutto)} kr</span>
              </div>
            ))}
            {siffror.manader.length > 0 && (
              <p className="adminHjalp" style={{ marginTop: 16, marginBottom: 0 }}>
                Momsen i perioden är {kr(siffror.manader.reduce((s, m) => s + m.moms, 0))} kr.
                Den ska redovisas oavsett om pengarna finns kvar på kontot.
              </p>
            )}
          </div>

          <div className="adminPanel">
            <h3>Provperioder som går ut inom sju dagar</h3>
            <p className="adminHjalp">
              De här har testat produkten och har snart inte kvar den. Ett mejl här konverterar
              bättre än något annat utskick — de vet redan vad de förlorar.
            </p>
            {siffror.utgar.length === 0 && <p className="empty">Ingen provperiod går ut den närmaste veckan.</p>}
            {siffror.utgar.map((k) => {
              const dagar = Math.ceil((k.slut - Date.now()) / 86400000);
              return (
                <div className="item" key={k.user_id}>
                  <span className="iname">{k.epost}</span>
                  <span className="iamt">
                    {dagar} {dagar === 1 ? "dag" : "dagar"} kvar
                    <span className="dim"> · går ut {datum(k.slut)}</span>
                  </span>
                </div>
              );
            })}
            {siffror.utgangna.length > 0 && (
              <p className="adminHjalp" style={{ marginTop: 16, marginBottom: 0 }}>
                {siffror.utgangna.length} konton har en utgången provperiod utan att ha betalat.
                Fråga dem varför — det svaret är mer värt än nästa funktion du bygger.
              </p>
            )}
          </div>
        </>
      )}

      {/* ---------- UTSKICK ---------- */}
      {flik === "utskick" && (
        <div className="adminPanel">
          <h3>Mejla användare</h3>
          <p className="adminHjalp">
            Marknadsföringsutskick kräver samtycke. Servicemeddelanden om tjänsten — driftstörningar,
            ändrade villkor, prishöjningar — får skickas utan samtycke, och vissa av dem måste
            skickas. Nyhetsbrev får bara gå till dem som aktivt tackat ja.
          </p>
          <div className="utskickForm">
            <label>Mottagare
              <select value={utskick.mottagare} onChange={(e) => setUtskick({ ...utskick, mottagare: e.target.value })}>
                <option value="alla">Alla konton ({kunder.length})</option>
                <option value="pro">Endast betalande ({stat.pro})</option>
                <option value="trial">Pågående provperiod ({stat.trial})</option>
                <option value="utgangen">Utgången provperiod, ej betalande</option>
              </select>
            </label>
            <label>Ämne
              <input value={utskick.amne} onChange={(e) => setUtskick({ ...utskick, amne: e.target.value })}
                     placeholder="Nyheter i Kvario" />
            </label>
            <label>Meddelande
              <textarea rows="7" value={utskick.text} onChange={(e) => setUtskick({ ...utskick, text: e.target.value })}
                        placeholder="Skriv ditt meddelande…" />
            </label>
            <button className="add" disabled={!utskick.amne || !utskick.text}
                    onClick={() => onUtskick(utskick)}>
              Skicka till {utskick.mottagare === "alla" ? kunder.length : utskick.mottagare === "pro" ? stat.pro : stat.trial} mottagare
            </button>
          </div>
        </div>
      )}

      {/* ---------- BEKRÄFTELSE ---------- */}
      {bekraftar && (
        <div className="modalBg" onClick={() => setBekraftar(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Bekräfta återbetalning</h2>
            <p className="modalLead">
              {kr(bekraftar.belopp)} kr återbetalas till{" "}
              {bekraftar.order?.epost || bekraftar.begaran?.epost}. Momsen på{" "}
              {kr(Math.round(bekraftar.belopp - bekraftar.belopp / 1.25))} kr ska justeras i nästa
              momsdeklaration. Prenumerationen avslutas inte automatiskt.
            </p>
            <button className="add wide" onClick={() => { onAterbetala(bekraftar); setBekraftar(null); }}>
              Genomför återbetalning
            </button>
            <button className="linkbtn center" onClick={() => setBekraftar(null)}>Avbryt</button>
          </div>
        </div>
      )}
    </div>
  );
}
