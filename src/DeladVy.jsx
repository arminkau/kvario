import React, { useEffect, useState } from "react";
import { hamtaDeladRapport } from "./dela";
import { COUNTRIES, personalkostnad } from "./tax";
import { CSS } from "./theme";
import { MARKE } from "./texter";
import Rapport, { RAPPORTER } from "./Rapport.jsx";

const FX = { SEK: 1, EUR: 11.5, USD: 10.6, GBP: 13.5, NOK: 0.95, DKK: 1.54 };

/* Samma uträkning som appens huvudvy (se d-useMemo i App.jsx), men
   för ett fristående state-snapshot utan inloggning. Medvetet
   duplicerad hellre än att bryta upp huvudkomponenten för det här. */
function berakna(state) {
  const countryCode = state.countryCode || "SE";
  const country = COUNTRIES[countryCode];
  const form = country.forms?.enskild;
  const settings = state.settingsMap?.[countryCode] || {};
  const invoices = state.invoices || [];
  const costs = state.costs || [];
  const employees = state.employees || [];
  const personal = personalkostnad(employees);
  const payroll = personal.lon;
  const momsreg = settings.momsregistrerad !== false;

  const revenue = invoices.reduce((s, i) => s + i.amount * FX[i.currency], 0);
  const outVat = momsreg
    ? invoices.reduce((s, i) => s + (i.typ === "eub2b" || i.typ === "export" ? 0 : i.amount * FX[i.currency] * (i.vat / 100)), 0)
    : 0;
  const inVat = momsreg ? costs.reduce((s, c) => s + c.amount * FX[c.currency] * (c.vat / 100), 0) : 0;
  const costBase = costs.reduce((s, c) => s + c.amount * FX[c.currency] * (momsreg ? 1 : 1 + c.vat / 100), 0);

  let tax = null;
  if (form) {
    tax = form.compute({ revenue, costs: costBase, settings, payroll, payrollAvgifter: personal.avgifter });
  }

  const d = { revenue, outVat, inVat, vatDue: Math.max(0, outVat - inVat), costBase, tax, momsreg, count: invoices.length, perTyp: {} };
  const owed = (momsreg ? d.vatDue : 0) + (tax ? tax.owed : 0);
  return { form, d, personal, owed };
}

export default function DeladVy({ token }) {
  const [state, setState] = useState(null);
  const [fel, setFel] = useState(false);
  const [typ, setTyp] = useState("oversikt");

  useEffect(() => {
    (async () => {
      try {
        const data = await hamtaDeladRapport(token);
        if (!data) { setFel(true); return; }
        setState(data);
      } catch {
        setFel(true);
      }
    })();
  }, [token]);

  if (fel) {
    return (
      <div className="kvar"><style>{CSS}</style>
        <div className="wrap"><p className="empty">
          Länken är ogiltig, återkallad eller har gått ut. Be den som delade den om en ny.
        </p></div>
      </div>
    );
  }
  if (!state) {
    return <div className="kvar"><style>{CSS}</style><div className="wrap"><p className="empty">Hämtar…</p></div></div>;
  }

  const { form, d, personal, owed } = berakna(state);

  return (
    <div className="kvar"><style>{CSS}</style>
      <div className="wrap">
        <div className="top">
          <div className="brand"><h1>{MARKE}</h1><span>Delad, skrivskyddad rapport</span></div>
        </div>
        <div className="segbtns" style={{ margin: "16px 0" }}>
          {RAPPORTER.map((r) => (
            <button key={r.id} className="sb" data-on={typ === r.id} onClick={() => setTyp(r.id)}>{r.namn}</button>
          ))}
        </div>
        <div className="panel">
          <Rapport typ={typ} state={state} form={form} d={d} personal={personal} forecast={null} owed={owed} />
        </div>
      </div>
    </div>
  );
}
