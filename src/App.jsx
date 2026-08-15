import React, { useState, useEffect, useMemo, useRef } from "react";
import { makeStorage } from "./storage";
import { startCheckout as apiCheckout, adminAterbetala, openPortal } from "./billing";
import { supabase, hasAuth, signOut, fetchSubscription, fetchAdmin, sattNyttLosenord, bytEpost, fetchOrdrar } from "./auth";
import Login from "./Login.jsx";
import { AVDRAG, matchAvdrag, VERDICT } from "./avdrag";
import { CSS } from "./theme";
import { MARKE, TAGLINE, MG, STAPEL } from "./texter";
import { KOMMUNER, UTELAMNAT, BEGRAVNINGSAVGIFT, KYRKOAVGIFT_SNITT } from "./profil";
import Rapport, { RAPPORTER } from "./Rapport.jsx";
import Admin from "./Admin.jsx";
import { TESTKONTON, ADMIN_TESTDATA } from "./testdata";
import { VILLKOR, VILLKOR_VERSION } from "./villkor";
import { INTEGRITET, LAGRING, POLICY_VERSION, ANSVARIG } from "./integritet";
import { COUNTRIES, marginalskatt, personalkostnad, FAKTURATYPER, SENASTE_AR } from "./tax";
import { Marginalkurvan } from "./Charts.jsx";
import { kommandeDatum } from "./skattedatum";
import DeladVy from "./DeladVy.jsx";
import { skapaDelning, listaDelningar, aterkallaDelning, delaUrl } from "./dela";
import { laddaUppKvitto, hamtaKvitton, kvittoLank, raderaKvitto } from "./kvitton";
import Landing from "./Landing.jsx";

/* ============================================================
   KVAR — webbversion
   Sparar data · Prenumeration · Marginalmotor

   ARKITEKTUR
   Inga skattesatser i komponenterna. Allt i COUNTRIES.
   Nytt land = nytt objekt med en compute().
   ============================================================ */

const FX = { SEK: 1, EUR: 11.5, USD: 10.6, GBP: 13.5, NOK: 0.95, DKK: 1.54 };
const STORAGE_KEY = "kvario:state";

const PLANS = {
  free: { name: "Gratis", invoiceLimit: 5 },
  pro: { name: "Pro", invoiceLimit: Infinity, month: 99, year: 990 },
};

/* Sidan var tidigare en enda lång rulle. Flikarna delar upp den efter
   vad man faktiskt kommer för: se läget, mata in, räkna på något,
   slå upp ett avdrag, ta ut underlag, sköta kontot. */
/* Ett enda ställe som bestämmer vilket inkomstår appen räknar på.
   Alla anrop till compute() och marginalskatt() ska få detta värde,
   annars kan två siffror bredvid varandra bygga på olika års regler. */
const INKOMSTAR = new Date().getFullYear();

const FLIKAR = [
  ["oversikt", "Översikt"],
  ["fakturor", "Fakturor"],
  ["verktyg", "Verktyg"],
  ["avdrag", "Avdrag"],
  ["rapporter", "Rapporter"],
  ["konto", "Konto"],
];

/* Liten frågeknapp per sektion. Förklaringen ligger dold tills
   någon frågar — den som redan förstått ska inte behöva läsa den. */
function Info({ id, open, setOpen, children }) {
  return (
    <button className="infoBtn" data-on={open === id}
            onClick={() => setOpen(open === id ? null : id)}
            aria-label="Vad visar den här sektionen?" aria-expanded={open === id}>i</button>
  );
}

function InfoBox({ id, open, children }) {
  if (open !== id) return null;
  return <div className="infoBox">{children}</div>;
}

/* Visas när man kommer in via en återställningslänk — även för
   konton som aldrig haft ett lösenord. Sessionen från länken är
   redan giltig, den bara saknar ett nytt lösenord ännu. */
function NyttLosenordVy({ onKlart }) {
  const [losenord, setLosenord] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const submit = async () => {
    if (losenord.length < 6) return setError("Lösenordet måste vara minst 6 tecken.");
    setStatus("sending");
    setError("");
    try {
      await sattNyttLosenord(losenord);
      onKlart();
    } catch {
      setError("Kunde inte spara lösenordet. Försök igen.");
      setStatus("idle");
    }
  };

  return (
    <div className="kvar"><style>{CSS}</style>
      <div className="onboard">
        <div className="obCard">
          <div className="brand"><h1>Kvario</h1></div>
          <h2 className="obTitle">Sätt ett nytt lösenord</h2>
          <label className="authLabel">
            Lösenord
            <input type="password" value={losenord} placeholder="Minst 6 tecken"
                   onChange={(e) => setLosenord(e.target.value)}
                   onKeyDown={(e) => e.key === "Enter" && submit()}
                   autoComplete="new-password" autoFocus />
          </label>
          {error && <p className="authError">{error}</p>}
          <button className="add wide" onClick={submit} disabled={status === "sending"}>
            {status === "sending" ? "Sparar…" : "Spara lösenord"}
          </button>
        </div>
      </div>
    </div>
  );
}

const kr = (n) => Math.round(n || 0).toLocaleString("sv-SE").replace(/\u00a0/g, " ");
const pct = (n) => (n * 100).toFixed(1).replace(".", ",");

/* \u00c5rtalet tas bort n\u00e4r posten h\u00f6r till innevarande \u00e5r \u2014 det \u00e4r
   underf\u00f6rst\u00e5tt, och raderna blir l\u00e4ttare att skumma utan det. */
const visaDatum = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const iAr = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("sv-SE", iAr
    ? { day: "numeric", month: "short" }
    : { day: "numeric", month: "short", year: "numeric" });
};

const TRIAL_DAYS = 14;

const DEFAULT_STATE = {
  onboarded: false,
  trialStart: null,
  villkor: null,
  countryCode: "SE",
  form: "enskild",
  invoices: [
    { id: 1, client: "Nordkap Studio", amount: 48000, currency: "SEK", vat: 25, paid: true },
    { id: 2, client: "Lehmann GmbH", amount: 3200, currency: "EUR", vat: 25, paid: true },
    { id: 3, client: "Ravel & Co", amount: 26500, currency: "SEK", vat: 25, paid: false },
  ],
  costs: [
    { id: 1, label: "Dator", amount: 18900, currency: "SEK", vat: 25 },
    { id: 2, label: "Kontorsplats", amount: 24000, currency: "SEK", vat: 25 },
  ],
  settingsMap: { SE: { kommunalskatt: 32.0, avgiftslage: "full", pension: 0 } },
  employees: [],
  paidOnly: false,
  hourlyRate: 850,
  plan: "free",
  setAside: 0,
};

const delaToken = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("dela") : null;

export default function KvarioApp() {
  const [view, setView] = useState("landing");
  const [flik, setFlik] = useState("oversikt");
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!hasAuth);
  const [sub, setSub] = useState(null);
  const [authLinkError, setAuthLinkError] = useState("");
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [delningar, setDelningar] = useState([]);
  const [delningKopierad, setDelningKopierad] = useState(null);
  const [realAdmin, setRealAdmin] = useState(false);
  const [adminData, setAdminData] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [state, setState] = useState(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [showPaywall, setShowPaywall] = useState(false);
  const [billing, setBilling] = useState("year");
  const [what, setWhat] = useState("12000");
  const [avdragQ, setAvdragQ] = useState("");
  const [openAvdrag, setOpenAvdrag] = useState(null);
  const [openChart, setOpenChart] = useState(null);
  const [openInfo, setOpenInfo] = useState(null);
  const [showVillkor, setShowVillkor] = useState(false);
  const [acceptar, setAcceptar] = useState(false);
  const [villkorLast, setVillkorLast] = useState(false);
  const [visaVillkorFot, setVisaVillkorFot] = useState(false);
  const [visaPolicy, setVisaPolicy] = useState(false);
  const [rapport, setRapport] = useState(null);
  const [demoAdmin, setDemoAdmin] = useState(false);
  const [samtycke, setSamtycke] = useState(undefined);
  const [statistik, setStatistik] = useState(false);
  const [mode, setMode] = useState("business");
  const timer = useRef(null);
  // Det vi själva senast skrev till molnet. Skiljer sig molnets
  // version från den har en annan enhet ändrat något.
  const senastSkrivet = useRef(null);

  const { countryCode, invoices, costs, paidOnly, hourlyRate, plan, setAside } = state;
  const employees = state.employees || [];
  const personal = useMemo(() => personalkostnad(employees), [employees]);
  const payroll = personal.lon;
  const country = COUNTRIES[countryCode];
  const form = country.forms ? country.forms[state.form] || country.forms.enskild : null;

  /* ---------- Provperiod ----------
     Alla börjar med full Pro. Efter 14 dagar faller man ner till
     gratisnivån. Att förlora något känns — att aldrig ha haft det
     gör det inte. */
  const trial = useMemo(() => {
    // Servern har alltid företräde. Lokal trialStart används bara
    // när appen körs utan konto, annars kunde den nollställas.
    const start = sub?.trial_start ? new Date(sub.trial_start).getTime() : state.trialStart;
    if (!start) return { active: false, started: false, daysLeft: 0 };
    const elapsed = (Date.now() - start) / 86400000;
    const daysLeft = Math.max(0, Math.ceil(TRIAL_DAYS - elapsed));
    return { active: daysLeft > 0, started: true, daysLeft, ended: daysLeft <= 0 };
  }, [state.trialStart, sub]);

  /* Planen ensam räcker inte. Missas en webhook — servern startar om,
     Stripe får timeout, betalningen slutar gå igenom — skulle raden
     ligga kvar som "pro" för alltid. Perioden är den hårda gränsen:
     har den passerat med marginal är prenumerationen inte längre
     giltig, oavsett vad plan-kolumnen säger. Marginalen finns för att
     förnyelsen sker precis vid periodslutet och webhooken kan dröja. */
  const NADSDAGAR = 3;
  const periodGiltig = !sub?.current_period_end
    || Date.now() < new Date(sub.current_period_end).getTime() + NADSDAGAR * 86400000;
  const subscribed = (sub?.plan || plan) === "pro" && periodGiltig;
  const arAdmin = realAdmin || demoAdmin;
  const isPro = subscribed || trial.active;
  const settings = state.settingsMap[countryCode] || {};
  const patch = (p) => setState((s) => ({ ...s, ...p }));

  /* ---------- Samtycke till lagring ----------
     Ligger utanför användarens data, eftersom valet måste gälla
     redan innan någon loggat in. */
  useEffect(() => {
    (async () => {
      try {
        const r = await makeStorage(null).get("kvario:samtycke");
        if (r?.value) {
          const v = JSON.parse(r.value);
          setSamtycke(v);
          setStatistik(!!v.statistik);
        } else setSamtycke(null);
      } catch { setSamtycke(null); }
    })();
  }, []);

  const sparaSamtycke = async (statistikVal) => {
    const v = { statistik: statistikVal, version: POLICY_VERSION, at: new Date().toISOString() };
    setSamtycke(v);
    setStatistik(statistikVal);
    try { await makeStorage(null).set("kvario:samtycke", JSON.stringify(v)); } catch {}
  };

  /* ---------- Session ----------
     En redan använd eller utgången länk ger annars inget besked —
     man hamnar bara tillbaka på landningssidan utan förklaring,
     vilket lätt misstas för att inloggningen "inte gjorde något". */
  useEffect(() => {
    if (!hasAuth) return;
    if (window.location.hash.includes("error=")) {
      const p = new URLSearchParams(window.location.hash.slice(1));
      setAuthLinkError(
        p.get("error_description")?.replace(/\+/g, " ") || "Länken kunde inte användas."
      );
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id || null;
  const store = useMemo(() => makeStorage(userId), [userId]);

  /* ---------- Ladda data och prenumeration ---------- */
  useEffect(() => {
    if (!authReady) return;
    if (hasAuth && !userId) { setLoaded(true); return; }
    let alive = true;
    (async () => {
      setLoaded(false);
      try {
        const r = await store.get(STORAGE_KEY);
        if (alive && r?.value) {
          setState({ ...DEFAULT_STATE, ...JSON.parse(r.value) });
          senastSkrivet.current = r.value;
        }
      } catch { /* inget sparat än */ }
      if (hasAuth && userId) {
        try {
          const s = await fetchSubscription(userId);
          if (alive) setSub(s);
        } catch { /* faller tillbaka på lokal provperiod */ }
        try {
          const a = await fetchAdmin(userId);
          if (alive) setRealAdmin(a);
        } catch { /* inte admin */ }
      }
      if (alive) setLoaded(true);
    })();
    return () => { alive = false; };
  }, [authReady, userId, store]);

  /* ---------- Spara ---------- */
  useEffect(() => {
    if (!loaded) return;
    setSaveState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const json = JSON.stringify(state);
        await store.set(STORAGE_KEY, json);
        senastSkrivet.current = json;
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1600);
      } catch {
        setSaveState("error");
      }
    }, 600);
    return () => clearTimeout(timer.current);
  }, [state, loaded, store]);

  /* ---------- Hämta om när appen kommer i förgrunden ----------
     Hela datan skrivs som ett block. Ligger appen öppen i mobilen
     medan något ändras på webben, och man sedan rör mobilen, skulle
     mobilens gamla block skriva över det nya — ändringen vore borta
     utan att någon märkte det.

     Därför läses datan om när fliken eller appen blir synlig igen.
     Skiljer sig molnets version från det vi själva senast skrev har
     någon annan enhet ändrat, och då är den versionen den färskare.
     Det är ingen fullständig synk i realtid, men det stänger fönstret
     där data faktiskt går förlorad. */
  useEffect(() => {
    if (!hasAuth || !userId || !loaded) return;

    const hamtaOm = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await store.get(STORAGE_KEY);
        if (!r?.value || r.value === senastSkrivet.current) return;
        senastSkrivet.current = r.value;
        setState({ ...DEFAULT_STATE, ...JSON.parse(r.value) });
      } catch { /* nätet nere — behåll det vi har */ }
    };

    document.addEventListener("visibilitychange", hamtaOm);
    window.addEventListener("focus", hamtaOm);
    return () => {
      document.removeEventListener("visibilitychange", hamtaOm);
      window.removeEventListener("focus", hamtaOm);
    };
  }, [userId, loaded, store]);

  const setSetting = (k, v) =>
    setState((s) => ({ ...s, settingsMap: { ...s.settingsMap, [countryCode]: { ...s.settingsMap[countryCode], [k]: v } } }));

  /* ---------- Delade rapporter ----------
     Bara för riktiga inloggade konton — en delad länk pekar mot
     user_state via en token, och den tabellen finns bara för dig
     som har ett konto. */
  const laddaDelningar = async () => {
    try { setDelningar(await listaDelningar(session.user.id)); }
    catch (e) { console.error("Kunde inte hämta delningar", e); }
  };

  useEffect(() => {
    if (hasAuth && session?.user?.id) laddaDelningar();
  }, [session?.user?.id]);

  const skapaNyDelning = async () => {
    try {
      await skapaDelning(session.user.id);
      await laddaDelningar();
    } catch (e) {
      window.alert("Kunde inte skapa länken. Försök igen.");
    }
  };

  const kopieraDelning = (token) => {
    navigator.clipboard?.writeText(delaUrl(token));
    setDelningKopierad(token);
    setTimeout(() => setDelningKopierad(null), 2000);
  };

  const taBortDelning = async (token) => {
    if (!window.confirm("Länken slutar fungera direkt. Vill du återkalla den?")) return;
    try {
      await aterkallaDelning(token);
      await laddaDelningar();
    } catch (e) {
      window.alert("Kunde inte återkalla länken.");
    }
  };

  /* ---------- Adminpanelens data ----------
     RLS släpper igenom admins här (se ar_admin() i schema.sql), så
     det går att fråga direkt från klienten — ingen serveromväg
     behövs för att LÄSA. Bara återbetalningen kräver servern, för
     att den pratar med Stripe. */
  const laddaAdminData = async () => {
    setAdminLoading(true);
    try {
      const [{ data: kunder }, { data: ordrar }, { data: aterbetalningar }] = await Promise.all([
        supabase.rpc("admin_kunder"),
        supabase.from("orders").select("*").order("betald_at", { ascending: false }).limit(500),
        supabase.from("aterbetalningar").select("*").order("begard_at", { ascending: false }),
      ]);
      setAdminData({ kunder: kunder || [], ordrar: ordrar || [], aterbetalningar: aterbetalningar || [] });
    } catch (e) {
      console.error("Kunde inte hämta admindata", e);
    }
    setAdminLoading(false);
  };

  useEffect(() => {
    if (realAdmin && !demoAdmin) laddaAdminData();
  }, [realAdmin, demoAdmin]);

  /* bekraftar kommer antingen från Ordrar-fliken ({order, belopp})
     eller från Återbetalningar-fliken ({begaran, belopp}) — se
     Admin.jsx. begaran har bara order_id, så ordernumret slås upp
     mot ordrarna vi redan hämtat. */
  const utforAterbetalning = async (bekraftar) => {
    const ordernummer = bekraftar.order?.ordernummer
      || adminData?.ordrar.find((o) => o.id === bekraftar.begaran?.order_id)?.ordernummer;
    if (!ordernummer) return window.alert("Hittar inte ordern för den här återbetalningen.");
    try {
      await adminAterbetala({
        accessToken: session.access_token,
        ordernummer,
        belopp: bekraftar.belopp / 100,
        orsak: bekraftar.begaran?.orsak,
        begaranId: bekraftar.begaran?.id,
      });
      await laddaAdminData();
    } catch (e) {
      window.alert(e.message);
    }
  };

  /* ---------- Räkna ---------- */
  const d = useMemo(() => {
    const used = paidOnly ? invoices.filter((i) => i.paid) : invoices;
    const momsreg = settings.momsregistrerad !== false;

    const revenue = used.reduce((s, i) => s + i.amount * FX[i.currency], 0);

    /* Utan momsregistrering: ingen moms tas ut på fakturorna, och
       momsen på inköpen får inte dras av. Då är hela inköpspriset
       inklusive moms en kostnad i verksamheten. */
    /* Moms tas bara ut på försäljning som är momspliktig i Sverige.
       EU-företag har omvänd betalningsskyldighet, export ligger utanför. */
    const outVat = momsreg
      ? used.reduce((s, i) => {
          const t = FAKTURATYPER[i.typ || "se"];
          return s + (t.moms ? i.amount * FX[i.currency] * (i.vat / 100) : 0);
        }, 0)
      : 0;

    const perTyp = {};
    used.forEach((i) => {
      const k = i.typ || "se";
      perTyp[k] = (perTyp[k] || 0) + i.amount * FX[i.currency];
    });
    const inVat = momsreg
      ? costs.reduce((s, c) => s + c.amount * FX[c.currency] * (c.vat / 100), 0)
      : 0;
    const costBase = costs.reduce(
      (s, c) => s + c.amount * FX[c.currency] * (momsreg ? 1 : 1 + c.vat / 100), 0);
    const unpaid = invoices.filter((i) => !i.paid).reduce((s, i) => s + i.amount * FX[i.currency], 0);
    let tax = null;
    if (country.taxModule === "live" && form) {
      // Året styr vilka satser som används. Saknas det i tabellen
      // säger tax.js ifrån via saknasAr i stället för att tyst
      // räkna vidare på fjolårets siffror. Marginalen måste få samma
      // år, annars kan den räknas med andra satser än siffrorna den
      // står bredvid.
      tax = form.compute({ revenue, costs: costBase, settings, payroll, payrollAvgifter: personal.avgifter, ar: INKOMSTAR });
      tax.marginal = marginalskatt(form, { revenue, costs: costBase, settings, payroll, payrollAvgifter: personal.avgifter, ar: INKOMSTAR });
    }
    return { revenue, outVat, inVat, vatDue: Math.max(0, outVat - inVat), costBase, unpaid, tax, count: used.length, momsreg, perTyp };
  }, [invoices, costs, paidOnly, countryCode, settings, state.form, payroll, personal.avgifter]);

  /* Nyast först i listorna. Utan sortering står posterna i den
     ordning de matats in, vilket ser slumpmässigt ut så snart
     datumen syns. Poster utan datum hamnar sist. */
  const efterDatum = (lista) =>
    [...lista].sort((a, b) => (b.datum || "").localeCompare(a.datum || ""));

  /* ---------- Återkommande fakturor och kostnader ----------
     Ingen bakgrundsjobb — bara ett engångsklick per ny månad, spärrat
     mot dubbletter med en enda "senast tillagd"-månad i state. */
  const manadNyckel = (dt = new Date()) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
  const aterkommandeInv = invoices.filter((i) => i.recurring);
  const aterkommandeCost = costs.filter((c) => c.recurring);
  const kanLaggaTillAterkommande =
    (aterkommandeInv.length > 0 || aterkommandeCost.length > 0) &&
    state.senastAterkommandeManad !== manadNyckel();

  const laggTillAterkommande = () => {
    const nyaInv = aterkommandeInv.map((i, idx) => ({ ...i, id: Date.now() + idx, paid: false }));
    const nyaCost = aterkommandeCost.map((c, idx) => ({ ...c, id: Date.now() + 1000 + idx }));
    patch({
      invoices: [...invoices, ...nyaInv],
      costs: [...costs, ...nyaCost],
      senastAterkommandeManad: manadNyckel(),
    });
  };

  /* EU-handel hämtas ur fakturorna — säljer du till företag i EU
     tidigareläggs momsdeklarationen med två och en halv månad, och
     det är inget man vill upptäcka i efterhand. */
  const skattedatum = useMemo(() => kommandeDatum({
    momsregistrerad: d.momsreg,
    momsperiod: settings.momsperiod || "helar",
    euHandel: (d.perTyp?.eub2b || 0) > 0,
  }), [d.momsreg, settings.momsperiod, d.perTyp]);

  /* ---------- Prognos ---------- */
  const forecast = useMemo(() => {
    if (!d.tax) return null;
    const now = new Date();
    const elapsed = (now.getMonth() + now.getDate() / 30) / 12;
    if (elapsed < 0.08) return null;
    const projRevenue = d.revenue / elapsed;
    const projCosts = d.costBase / elapsed;
    const projOverskott = Math.max(0, projRevenue - projCosts);
    const projTax = form.compute({ revenue: projRevenue, costs: projCosts, settings, payroll, payrollAvgifter: personal.avgifter, ar: INKOMSTAR });

    // Testa mot det faktiska utfallet i båda scenarierna, inte mot
    // överskottet — trösklarna mäts på olika underlag.
    const hits = (form.milestones || [])
      .filter((m) => m.hit(projTax) && !m.hit(d.tax));

    return { projRevenue, projOverskott, projKvar: projTax.kvar, hits, elapsed };
  }, [d, countryCode, settings, state.form]);

  /* ---------- MARGINALMOTORN ---------- */
  const margin = useMemo(() => {
    if (!d.tax) return null;
    const m = d.tax.marginal;
    const amount = Math.max(0, parseFloat(String(what).replace(",", ".")) || 0);
    const vatRate = country.defaultVat / 100;
    const rate = Math.max(1, hourlyRate);

    if (mode === "business") {
      // Utan momsregistrering finns ingen moms att få tillbaka —
      // hela priset är avdragsgill kostnad i stället.
      const exVat = d.momsreg ? amount / (1 + vatRate) : amount;
      const vatBack = amount - exVat;
      const taxSaving = exVat * m;
      return {
        kind: "business",
        sticker: amount,
        real: exVat - taxSaving,
        vatBack, taxSaving,
        hours: exVat / rate,
        billNeeded: exVat,
      };
    }
    // Privat köp: för att ha beloppet i handen måste vinsten först
    // passera skatt och egenavgifter.
    const gross = amount / Math.max(0.05, 1 - m);
    return { kind: "private", sticker: amount, real: amount, billNeeded: gross, hours: gross / rate };
  }, [what, mode, d, hourlyRate, countryCode]);

  /* ---------- Stapeln ----------
     totalInvoiced är det fulla fakturerade beloppet inklusive moms,
     till "av X kr infakturerat". Stapelns segment ska däremot summera
     till nettomomsen (vatDue) — annars läcker den återbetalda ingående
     momsen in i restposten och gör siffran i tooltipen fel. */
  const totalInvoiced = d.revenue + d.outVat;
  const total = d.revenue + d.vatDue;
  const segments = [
    ...(d.momsreg
      ? [{ key: "vat", label: country.vatName, amount: d.vatDue, color: "var(--band-1)", note: STAPEL.momsNot }]
      : []),
    { key: "costs", label: STAPEL.egnaKostnader, amount: d.costBase, color: "var(--band-2)", note: STAPEL.kostnadNot },
    ...(d.tax ? d.tax.lines.map((l, i) => ({ ...l, color: i === 0 ? "var(--band-3)" : "var(--band-4)" })) : []),
  ];
  const shown = segments.reduce((s, x) => s + x.amount, 0);
  const remainder = Math.max(0, total - shown);
  const barTotal = Math.max(1, total);

  /* ---------- Åtgärder ----------
     Datum förifylls med dagens och går att ändra. Utan datum går
     varken momsperiod eller årsjämförelse att räkna fram, och äldre
     poster utan datum räknas som innevarande år. */
  const idag = () => new Date().toISOString().slice(0, 10);
  const [inv, setInv] = useState({ client: "", amount: "", vat: 25, currency: "SEK", typ: "se", recurring: false, datum: idag() });
  const [cost, setCost] = useState({ label: "", amount: "", vat: 25, currency: "SEK", recurring: false, datum: idag() });
  const [emp, setEmp] = useState({ name: "", monthly: "", fodelsear: "", vaxa: false });

  const addEmployee = () => {
    const m = parseFloat(String(emp.monthly).replace(",", "."));
    if (!emp.name.trim() || !m || m <= 0) return;
    patch({ employees: [...employees, {
      id: Date.now(), name: emp.name.trim(), monthly: m,
      fodelsear: parseInt(emp.fodelsear) || null, vaxa: !!emp.vaxa,
    }] });
    setEmp({ name: "", monthly: "", fodelsear: "", vaxa: false });
  };
  useEffect(() => {
    setInv((s) => ({ ...s, vat: country.defaultVat, currency: country.currency }));
    setCost((s) => ({ ...s, vat: country.defaultVat, currency: country.currency }));
  }, [countryCode]);

  const limit = isPro ? Infinity : PLANS.free.invoiceLimit;
  const atLimit = invoices.length >= limit;

  /* Vägledning som dyker upp medan användaren skriver in en kostnad.
     Frågan "får jag dra av det här?" ställs i just det ögonblicket. */
  const costHint = useMemo(() => {
    if (cost.label.trim().length < 3) return null;
    return matchAvdrag(cost.label)[0] || null;
  }, [cost.label]);

  const addInvoice = () => {
    if (atLimit) return setShowPaywall(true);
    const a = parseFloat(String(inv.amount).replace(",", "."));
    if (!inv.client.trim() || !a || a <= 0) return;
    patch({ invoices: [...invoices, { id: Date.now(), client: inv.client.trim(), amount: a, currency: inv.currency, vat: +inv.vat, paid: false, recurring: !!inv.recurring, datum: inv.datum || idag() }] });
    setInv({ ...inv, client: "", amount: "" });
  };
  const addCost = () => {
    const a = parseFloat(String(cost.amount).replace(",", "."));
    if (!cost.label.trim() || !a || a <= 0) return;
    patch({ costs: [...costs, { id: Date.now(), label: cost.label.trim(), amount: a, currency: cost.currency, vat: +cost.vat, recurring: !!cost.recurring, datum: cost.datum || idag() }] });
    setCost({ ...cost, label: "", amount: "" });
  };

  const owed = (d.momsreg ? d.vatDue : 0) + (d.tax ? d.tax.owed : 0);

  /* ---------- Checkout ----------
     Riktig betalning kräver ett riktigt konto — subscriptions har en
     foreign key mot auth.users. Bara "unconfigured" (ingen server,
     t.ex. lokal utveckling) faller tillbaka på simulerat Pro — ett
     verkligt fel ska visas, aldrig ge gratis Pro tyst. */
  const [checkoutFel, setCheckoutFel] = useState("");
  const startCheckout = async () => {
    setCheckoutFel("");
    if (!session?.user?.id) { patch({ plan: "pro" }); setShowPaywall(false); return; }
    const r = await apiCheckout(session.user.id, billing);
    if (r.ok) return; // sidan navigerar bort till Stripe nu
    if (r.reason === "unconfigured") { patch({ plan: "pro" }); setShowPaywall(false); return; }
    setCheckoutFel(r.message || "Kunde inte starta betalningen. Försök igen om en stund.");
  };

  /* ---------- Hantera prenumeration ----------
     Uppsägning och kortbyte sköts av Stripes egen portal. Bygg
     inte det själv. */
  const hanteraPrenumeration = () => {
    if (session?.user?.id) openPortal(session.user.id);
  };

  /* ---------- Begär återbetalning ----------
     Kunden får själv skapa en rad — RLS tillåter bara insert på sin
     egen (se schema.sql). Automatisk-flaggan är bara en signal till
     adminpanelen om att begäran ligger inom den lagstadgade
     14-dagarsfristen och bör godkännas utan vidare bedömning. */
  const [refundOrsak, setRefundOrsak] = useState("");
  const [refundStatus, setRefundStatus] = useState("idle");
  const [refundFel, setRefundFel] = useState("");
  const [refundKlar, setRefundKlar] = useState(false);

  const begarAterbetalning = async () => {
    if (!session?.user?.id) return;
    setRefundStatus("sending");
    setRefundFel("");
    try {
      const { data: order, error: orderFel } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", session.user.id)
        .order("betald_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (orderFel) throw orderFel;
      if (!order) { setRefundFel("Hittar ingen betalning på ditt konto."); setRefundStatus("idle"); return; }

      const inom14Dagar = order.betald_at
        && (Date.now() - new Date(order.betald_at).getTime()) / 86400000 <= 14;
      const automatisk = inom14Dagar && !order.angerratt_samtycke;

      const { error } = await supabase.from("aterbetalningar").insert({
        order_id: order.id,
        user_id: session.user.id,
        belopp_ore: order.belopp_ore - (order.aterbetalt_ore || 0),
        orsak: refundOrsak.trim() || null,
        automatisk,
      });
      if (error) throw error;
      setRefundKlar(true);
    } catch (e) {
      setRefundFel("Kunde inte skicka begäran. Försök igen om en stund.");
    }
    setRefundStatus("idle");
  };

  /* ---------- Kvitton ----------
     Bara för inloggade konton: filerna ligger i Supabase Storage
     under en mapp per användare. Utan konto finns ingen mapp att
     lägga dem i, och de skulle ändå inte följa med mellan enheter. */
  const [kvitton, setKvitton] = useState([]);
  const [kvittoFel, setKvittoFel] = useState("");
  const [laddarKvitto, setLaddarKvitto] = useState(null);

  const laddaKvitton = async () => {
    if (!session?.user?.id) return;
    try { setKvitton(await hamtaKvitton(session.user.id)); }
    catch (e) { console.error("Kunde inte hämta kvitton", e); }
  };

  useEffect(() => { if (hasAuth && session?.user?.id) laddaKvitton(); }, [session?.user?.id]);

  const kvittonFor = (kostnadId) => kvitton.filter((k) => k.kostnad_id === String(kostnadId));

  const valjKvitto = async (kostnadId, fil) => {
    if (!fil || !session?.user?.id) return;
    setKvittoFel("");
    setLaddarKvitto(kostnadId);
    try {
      await laddaUppKvitto({ userId: session.user.id, kostnadId, fil });
      await laddaKvitton();
    } catch (e) {
      setKvittoFel(
        e.message?.includes("Bucket not found")
          ? "Lagringsplatsen saknas. Skapa en privat bucket som heter \"kvitton\" i Supabase."
          : e.message || "Kunde inte ladda upp filen."
      );
    }
    setLaddarKvitto(null);
  };

  const oppnaKvitto = async (k) => {
    try { window.open(await kvittoLank(k.sokvag), "_blank", "noopener"); }
    catch { setKvittoFel("Kunde inte öppna filen."); }
  };

  const taBortKvitto = async (k) => {
    if (!window.confirm(`Radera ${k.filnamn}? Underlag ska sparas i sju år enligt bokföringslagen.`)) return;
    try { await raderaKvitto(k); await laddaKvitton(); }
    catch { setKvittoFel("Kunde inte radera filen."); }
  };

  /* ---------- Kontouppgifter ---------- */
  const [ordrar, setOrdrar] = useState([]);
  const [nyEpost, setNyEpost] = useState("");
  const [nyttLosen, setNyttLosen] = useState("");
  const [kontoBesked, setKontoBesked] = useState("");
  const [kontoFel, setKontoFel] = useState("");

  useEffect(() => {
    if (!hasAuth || !session?.user?.id) return;
    fetchOrdrar(session.user.id).then(setOrdrar).catch(() => {});
  }, [session?.user?.id]);

  const sparaNyEpost = async () => {
    setKontoBesked(""); setKontoFel("");
    if (!/^\S+@\S+\.\S+$/.test(nyEpost)) return setKontoFel("Skriv en giltig e-postadress.");
    try {
      await bytEpost(nyEpost.trim());
      setNyEpost("");
      setKontoBesked("Vi skickade en bekräftelselänk till den nya adressen. Bytet sker när du klickat på den.");
    } catch (e) {
      setKontoFel(e.message || "Kunde inte byta e-post.");
    }
  };

  const sparaNyttLosen = async () => {
    setKontoBesked(""); setKontoFel("");
    if (nyttLosen.length < 6) return setKontoFel("Lösenordet måste vara minst 6 tecken.");
    try {
      await sattNyttLosenord(nyttLosen);
      setNyttLosen("");
      setKontoBesked("Lösenordet är bytt.");
    } catch (e) {
      setKontoFel(e.message || "Kunde inte byta lösenord.");
    }
  };

  const exportAllt = () => {
    const paket = {
      exporterad: new Date().toISOString(),
      konto: session?.user?.email || "ej inloggad",
      villkor: state.villkor || null,
      samtycke: samtycke || null,
      data: { ...state },
    };
    const blob = new Blob([JSON.stringify(paket, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kvario-min-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const raderaAllt = async () => {
    if (!window.confirm("Detta raderar alla dina fakturor, kostnader, anställda och inställningar. Det går inte att ångra. Vill du fortsätta?")) return;
    try { await store.set(STORAGE_KEY, JSON.stringify({ ...DEFAULT_STATE, onboarded: false })); } catch {}
    setState({ ...DEFAULT_STATE, onboarded: false });
    setVisaData(false);
  };

  const exportCsv = () => {
    if (!isPro) return setShowPaywall(true);
    const rows = [["Typ", "Namn", "Belopp", "Valuta", "Moms %", "Status"]];
    invoices.forEach((i) => rows.push(["Faktura", i.client, i.amount, i.currency, i.vat, i.paid ? "Betald" : "Obetald"]));
    costs.forEach((c) => rows.push(["Kostnad", c.label, c.amount, c.currency, c.vat, ""]));
    const blob = new Blob(["\uFEFF" + rows.map((r) => r.join(";")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kvario-export.csv";
    a.click();
  };

  const SamtyckesRuta = () =>
    samtycke === null ? (
      <div className="samtycke">
        <div className="samtyckeInner">
          <p>
            <strong>Vi lagrar bara det som behövs.</strong> Inloggningen kräver en sessionsnyckel
            i din webbläsare. Vi använder inga annonscookies och spårar dig inte mellan webbplatser.
            Du får gärna dela anonym användningsstatistik så att vi vet vad vi ska förbättra — men
            det är helt frivilligt.
          </p>
          <div className="samtyckeKnappar">
            <button className="add" onClick={() => sparaSamtycke(true)}>Tillåt statistik</button>
            <button className="authAlt smal" onClick={() => sparaSamtycke(false)}>Endast nödvändigt</button>
          </div>
        </div>
      </div>
    ) : null;

  if (delaToken) return <DeladVy token={delaToken} />;

  if (passwordRecovery) return <NyttLosenordVy onKlart={() => setPasswordRecovery(false)} />;

  if (!authReady) return <div className="kvar"><style>{CSS}</style><div className="wrap"><p className="empty">Ett ögonblick…</p></div></div>;

  if (hasAuth && !session) {
    if (view === "landing" && !authLinkError)
      return (
        <div className="kvar">
          <style>{CSS}</style>
          <SamtyckesRuta />
          <Landing onStart={() => setView("login")} />
        </div>
      );
    return (
      <div className="kvar">
        <style>{CSS}</style>
        <SamtyckesRuta />
        {authLinkError && (
          <div className="alert" style={{ maxWidth: 420, margin: "16px auto 0" }}>
            <span className="bang">!</span>
            <p>
              <strong>Länken kunde inte användas.</strong> {authLinkError.includes("expired") || authLinkError.includes("invalid")
                ? "Den är antingen redan använd eller för gammal — varje länk fungerar bara en gång. Be om en ny nedan."
                : authLinkError}{" "}
              <button className="linkbtn" onClick={() => setAuthLinkError("")}>Stäng</button>
            </p>
          </div>
        )}
        <Login
          onBack={() => { setAuthLinkError(""); setView("landing"); }}
          onTestkonto={undefined}
        />
      </div>
    );
  }

  if (!loaded) return <div className="kvar"><style>{CSS}</style><div className="wrap"><p className="empty">Hämtar din data…</p></div></div>;

  /* Administratörer ser bara adminvyn. Ingen onboarding, ingen
     provperiod, inget kundgränssnitt — rollen avgör hela vyn. */
  if (arAdmin) {
    return (
      <div className="kvar">
        <style>{CSS}</style>
        <Admin
          data={demoAdmin ? ADMIN_TESTDATA : (adminData || { kunder: [], ordrar: [], aterbetalningar: [] })}
          epost={session?.user?.email}
          onStang={() => { setDemoAdmin(false); signOut(); }}
          onAterbetala={demoAdmin
            ? () => window.alert("Demoläge — ingen riktig återbetalning görs. Logga in som en riktig admin för att testa på riktigt.")
            : utforAterbetalning}
          onUtskick={() => window.alert(
            "Utskick kräver Resend, som väntar på din domän. Sätt RESEND_API_KEY och de övriga e-postvariablerna på servern när den är klar — se README."
          )}
        />
      </div>
    );
  }

  /* ---------- ONBOARDING: land väljs en gång ---------- */
  if (!state.onboarded) {
    return (
      <div className="kvar">
        <style>{CSS}</style>
        <SamtyckesRuta />
        <div className="onboard">
          <div className="obCard">
            <div className="brand"><h1>{MARKE}</h1></div>
            <h2 className="obTitle">Ett sista steg</h2>
            <p className="obLead">
              Kvario är byggt för enskild firma. Vinsten är din inkomst, ett
              skattesteg — enkelt att se, enkelt att lita på.
            </p>

            <p className="obTrial">
              Du får <b>{TRIAL_DAYS} dagar med Kvario Pro</b> direkt — allt upplåst,
              inget kort, ingen bindning.
            </p>

            <button className={`villkorKnapp ${villkorLast ? "last" : ""}`}
                    aria-expanded={showVillkor}
                    onClick={() => { setShowVillkor(!showVillkor); setVillkorLast(true); }}>
              <span className="vkIkon">{villkorLast ? "✓" : "1"}</span>
              <span className="vkText">
                <b>{villkorLast ? "Villkoren lästa" : "Läs användarvillkoren"}</b>
                <small>{showVillkor ? "Tryck för att fälla ihop" : villkorLast ? "Tryck för att läsa igen" : "Fälls ut här nedanför"}</small>
              </span>
              <span className="vkPil">{showVillkor ? "▲" : "▼"}</span>
            </button>

            {showVillkor && (
              <div className="villkorInline">
                <div className="eyebrow">Villkor {VILLKOR_VERSION} · Integritetspolicy {POLICY_VERSION}</div>
                {VILLKOR.map((v) => (
                  <div key={v.h}>
                    <h4>{v.h}</h4>
                    <p>{v.p}</p>
                  </div>
                ))}
                <h4 style={{ marginTop: 26 }}>Integritetspolicy</h4>
                {INTEGRITET.map((v) => (
                  <div key={v.h}>
                    <h4>{v.h}</h4>
                    <p>{v.p}</p>
                  </div>
                ))}
                <button className="linkbtn" onClick={() => setShowVillkor(false)}>Fäll ihop</button>
              </div>
            )}

            <div className="obForm">
              <div className="eyebrow">Moms</div>
              <div className="obFormList">
                {[[true, "Momsregistrerad", "Du lägger moms på fakturorna och drar av momsen på inköp."],
                  [false, "Inte momsregistrerad", "Ingen moms på fakturorna. Momsen på dina inköp blir en kostnad i stället för ett avdrag. Gäller upp till 120 000 kr omsättning."]]
                  .map(([v, n, b]) => (
                  <button key={String(v)} className="obOpt"
                          data-on={(settings.momsregistrerad !== false) === v}
                          onClick={() => setSetting("momsregistrerad", v)}>
                    <span className="obName">{n}</span>
                    <span className="obMeta">{b}</span>
                  </button>
                ))}
              </div>
            </div>

            <label className={`villkorRad ${villkorLast ? "" : "av"}`}>
              <input type="checkbox" checked={acceptar} disabled={!villkorLast}
                     onChange={(e) => setAcceptar(e.target.checked)} />
              <span>
                Jag har läst och godkänner användarvillkoren och integritetspolicyn, och förstår
                att Kvario är ett beräkningsverktyg — inte skatterådgivning.
              </span>
            </label>

            <button
              className="add wide"
              disabled={!acceptar}
              onClick={() => patch({
                onboarded: true,
                trialStart: state.trialStart || Date.now(),
                villkor: { version: VILLKOR_VERSION, at: new Date().toISOString(), last: true },
              })}
            >
              Kom igång
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="kvar">
      <style>{CSS}</style>

      {rapport && (
        <div className="rapportVy">
          <div className="rapportVerktyg">
            <button className="linkbtn" onClick={() => setRapport(null)}>← Tillbaka</button>
            <div className="rapportKnappar">
              <button className="add" onClick={() => window.print()}>Ladda ner som PDF</button>
            </div>
          </div>
          <Rapport
            typ={rapport}
            state={state}
            form={form}
            d={d}
            personal={personal}
            forecast={forecast}
            owed={owed}
            email={session?.user?.email}
          />
        </div>
      )}

      {!rapport && <SamtyckesRuta />}
      <div className="wrap" style={rapport ? { display: "none" } : undefined}>

        {/* HEADER */}
        <div className="top">
          <div className="brand">
            <h1>{MARKE}</h1>
            <span>{TAGLINE}</span>
          </div>
          <div className="topRight">
            <span className={`save save-${saveState}`}>
              {saveState === "saving" ? "Sparar…" : saveState === "saved" ? "Sparat" : saveState === "error" ? "Kunde inte spara" : ""}
            </span>
            {subscribed ? (
              <button className="badge" onClick={() => setFlik("konto")}>Pro</button>
            ) : trial.active ? (
              <button className="trialBadge" onClick={() => setShowPaywall(true)}>
                Pro · {trial.daysLeft} {trial.daysLeft === 1 ? "dag" : "dagar"} kvar
              </button>
            ) : (
              <button className="upgrade" onClick={() => setShowPaywall(true)}>Uppgradera</button>
            )}
            {hasAuth && session && (
              <button className="linkbtn" onClick={signOut} title={session.user.email}>Logga ut</button>
            )}
          </div>
        </div>


        {!subscribed && trial.started && trial.active && trial.daysLeft <= 5 && (
          <div className="trialBar">
            <p>
              <strong>{trial.daysLeft} {trial.daysLeft === 1 ? "dag" : "dagar"} kvar av din provperiod.</strong>{" "}
              Sen försvinner marginalräknaren och årsprognosen. Allt du lagt in ligger kvar.
            </p>
            <button className="add" onClick={() => setShowPaywall(true)}>Behåll Pro</button>
          </div>
        )}

        {!subscribed && trial.ended && (
          <div className="trialBar ended">
            <p>
              <strong>Din provperiod är slut.</strong>{" "}
              Du kan fortsätta gratis — uträkningen "kvar till dig" är kvar för alltid.
              Marginalräknaren och årsprognosen är låsta.
            </p>
            <button className="add" onClick={() => setShowPaywall(true)}>Lås upp igen</button>
          </div>
        )}

        {/* FLIKAR */}
        <nav className="flikar">
          {FLIKAR.map(([k, etikett]) => (
            <button key={k} className="flik" data-on={flik === k} onClick={() => setFlik(k)}>
              {etikett}
              {k === "fakturor" && kanLaggaTillAterkommande && <span className="flikPrick">↻</span>}
            </button>
          ))}
        </nav>

        {/* ---------- ÖVERSIKT ---------- */}
        {flik === "oversikt" && (<>

        {/* HERO */}
        <div className="hero">
          <div className="heroTop">
            <div>
              <div className="eyebrow">{d.tax ? STAPEL.kvarTillDig : `Fakturerat i ${country.name}`}</div>
              <div className="bignum">{kr(d.tax ? d.tax.kvar : d.revenue)}<span className="unit">kr</span></div>
              <div className="sub">av {kr(totalInvoiced)} kr infakturerat · {d.count} {d.count === 1 ? "faktura" : "fakturor"}</div>
            </div>
            <div className="toggleRow">
              <button className="switch" data-on={paidOnly} onClick={() => patch({ paidOnly: !paidOnly })}
                      aria-pressed={paidOnly} aria-label="Räkna bara betalda fakturor" />
              Räkna bara betalda fakturor
            </div>
          </div>

          <div className="bar" role="img" aria-label="Fördelning av pengarna">
            {segments.map((s) => (
              <div key={s.key} className="seg" style={{ flexGrow: s.amount / barTotal, background: s.color }}
                   title={`${s.label}: ${kr(s.amount)} kr`} />
            ))}
            {remainder > 0 && <div className="seg mine" style={{ flexGrow: remainder / barTotal }} title={`Kvar: ${kr(remainder)} kr`} />}
          </div>
          <div className="barCap"><span>{STAPEL.in}</span><span>{STAPEL.ut}</span></div>

          <div className="legend">
            {segments.map((s) => (
              <div className="lrow" key={s.key}>
                <span className="swatch" style={{ background: s.color }} />
                <span className="lname">{s.label}</span>
                <span className="lnote">{s.note}</span>
                <span className="lamt">−{kr(s.amount)}</span>
              </div>
            ))}
            {d.tax && (
              <div className="lrow mine">
                <span className="swatch" style={{ background: "var(--brass)" }} />
                <span className="lname">{STAPEL.kvarTillDig}</span>
                <span className="lnote">{STAPEL.kvarNot}</span>
                <span className="lamt">{kr(d.tax.kvar)}</span>
              </div>
            )}
          </div>
          {d.tax && (
            <div className="uppskattning">
              <span className="uppEtikett">Uppskattning</span>
              <p>
                Siffran är en uppskattning, inte en skatteberäkning. Följande räknas inte:{" "}
                {UTELAMNAT.join(", ").toLowerCase()}. Grundavdrag och jobbskatteavdrag är
                approximerade. Stäm av med Skatteverket eller din redovisningskonsult innan du
                fattar beslut.
              </p>
            </div>
          )}
          {d.tax && <p className="caveat">{d.tax.caveat} Detta är ett planeringsverktyg, inte skatterådgivning — stäm av med Skatteverket eller din redovisningskonsult innan du fattar beslut.</p>}
        </div>

        {d.tax && d.tax.warning && (
          <div className="alert">
            <span className="bang">!</span>
            <p><strong>Lönen är kapad.</strong> {d.tax.warning}</p>
          </div>
        )}

        {/* VARNINGAR */}
        {d.tax?.saknasAr && (
          <div className="alert">
            <span className="bang">!</span>
            <p>
              <strong>Siffrorna är inte avstämda mot {d.tax.saknasAr}.</strong> Vi räknar med
              reglerna för {d.tax.ar === d.tax.saknasAr ? SENASTE_AR : d.tax.ar}, som stämdes av{" "}
              {d.tax.kontrollerad}. Satser och gränser ändras vid årsskiftet — stäm av mot
              Skatteverket innan du planerar efter det här.
            </p>
          </div>
        )}
        {/* Räntefördelning tillämpas automatiskt när kapitalunderlaget
            är ifyllt, så det behövs ingen varning om att den missats.
            Det som däremot går att missa är att fältet finns — och
            har man kapital i firman är det pengar. Visas bara vid
            vinst som gör skillnaden meningsfull, och försvinner så
            snart fältet fyllts i. */}
        {d.tax && d.tax.overskott > 100000 && !settings.kapitalunderlag && (
          <p className="caveat">
            Har du eget kapital i firman? Överstiger det 50 000 kr får en del av vinsten
            flyttas till inkomst av kapital och beskattas med 30 % i stället för din
            marginalskatt på {pct(d.tax.marginal)} %.{" "}
            <button className="linkbtn" onClick={() => setFlik("konto")}>Fyll i kapitalunderlaget</button>
          </p>
        )}
        {!d.momsreg && country.threshold && d.revenue > country.threshold * 0.7 && (
          <div className="alert">
            <span className="bang">!</span>
            <p>{d.revenue > country.threshold
              ? <><strong>Du har passerat omsättningsgränsen för moms.</strong> Din omsättning på {kr(d.revenue)} kr exklusive moms överstiger 120 000 kr, så momsbefrielsen upphör automatiskt. Anmäl momsregistrering till Skatteverket. Momsplikten gällde redan från den faktura som passerade gränsen.</>
              : <><strong>Du närmar dig omsättningsgränsen för moms.</strong> Du ligger på {kr(d.revenue)} kr av 120 000 kr exklusive moms. Passerar du gränsen upphör momsbefrielsen utan beslut, och du behöver anmäla dig till Skatteverket.</>}</p>
          </div>
        )}
        {d.unpaid > 0 && !paidOnly && (
          <div className="alert">
            <span className="bang">!</span>
            <p><strong>{kr(d.unpaid)} kr ligger i obetalda fakturor.</strong> Siffran ovan räknar med dem. Slå på "räkna bara betalda fakturor" för att se vad du har idag.</p>
          </div>
        )}

        {/* KUVERTET */}
        {d.tax && (
          <div className="panel envelope">
            <div className="panelHead">
              <h2>Undanlagt</h2>
                  <Info id="undanlagt" open={openInfo} setOpen={setOpenInfo} />
              <span className="eyebrow">Ska stå på ett separat konto</span>
            </div>
            <InfoBox id="undanlagt" open={openInfo}>Summan av moms, egenavgifter, inkomstskatt och eventuell skatt på räntefördelning för det du fakturerat hittills. De pengarna bör inte ligga på samma konto som dina egna — skriv in vad du faktiskt lagt undan så visar mätaren gapet. Avsättning till periodiseringsfond räknas inte in: de pengarna stannar i firman.</InfoBox>
            <div className="envRow">
              <div>
                <div className="eyebrow">Du borde ha undan</div>
                <div className="midnum">{kr(owed)} kr</div>
              </div>
              <div>
                <div className="eyebrow">Du har lagt undan</div>
                <input className="w130 num big" type="number" value={setAside}
                       onChange={(e) => patch({ setAside: Math.max(0, +e.target.value || 0) })} />
              </div>
              <div className={owed - setAside > 0 ? "gap warn" : "gap ok"}>
                <div className="eyebrow">{owed - setAside > 0 ? "Saknas" : "Marginal"}</div>
                <div className="midnum">{kr(Math.abs(owed - setAside))} kr</div>
              </div>
            </div>
            <div className="envBar">
              <div className="envFill" style={{ width: `${Math.min(100, (setAside / Math.max(1, owed)) * 100)}%` }} />
            </div>

            {/* Momsen är den del som ska rapporteras separat och
                oftast först. Den låg tidigare bara inbakad i summan. */}
            {d.momsreg && (
              <div className="lagringVal">
                <div className="eyebrow" style={{ marginBottom: 10 }}>Varav moms att redovisa</div>
                <div className="item">
                  <span className="iname">Utgående moms<div className="dim">Det du tagit ut av kunderna</div></span>
                  <span className="iamt">{kr(d.outVat)} kr</span>
                </div>
                <div className="item">
                  <span className="iname">Ingående moms<div className="dim">Det du betalat på inköp och får dra av</div></span>
                  <span className="iamt">−{kr(d.inVat)} kr</span>
                </div>
                <div className="item">
                  <span className="iname"><b>{d.outVat - d.inVat >= 0 ? "Att betala in" : "Att få tillbaka"}</b></span>
                  <span className="iamt brass"><b>{kr(Math.abs(d.outVat - d.inVat))} kr</b></span>
                </div>
                <p className="limitNote">
                  Momsen var aldrig dina pengar. Full uppdelning per skattesats finns i
                  rapporten Momsunderlag.
                </p>
              </div>
            )}
          </div>
        )}

        </>)}

        {/* ---------- VERKTYG ---------- */}
        {flik === "verktyg" && (<>

        {/* MARGINALMOTORN — signaturen */}
        {d.tax && (
          <div className={`panel marginal ${isPro ? "" : "locked"}`}>
            <div className="panelHead">
              <h2>Vad kostar det dig?</h2>
                  <Info id="marginal" open={openInfo} setOpen={setOpenInfo} />
              <span className="eyebrow">Marginalskatt {pct(d.tax.marginal)} %</span>
            </div>
            <InfoBox id="marginal" open={openInfo}>Prislappen är sällan din verkliga kostnad. Ett företagsköp sänker vinsten, och med den allt som beräknas på vinsten — både inkomstskatten och egenavgifterna, som tillsammans utgör din marginal och där egenavgifterna står för ungefär hälften. Är du momsregistrerad får du dessutom tillbaka momsen. Ett privatköp betalar du däremot med pengar som redan passerat allt detta.</InfoBox>

            {!isPro && (
              <div className="lockOverlay">
                <div>
                  <div className="eyebrow">{trial.ended ? "Fanns i din provperiod" : "Ingår i Pro"}</div>
                  <p>Se vad ett köp faktiskt kostar dig — och hur många arbetstimmar det motsvarar.</p>
                  <button className="add" onClick={() => setShowPaywall(true)}>Lås upp</button>
                </div>
              </div>
            )}

            <div className="mgControls">
              <div className="segbtns">
                {MG.lagen.map(([k, l]) => (
                  <button key={k} className="sb" data-on={mode === k} onClick={() => setMode(k)}>{l}</button>
                ))}
              </div>
              <div className="mgInputs">
                <label>Belopp
                  <input className="w130 num" inputMode="decimal" value={what} onChange={(e) => setWhat(e.target.value)} />
                </label>
                <label>Ditt timpris
                  <input className="w130 num" inputMode="decimal" value={hourlyRate}
                         onChange={(e) => patch({ hourlyRate: Math.max(0, +e.target.value || 0) })} />
                </label>
              </div>
            </div>

            {margin && (
              <div className="mgOut">
                {mode === "business" && (
                  <>
                    <p className="mgLead">
                      Ett företagsköp på <b>{kr(margin.sticker)} kr</b> kostar dig i själva verket
                      <b className="brass"> {kr(margin.real)} kr</b>.
                    </p>
                    <div className="mgRows">
                      <div><span>{MG.prislapp}</span><b>{kr(margin.sticker)} kr</b></div>
                      {d.momsreg && (
                        <div><span>{MG.momsTillbaka(country.vatName)}</span><b>−{kr(margin.vatBack)} kr</b></div>
                      )}
                      <div>
                        <span>{MG.besparing}</span>
                        <b>−{kr(margin.taxSaving)} kr</b>
                      </div>
                      <div className="tot"><span>{MG.verkligKostnad}</span><b>{kr(margin.real)} kr</b></div>
                    </div>
                    <p className="mgHours">
                      Motsvarar <b>{margin.hours.toFixed(1)} arbetstimmar</b> — du måste fakturera {kr(margin.billNeeded)} kr för att gå jämnt ut.
                    </p>
                    <p className="mgSmalt">
                      Besparingen bygger på din marginal på {pct(d.tax.marginal)} %, som innehåller{" "}
                      {MG.besparingKort}. Har du anställda ingår även deras
                      arbetsgivaravgifter i vad verksamheten kostar, men de påverkas inte av ett
                      enskilt inköp.
                    </p>
                  </>
                )}
                {mode === "private" && (
                  <>
                    <p className="mgLead">
                      För att köpa något privat för <b>{kr(margin.sticker)} kr</b> måste du fakturera
                      <b className="brass"> {kr(margin.billNeeded)} kr</b>.
                    </p>
                    <p className="mgHours">
                      Det är <b>{margin.hours.toFixed(1)} arbetstimmar</b>. Samma sak köpt via firman hade kostat dig{" "}
                      {(margin.sticker / (d.momsreg ? 1 + country.defaultVat / 100 : 1) / Math.max(1, hourlyRate)).toFixed(1)} timmar.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        </>)}

        {/* ---------- ÖVERSIKT, forts. ---------- */}
        {flik === "oversikt" && (<>

        {/* PROGNOS */}
        {forecast && (
          <div className={`panel ${isPro ? "" : "locked"}`}>
            <div className="panelHead">
              <h2>Så här landar året</h2>
                  <Info id="prognos" open={openInfo} setOpen={setOpenInfo} />
              <span className="eyebrow">Baserat på {pct(forecast.elapsed)} % av året</span>
            </div>
            <InfoBox id="prognos" open={openInfo}>Framskrivning av dina hittillsvarande siffror till årsslutet. Syftet är förvarning: passerar du en skattegräns i november vill du veta det i mars, medan du fortfarande kan jämna ut. Har du lön från annat håll — lägg in den under Annan inkomst, annars räknar appen som om företaget vore din enda inkomst.</InfoBox>
            {!isPro && (
              <div className="lockOverlay">
                <div>
                  <div className="eyebrow">{trial.ended ? "Fanns i din provperiod" : "Ingår i Pro"}</div>
                  <p>Få veta i förväg när du är på väg att passera en skattegräns — medan du fortfarande kan göra något åt det.</p>
                  <button className="add" onClick={() => setShowPaywall(true)}>Lås upp</button>
                </div>
              </div>
            )}
            <div className="fcRow">
              <div><div className="eyebrow">Omsättning</div><div className="midnum">{kr(forecast.projRevenue)} kr</div></div>
              <div><div className="eyebrow">Vinst</div><div className="midnum">{kr(forecast.projOverskott)} kr</div></div>
              <div><div className="eyebrow">{STAPEL.kvarTillDig}</div><div className="midnum brass">{kr(forecast.projKvar)} kr</div></div>
            </div>
            {forecast.hits.map((m) => (
              <div className="alert" key={m.label}>
                <span className="bang">!</span>
                <p><strong>{m.label} innan årsskiftet.</strong> {m.note} Det finns fortfarande tid att jämna ut med periodiseringsfond, tidigarelagda inköp eller senarelagd fakturering.</p>
              </div>
            ))}
          </div>
        )}

        {/* VIKTIGA DATUM */}
        {countryCode === "SE" && skattedatum.length > 0 && (
          <div className="panel">
            <div className="panelHead">
              <h2>Att lämna in</h2>
              <Info id="datum" open={openInfo} setOpen={setOpenInfo} />
              <span className="eyebrow">
                Närmast om {skattedatum[0].dagarKvar} {skattedatum[0].dagarKvar === 1 ? "dag" : "dagar"}
              </span>
            </div>
            <InfoBox id="datum" open={openInfo}>
              Inkomstdeklarationen lämnas 2 maj året efter. Momsdeklarationen har egna datum:
              redovisar du helår är det 12 maj — men säljer du till företag i EU flyttas den
              till 26 februari, alltså två och en halv månad tidigare. Redovisar du kvartal
              eller månad gäller den 12:e i andra månaden efter periodens slut. Faller ett
              datum på helg flyttas det till nästa vardag; röda dagar kan flytta det
              ytterligare, så stäm av mot skatteverket.se innan du planerar sista dagen.
            </InfoBox>

            {skattedatum.map((p) => (
              <div className="item" key={p.id}>
                <span className="iname">
                  <b>{p.rubrik}</b>
                  <div className="dim">{p.detalj}</div>
                </span>
                <span className="iamt">
                  {p.forfall.toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" })}
                  <div className={p.dagarKvar <= 30 ? "warn" : "dim"}>
                    {p.dagarKvar} {p.dagarKvar === 1 ? "dag" : "dagar"} kvar
                  </div>
                </span>
              </div>
            ))}
          </div>
        )}

        </>)}

        {/* ---------- KONTO ---------- */}
        {flik === "konto" && (<>

        {/* INSTÄLLNINGAR */}
        {form && form.settings && (
          <div className="settings">
            <div className="panelHead">
              <h2>Inställningar</h2>
              <span className={`save save-${saveState}`}>
                {saveState === "saving" ? "Sparar…"
                  : saveState === "error" ? "Kunde inte spara"
                  : hasAuth && session ? "Sparas automatiskt på ditt konto"
                  : "Sparas automatiskt i den här webbläsaren"}
              </span>
            </div>
            <div className="sblock">
              <div className="slabel">Födelseår</div>
              <input className="w90 num" type="number" placeholder="ÅÅÅÅ"
                     value={settings.fodelsear || ""}
                     onChange={(e) => setSetting("fodelsear", parseInt(e.target.value) || null)} />
              <div className="shint">
                Frivilligt. Har du fyllt 67 år vid årets ingång betalar du bara
                ålderspensionsavgift på 10,21 % istället för fulla egenavgifter.
              </div>
            </div>

            <div className="sblock">
              <div className="slabel">Medlem i Svenska kyrkan</div>
              <button className="switch" data-on={!!settings.kyrkomedlem}
                      onClick={() => setSetting("kyrkomedlem", !settings.kyrkomedlem)}
                      aria-pressed={!!settings.kyrkomedlem} aria-label="Medlem i Svenska kyrkan" />
              <div className="shint">
                Medlemmar betalar kyrkoavgift, i snitt {String(KYRKOAVGIFT_SNITT).replace(".", ",")} %.
                Begravningsavgiften på {String(BEGRAVNINGSAVGIFT).replace(".", ",")} % räknas alltid
                med, oavsett medlemskap. Båda varierar mellan församlingar.
              </div>
            </div>

            {form.settings.map((s) => (
              <div className="sblock" key={s.key}>
                <div className="slabel">{s.label}</div>
                {s.type === "percent" ? (
                  <>
                    <input className="w90 num" type="number" step="0.01" value={settings[s.key] ?? s.default}
                           onChange={(e) => setSetting(s.key, parseFloat(e.target.value) || 0)} />
                    <span className="pctSign">%</span>
                    {s.key === "kommunalskatt" && (
                      <select className="kommunVal" value={settings.kommun || ""}
                              onChange={(e) => {
                                const k = KOMMUNER.find(([n]) => n === e.target.value);
                                setState((st) => ({ ...st, settingsMap: { ...st.settingsMap,
                                  [countryCode]: { ...st.settingsMap[countryCode],
                                    kommun: e.target.value, kommunalskatt: k ? k[1] : st.settingsMap[countryCode].kommunalskatt } } }));
                              }}>
                        <option value="">Välj kommun…</option>
                        {KOMMUNER.map(([n, v]) => <option key={n} value={n}>{n} — {String(v).replace(".", ",")} %</option>)}
                      </select>
                    )}
                  </>
                ) : s.type === "val" ? (
                  <div className="segbtns">
                    {s.val.map(([v, l]) => (
                      <button key={v} className="sb" data-on={(settings[s.key] ?? s.default) === v}
                              onClick={() => setSetting(s.key, v)}>{l}</button>
                    ))}
                  </div>
                ) : s.type === "number" ? (
                  <>
                    <input className="w130 num" type="number" step="1000" min="0"
                           value={settings[s.key] ?? s.default}
                           onChange={(e) => setSetting(s.key, Math.max(0, parseFloat(e.target.value) || 0))} />
                    <span className="pctSign">{s.suffix}</span>
                  </>
                ) : (
                  <button className="switch" data-on={!!settings[s.key]} onClick={() => setSetting(s.key, !settings[s.key])}
                          aria-pressed={!!settings[s.key]} aria-label={s.label} />
                )}
                <div className="shint">{s.hint}</div>
              </div>
            ))}
          </div>
        )}

        </>)}

        {/* ---------- VERKTYG, forts. ---------- */}
        {flik === "verktyg" && (<>

        {/* DIAGRAM */}
        {d.tax && country.forms && (
          <div className={`panel ${isPro ? "" : "locked"}`}>
            <button className="panelHead toggleHead" onClick={() => setOpenChart(openChart === "marg" ? null : "marg")}>
              <h2>Dina skattetrösklar</h2>
                <Info id="marg" open={openInfo} setOpen={setOpenInfo} />
              <span className="eyebrow">{openChart === "marg" ? "Dölj" : "Visa diagram"}</span>
            </button>
            <InfoBox id="marg" open={openInfo}>Marginalskatten är vad nästa intjänade hundralapp kostar dig. Den är inte jämn utan har trappsteg där reglerna ändras: nedsättningen av egenavgifterna som tar slut, och den statliga skattens skiktgräns. Att veta var nästa steg ligger är det som gör planering möjlig.</InfoBox>
            {!isPro && openChart === "marg" && (
              <div className="lockOverlay"><div>
                <div className="eyebrow">{trial.ended ? "Fanns i din provperiod" : "Ingår i Pro"}</div>
                <p>Se var trösklarna sitter och hur nära du är nästa.</p>
                <button className="add" onClick={() => setShowPaywall(true)}>Lås upp</button>
              </div></div>
            )}
            {openChart === "marg" && (
              <Marginalkurvan form={form} revenue={d.revenue} costs={d.costBase} payroll={payroll} payrollAvgifter={personal.avgifter} settings={settings} />
            )}
          </div>
        )}

        </>)}

        {/* ---------- FAKTUROR ----------
           Panelerna ligger i filen i ordningen anställda, utland,
           återkommande, listor. Klassen "sist" flyttar de två
           sekundära längst ner med flex-order, så att fakturorna
           möter en direkt utan att blocken behöver kastas om. */}
        {flik === "fakturor" && (<div className="tabKolumn">

        {/* ANSTÄLLDA */}
        {d.tax && (
          <div className="panel sist">
            <div className="panelHead">
              <h2>Anställda</h2>
                  <Info id="anstallda" open={openInfo} setOpen={setOpenInfo} />
              <span className="eyebrow">
                {employees.length === 0 ? "Inga" : employees.length + (employees.length === 1 ? " person" : " personer")}
              </span>
            </div>
            <InfoBox id="anstallda" open={openInfo}>Löner och arbetsgivaravgifter dras som kostnader i firman. Avgiften är 31,42 % som huvudregel, men flera nedsättningar finns: växa-stöd för de två första anställda, lägre sats för 19–23-åringar, och endast ålderspensionsavgift för den som fyllt 67. Ange födelseår så räknas rätt sats.</InfoBox>

            {employees.length === 0 && (
              <p className="empty">
                Har du anställda? Lägg in dem här så räknas löner och arbetsgivaravgifter in som kostnader.
              </p>
            )}

            {personal.rader.map((e) => (
              <div className="item" key={e.id}>
                <span className="iname">
                  {e.name}
                  {e.regel && <span className="regelTag">{e.regel}</span>}
                </span>
                <span className="iamt">
                  {kr(e.monthly)} kr/mån
                  <span className="dim"> · {(e.sats * 100).toFixed(2)} % avgift</span>
                  {e.sparat > 0 && <span className="brass"> · sparar {kr(e.sparat)} kr/år</span>}
                </span>
                <button className="x" onClick={() => patch({ employees: employees.filter((x) => x.id !== e.id) })} aria-label="Ta bort">×</button>
              </div>
            ))}

            {employees.length > 0 && (
              <div className="payrollSum">
                <div><span className="eyebrow">Löner per år</span><b>{kr(payroll)} kr</b></div>
                <div><span className="eyebrow">Arbetsgivaravgifter</span><b>{kr(personal.avgifter)} kr</b></div>
                <div><span className="eyebrow">Total kostnad</span><b className="brass">{kr(personal.total)} kr</b></div>
                {personal.sparat > 0 && (
                  <div><span className="eyebrow">Sparat på nedsättningar</span><b className="brass">{kr(personal.sparat)} kr</b></div>
                )}
              </div>
            )}

            <div className="form">
              <input className="grow" placeholder="Namn" value={emp.name}
                     onChange={(e) => setEmp({ ...emp, name: e.target.value })}
                     onKeyDown={(e) => e.key === "Enter" && addEmployee()} />
              <input className="w130 num" placeholder="Lön per månad" inputMode="decimal" value={emp.monthly}
                     onChange={(e) => setEmp({ ...emp, monthly: e.target.value })}
                     onKeyDown={(e) => e.key === "Enter" && addEmployee()} />
              <input className="w90 num" placeholder="Födelseår" inputMode="numeric" value={emp.fodelsear}
                     onChange={(e) => setEmp({ ...emp, fodelsear: e.target.value })}
                     onKeyDown={(e) => e.key === "Enter" && addEmployee()} />
              <label className="vaxaVal">
                <input type="checkbox" checked={emp.vaxa}
                       onChange={(e) => setEmp({ ...emp, vaxa: e.target.checked })} />
                Växa-stöd
              </label>
              <button className="add" onClick={addEmployee}>Lägg till</button>
            </div>

            {employees.length > 0 && employees.length <= 2 && !employees.some((e) => e.vaxa) && (
              <div className="alert">
                <span className="bang">!</span>
                <p>
                  <strong>Kolla om du har rätt till växa-stöd.</strong> De två första anställda kan
                  få arbetsgivaravgiften nedsatt till 10,21 % på ersättning upp till 35 000 kr i
                  månaden, i upp till 24 månader. För en anställd på 33 000 kr är det ungefär
                  84 000 kr om året. Villkoren finns hos Skatteverket — kryssa i rutan så räknar
                  vi om.
                </p>
              </div>
            )}
          </div>
        )}

        {d.momsreg && d.perTyp && (d.perTyp.eub2b > 0 || d.perTyp.eub2c > 0 || d.perTyp.export > 0) && (
          <div className="panel sist">
            <div className="panelHead">
              <h2>Försäljning utomlands</h2>
                  <Info id="utland" open={openInfo} setOpen={setOpenInfo} />
              <span className="eyebrow">Vad som måste rapporteras</span>
            </div>
            <InfoBox id="utland" open={openInfo}>
              Var kunden finns avgör om moms ska tas ut och vad som ska rapporteras. Säljer du till
              företag i EU gäller omvänd betalningsskyldighet — ingen moms på fakturan, men kundens
              VAT-nummer krävs och försäljningen ska med i periodisk sammanställning. Säljer du
              digitala tjänster till privatpersoner i EU gäller svensk moms upp till 99 680 kr per
              år, och därefter kundens lands momssats via One Stop Shop.
            </InfoBox>

            {Object.entries(d.perTyp).filter(([k]) => k !== "se").map(([k, v]) => {
              const t = FAKTURATYPER[k];
              return (
                <div className="utlandRad" key={k}>
                  <div>
                    <b>{t.namn}</b>
                    <p>{t.text}</p>
                    {t.fakturatext && <p className="fakturatext">Fakturatext: {t.fakturatext}</p>}
                  </div>
                  <span className="iamt">{kr(v)} kr</span>
                </div>
              );
            })}

            {d.perTyp.eub2b > 0 && (
              <div className="alert">
                <span className="bang">!</span>
                <p>
                  <strong>Periodisk sammanställning krävs.</strong> Du har {kr(d.perTyp.eub2b)} kr i
                  försäljning till företag i EU. Den ska rapporteras separat till Skatteverket,
                  utöver momsdeklarationen. Kontrollera också att du har giltiga VAT-nummer för
                  kunderna — utan dem kan omvänd betalningsskyldighet underkännas och du blir
                  skyldig att betala momsen själv.
                </p>
              </div>
            )}

            {d.perTyp.eub2c > 0 && (
              <div className="alert">
                <span className="bang">!</span>
                <p>
                  {d.perTyp.eub2c > 99680
                    ? <><strong>Du har passerat tröskeln för OSS.</strong> Din försäljning till privatpersoner i EU är {kr(d.perTyp.eub2c)} kr, över gränsen på 99 680 kr. Du ska ta ut kundens lands momssats och redovisa via One Stop Shop hos Skatteverket.</>
                    : <><strong>Svensk moms gäller än så länge.</strong> Din försäljning till privatpersoner i EU är {kr(d.perTyp.eub2c)} kr av tröskeln 99 680 kr. Passerar du den ska kundens lands momssats användas i stället.</>}
                </p>
              </div>
            )}
          </div>
        )}

        {kanLaggaTillAterkommande && (
          <div className="alert">
            <span className="bang">!</span>
            <p>
              <strong>{aterkommandeInv.length + aterkommandeCost.length} återkommande post{aterkommandeInv.length + aterkommandeCost.length === 1 ? "" : "er"} för den här månaden.</strong>{" "}
              Lägg till samma fakturor och kostnader som är märkta återkommande, med obetald status på fakturorna.{" "}
              <button className="linkbtn" onClick={laggTillAterkommande}>Lägg till nu</button>
            </p>
          </div>
        )}

        {/* LISTOR */}
        <div className="cols">
          <div className="panel">
            <div className="panelHead">
              {/* "Fakturerat" i stället för "Fakturor": rubriken ska
                  säga att det är pengar in, inte vilken sorts papper
                  posterna är. Parar ihop sig med "Kostnader". */}
              <h2>Fakturerat</h2>
                  <Info id="moms" open={openInfo} setOpen={setOpenInfo} />
              <span className="eyebrow">
                {kr(d.revenue)} kr · {invoices.length}{limit !== Infinity && ` av ${limit}`}
              </span>
            </div>
            <InfoBox id="moms" open={openInfo}>
              Momsbefrielse gäller upp till 120 000 kr i omsättning exklusive moms per år —
              gränsen höjdes från 80 000 kr den 1 januari 2025. Villkoret gäller även de två
              föregående beskattningsåren. Passerar du gränsen upphör befrielsen automatiskt,
              utan beslut från Skatteverket, och momsplikten gäller från den faktura som
              passerade den. Du kan också välja att momsregistrera dig frivilligt under
              gränsen, vilket ofta lönar sig om du säljer till företag eller gör större inköp.
            </InfoBox>
            {invoices.length === 0 && <p className="empty">Lägg in din första faktura så räknar Kvario ut vad som blir ditt.</p>}
            {!d.momsreg && (
              <p className="limitNote">
                Du är inte momsregistrerad, så ingen moms läggs på fakturorna och momsen på dina
                inköp räknas som en kostnad i stället för ett avdrag.
              </p>
            )}
            {efterDatum(invoices).map((i) => (
              <div className="item" key={i.id}>
                <button className="tag" data-paid={i.paid}
                        onClick={() => patch({ invoices: invoices.map((x) => x.id === i.id ? { ...x, paid: !x.paid } : x) })}>
                  {i.paid ? "Betald" : "Obetald"}
                </button>
                <span className="iname">
                  {i.client}
                  {i.typ && i.typ !== "se" && <span className="regelTag">{FAKTURATYPER[i.typ].kort}</span>}
                  {i.recurring && <span className="regelTag" title="Återkommande varje månad">↻</span>}
                  {i.datum && <div className="dim">{visaDatum(i.datum)}</div>}
                </span>
                <span className="iamt">{kr(i.amount)} {i.currency}
                  {i.currency !== "SEK" && <span className="dim"> · {kr(i.amount * FX[i.currency])} kr</span>}</span>
                <button className="x" onClick={() => patch({ invoices: invoices.filter((x) => x.id !== i.id) })} aria-label="Ta bort">×</button>
              </div>
            ))}
            {atLimit && (
              <p className="limitNote">
                Gratisplanen rymmer {limit} fakturor. <button className="linkbtn" onClick={() => setShowPaywall(true)}>Uppgradera för obegränsat</button>
              </p>
            )}
            <div className="form">
              <input className="grow" placeholder="Kund" value={inv.client}
                     onChange={(e) => setInv({ ...inv, client: e.target.value })}
                     onKeyDown={(e) => e.key === "Enter" && addInvoice()} />
              <input className="w90 num" placeholder="Belopp" inputMode="decimal" value={inv.amount}
                     onChange={(e) => setInv({ ...inv, amount: e.target.value })}
                     onKeyDown={(e) => e.key === "Enter" && addInvoice()} />
              <select className="w70" value={inv.currency} onChange={(e) => setInv({ ...inv, currency: e.target.value })}>
                {Object.keys(FX).map((c) => <option key={c}>{c}</option>)}
              </select>
              <select className="w110" value={inv.typ} onChange={(e) => setInv({ ...inv, typ: e.target.value })}>
                {Object.entries(FAKTURATYPER).map(([k, t]) => <option key={k} value={k}>{t.kort}</option>)}
              </select>
              {d.momsreg && (
                <select className="w70" value={inv.vat} onChange={(e) => setInv({ ...inv, vat: e.target.value })}>
                  {country.vatRates.map((r) => <option key={r} value={r}>{r} %</option>)}
                </select>
              )}
              <input className="w130" type="date" value={inv.datum} title="Fakturadatum"
                     onChange={(e) => setInv({ ...inv, datum: e.target.value })} />
              <label className="vaxaVal" title="Läggs till igen med ett klick varje ny månad">
                <input type="checkbox" checked={inv.recurring}
                       onChange={(e) => setInv({ ...inv, recurring: e.target.checked })} />
                Återkommande
              </label>
              <button className="add" onClick={addInvoice}>Lägg till</button>
            </div>
          </div>

          <div className="panel">
            <div className="panelHead">
              <h2>Kostnader</h2>
              <span className="eyebrow">{kr(d.costBase)} kr · {costs.length}</span>
              <button className="linkbtn" onClick={exportCsv}>Exportera</button>
            </div>
            {costs.length === 0 && <p className="empty">Varje avdragsgill kostnad sänker både skatten och {country.vatName.toLowerCase()}en du ska betala.</p>}
            {efterDatum(costs).map((c) => {
              const egna = kvittonFor(c.id);
              return (
              <div className="item" key={c.id}>
                <span className="iname">
                  {c.label}
                  {c.recurring && <span className="regelTag" title="Återkommande varje månad">↻</span>}
                  {c.datum && <div className="dim">{visaDatum(c.datum)}</div>}
                  {hasAuth && session && egna.map((k) => (
                    <button key={k.id} className="regelTag kvittoTag" title={`${k.filnamn} — klicka för att öppna`}
                            onClick={() => oppnaKvitto(k)}>
                      📎 kvitto
                    </button>
                  ))}
                  {hasAuth && session && egna.map((k) => (
                    <button key={`x${k.id}`} className="kvittoBort" title="Ta bort kvittot"
                            onClick={() => taBortKvitto(k)}>×</button>
                  ))}
                </span>
                <span className="iamt">{kr(c.amount)} {c.currency}
                  {c.currency !== "SEK" && <span className="dim"> · {kr(c.amount * FX[c.currency])} kr</span>}</span>
                {hasAuth && session && (
                  <label className="kvittoKnapp" title="Bifoga kvitto eller faktura">
                    {laddarKvitto === c.id ? "…" : "📎"}
                    <input type="file" accept="image/*,application/pdf" style={{ display: "none" }}
                           onChange={(e) => { valjKvitto(c.id, e.target.files?.[0]); e.target.value = ""; }} />
                  </label>
                )}
                <button className="x" onClick={() => patch({ costs: costs.filter((x) => x.id !== c.id) })} aria-label="Ta bort">×</button>
              </div>
              );
            })}
            {kvittoFel && <p className="authError">{kvittoFel}</p>}
            {hasAuth && session && costs.length > 0 && (
              <p className="limitNote">
                Bokföringslagen kräver att underlaget sparas i sju år. Bifoga kvittot med
                gemet så ligger det med kostnaden i stället för i en skokartong.
              </p>
            )}
            <div className="form">
              <input className="grow" placeholder="Vad" value={cost.label}
                     onChange={(e) => setCost({ ...cost, label: e.target.value })}
                     onKeyDown={(e) => e.key === "Enter" && addCost()} />
              <input className="w90 num" placeholder="Belopp" inputMode="decimal" value={cost.amount}
                     onChange={(e) => setCost({ ...cost, amount: e.target.value })}
                     onKeyDown={(e) => e.key === "Enter" && addCost()} />
              <select className="w70" value={cost.currency} onChange={(e) => setCost({ ...cost, currency: e.target.value })}>
                {Object.keys(FX).map((c) => <option key={c}>{c}</option>)}
              </select>
              <select className="w70" value={cost.vat} onChange={(e) => setCost({ ...cost, vat: e.target.value })}
                      title={d.momsreg ? "Momssats" : "Momssats på inköpet — räknas som kostnad"}>
                {country.vatRates.map((r) => <option key={r} value={r}>{r} %</option>)}
              </select>
              <input className="w130" type="date" value={cost.datum} title="Inköpsdatum"
                     onChange={(e) => setCost({ ...cost, datum: e.target.value })} />
              <label className="vaxaVal" title="Läggs till igen med ett klick varje ny månad">
                <input type="checkbox" checked={cost.recurring}
                       onChange={(e) => setCost({ ...cost, recurring: e.target.checked })} />
                Återkommande
              </label>
              <button className="add" onClick={addCost}>Lägg till</button>
            </div>

            {costHint && countryCode === "SE" && (
              <div className="hint">
                <span className={`avDot ${VERDICT[costHint.verdict].tone}`} />
                <p>
                  <b>{costHint.name}:</b> {costHint.short}{" "}
                  <button className="linkbtn" onClick={() => { setAvdragQ(costHint.name); setOpenAvdrag(costHint.id); }}>
                    Läs mer
                  </button>
                </p>
              </div>
            )}
          </div>
        </div>

        </div>)}

        {/* ---------- RAPPORTER ---------- */}
        {flik === "rapporter" && (<>

        <div className="panel">
          <div className="panelHead">
            <h2>Rapporter</h2>
                  <Info id="rapport" open={openInfo} setOpen={setOpenInfo} />
            <span className="eyebrow">Ladda ner som PDF</span>
          </div>
          <InfoBox id="rapport" open={openInfo}>
            Rapporterna skrivs ut via webbläsarens egen PDF-motor, vilket ger sökbar text i stället
            för en bild. Välj "Spara som PDF" i utskriftsdialogen. Årsöversikten innehåller
            förklaringar till varje siffra och går att läsa av någon som aldrig sett appen.
            Underlaget är rådata för din redovisningskonsult. Momsunderlaget delar upp utgående
            och ingående moms per skattesats.
          </InfoBox>

          <div className="rapportLista">
            {RAPPORTER.filter((r) => r.id !== "moms" || d.momsreg).map((r) => (
              <div className="rapportRad" key={r.id}>
                <div>
                  <b>{r.namn}</b>
                  <p>{r.beskrivning}</p>
                </div>
                <button className="add" onClick={() => setRapport(r.id)}>Öppna</button>
              </div>
            ))}
          </div>
        </div>

        {hasAuth && session && (
          <div className="panel">
            <div className="panelHead">
              <h2>Dela med redovisningskonsult</h2>
                  <Info id="dela" open={openInfo} setOpen={setOpenInfo} />
              <span className="eyebrow">{delningar.length} aktiva länkar</span>
            </div>
            <InfoBox id="dela" open={openInfo}>
              Länken visar en skrivskyddad rapport med samma siffror som Rapporter ovan —
              live, alltså uppdaterad varje gång den öppnas, inte en ögonblicksbild. Ingen
              inloggning krävs för den som får länken. Den slutar fungera efter 30 dagar,
              eller direkt om du återkallar den här.
            </InfoBox>
            {delningar.length === 0 && <p className="empty">Ingen aktiv länk än.</p>}
            {delningar.map((del) => (
              <div className="item" key={del.token}>
                <span className="iname">
                  Skapad {new Date(del.skapad_at).toLocaleDateString("sv-SE")}
                  <span className="dim"> · giltig till {new Date(del.giltig_till).toLocaleDateString("sv-SE")}</span>
                </span>
                <button className="linkbtn" onClick={() => kopieraDelning(del.token)}>
                  {delningKopierad === del.token ? "Kopierad!" : "Kopiera länk"}
                </button>
                <button className="x" onClick={() => taBortDelning(del.token)} aria-label="Återkalla">×</button>
              </div>
            ))}
            <button className="add" style={{ marginTop: 12 }} onClick={skapaNyDelning}>Skapa ny länk</button>
          </div>
        )}

        </>)}

        {/* ---------- KONTO, forts. ---------- */}
        {flik === "konto" && (<>

        {hasAuth && session && (
          <div className="panel">
            <div className="panelHead">
              <h2>Prenumeration</h2>
              <span className="eyebrow">
                {subscribed ? "Kvario Pro" : trial.active ? `Provperiod · ${trial.daysLeft} ${trial.daysLeft === 1 ? "dag" : "dagar"} kvar` : "Gratis"}
              </span>
            </div>

            {subscribed ? (
              <>
                <p className="dataText">
                  Du har Kvario Pro{sub?.current_period_end && <> och den förnyas {new Date(sub.current_period_end).toLocaleDateString("sv-SE")}</>}.
                  Uppsägning, byte mellan månad och år, kortbyte och alla kvitton sköter du
                  på Stripes sida — den är säkrare än att vi hanterar korten själva.
                </p>
                <div className="dataKnappar">
                  <button className="add" onClick={hanteraPrenumeration}>Hantera prenumerationen</button>
                </div>
              </>
            ) : (
              <>
                <p className="dataText">
                  {trial.active
                    ? `Din provperiod har ${trial.daysLeft} ${trial.daysLeft === 1 ? "dag" : "dagar"} kvar. Tecknar du nu fortsätter allt utan avbrott.`
                    : "Uträkningen \"kvar till dig\" är gratis för alltid. Pro låser upp marginalräknaren, årsprognosen och obegränsat med fakturor."}
                </p>
                <div className="dataKnappar">
                  <button className="add" onClick={() => setShowPaywall(true)}>Se vad Pro kostar</button>
                </div>
              </>
            )}

            {ordrar.length > 0 && (
              <div className="lagringVal">
                <div className="eyebrow" style={{ marginBottom: 10 }}>Dina betalningar</div>
                {ordrar.map((o) => (
                  <div className="item" key={o.ordernummer}>
                    <span className="iname">
                      {new Date(o.betald_at).toLocaleDateString("sv-SE")}
                      <span className="dim"> · {o.ordernummer}</span>
                      {o.status !== "betald" && <span className="regelTag">
                        {o.status === "aterbetald" ? "Återbetald" : "Delvis återbetald"}
                      </span>}
                    </span>
                    <span className="iamt">
                      {kr(o.belopp_ore / 100)} kr
                      <span className="dim"> · {o.interval === "month" ? "månad" : "år"}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {ordrar.length > 0 && (
              <div className="lagringVal">
                <div className="eyebrow" style={{ marginBottom: 8 }}>Ångerrätt</div>
                {refundKlar ? (
                  <p className="dataText" style={{ margin: 0 }}>
                    Din begäran är mottagen. Ligger den inom 14 dagar godkänns den
                    normalt automatiskt — annars hör vi av oss.
                  </p>
                ) : (
                  <>
                    <p className="dataText">
                      Du har 14 dagars ångerrätt från köpet. Begäran gäller din senaste betalning.
                    </p>
                    <textarea rows="2" placeholder="Anledning (frivilligt)" value={refundOrsak}
                              onChange={(e) => setRefundOrsak(e.target.value)}
                              style={{ width: "100%", marginBottom: 10 }} />
                    {refundFel && <p className="authError">{refundFel}</p>}
                    <button className="farlig" onClick={begarAterbetalning} disabled={refundStatus === "sending"}>
                      {refundStatus === "sending" ? "Skickar…" : "Begär återbetalning"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {hasAuth && session && (
          <div className="panel">
            <div className="panelHead">
              <h2>Inloggningsuppgifter</h2>
              <span className="eyebrow">{session.user.email}</span>
            </div>

            {kontoBesked && <p className="dataText" style={{ color: "var(--brass-dk)" }}>{kontoBesked}</p>}
            {kontoFel && <p className="authError">{kontoFel}</p>}

            <div className="lagringVal">
              <div className="eyebrow" style={{ marginBottom: 10 }}>Byt e-postadress</div>
              <div className="form" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
                <input className="grow" type="email" placeholder="ny@epost.se" value={nyEpost}
                       onChange={(e) => setNyEpost(e.target.value)} autoComplete="email" />
                <button className="add" onClick={sparaNyEpost}>Byt e-post</button>
              </div>
            </div>

            <div className="lagringVal">
              <div className="eyebrow" style={{ marginBottom: 10 }}>Byt lösenord</div>
              <div className="form" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
                <input className="grow" type="password" placeholder="Minst 6 tecken" value={nyttLosen}
                       onChange={(e) => setNyttLosen(e.target.value)} autoComplete="new-password" />
                <button className="add" onClick={sparaNyttLosen}>Byt lösenord</button>
              </div>
            </div>
          </div>
        )}

        <div className="panel">
          <div className="panelHead">
              <h2>Din data</h2>
              <span className="eyebrow">Dina rättigheter enligt GDPR</span>
            </div>
            <p className="dataText">
              Du äger dina uppgifter. Här kan du ta ut allt vi har om dig, eller radera det.
              Vill du ha rättelse eller invända mot behandlingen, hör av dig till {ANSVARIG.epost}.
            </p>
            <div className="dataKnappar">
              <button className="add" onClick={exportAllt}>Exportera all min data</button>
              <button className="farlig" onClick={raderaAllt}>Radera all min data</button>
            </div>
            <div className="lagringVal">
              <div className="eyebrow" style={{ marginBottom: 10 }}>Lagring i webbläsaren</div>
              {LAGRING.map((l) => (
                <div className="lagringRad" key={l.id}>
                  <button className="switch" data-on={l.alltid || statistik}
                          disabled={l.alltid}
                          onClick={() => !l.alltid && sparaSamtycke(!statistik)}
                          aria-label={l.namn} />
                  <div>
                    <b>{l.namn}{l.alltid && " · kan inte stängas av"}</b>
                    <p>{l.text}</p>
                  </div>
                </div>
              ))}
            </div>
          <div className="lagringVal" style={{ marginTop: 4 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Villkor och policy</div>
            <div className="dataKnappar">
              <button className="authAlt smal" onClick={() => setVisaVillkorFot((v) => !v)}>
                {visaVillkorFot ? "Dölj användarvillkoren" : "Läs användarvillkoren"}
              </button>
              <button className="authAlt smal" onClick={() => setVisaPolicy((v) => !v)}>
                {visaPolicy ? "Dölj integritetspolicyn" : "Läs integritetspolicyn"}
              </button>
            </div>
            {state.villkor && (
              <p className="modalNote" style={{ marginTop: 10 }}>
                Godkända {new Date(state.villkor.at).toLocaleDateString("sv-SE")} (version {state.villkor.version}).
              </p>
            )}
          </div>
        </div>

        {visaPolicy && (
          <div className="panel">
            <div className="panelHead">
              <h2>Integritetspolicy</h2>
              <span className="eyebrow">Version {POLICY_VERSION}</span>
            </div>
            <div className="villkorInline bare">
              {INTEGRITET.map((v) => (
                <div key={v.h}>
                  <h4>{v.h}</h4>
                  <p>{v.p}</p>
                </div>
              ))}
            </div>
            <button className="linkbtn" onClick={() => setVisaPolicy(false)}>Fäll ihop</button>
          </div>
        )}

        {visaVillkorFot && (
          <div className="panel">
            <div className="panelHead">
              <h2>Användarvillkor</h2>
              <span className="eyebrow">Version {VILLKOR_VERSION}</span>
            </div>
            <div className="villkorInline bare">
              {VILLKOR.map((v) => (
                <div key={v.h}>
                  <h4>{v.h}</h4>
                  <p>{v.p}</p>
                </div>
              ))}
            </div>
            <button className="linkbtn" onClick={() => setVisaVillkorFot(false)}>Fäll ihop</button>
          </div>
        )}

        </>)}

        {/* ---------- AVDRAG ---------- */}
        {flik === "avdrag" && (<>

        {/* AVDRAGSGUIDE */}
        {countryCode === "SE" && (
          <div className="panel">
            <div className="panelHead">
              <h2>Får jag dra av det?</h2>
                  <Info id="avdrag" open={openInfo} setOpen={setOpenInfo} />
              <span className="eyebrow">{AVDRAG.length} vanliga poster</span>
            </div>
            <InfoBox id="avdrag" open={openInfo}>De tjugo poster som frilansare frågar om oftast. Grönt är normalt avdragsgillt, guld gäller delvis eller med tak, rött är det inte. Vägledning för enskild firma — inte ett besked. Reglerna har undantag och beloppen ändras mellan åren.</InfoBox>

            <input
              className="avdragSearch"
              placeholder="Sök — till exempel dator, lunch, gymkort, resa…"
              value={avdragQ}
              onChange={(e) => setAvdragQ(e.target.value)}
            />

            <div className="avdragList">
              {matchAvdrag(avdragQ).map((a) => (
                <div key={a.id} className="avItem">
                  <button className="avHead" onClick={() => setOpenAvdrag(openAvdrag === a.id ? null : a.id)}>
                    <span className={`avDot ${VERDICT[a.verdict].tone}`} />
                    <span className="avName">{a.name}</span>
                    <span className="avShort">{a.short}</span>
                    <span className={`avTag ${VERDICT[a.verdict].tone}`}>{VERDICT[a.verdict].label}</span>
                  </button>
                  {openAvdrag === a.id && <p className="avDetail">{a.detail}</p>}
                </div>
              ))}
              {matchAvdrag(avdragQ).length === 0 && (
                <p className="empty">Ingen träff på "{avdragQ}". Guiden täcker de vanligaste posterna — för allt annat är Skatteverket eller en redovisningskonsult rätt väg.</p>
              )}
            </div>

            <p className="caveat">
              Vägledning för enskild firma, inte ett besked. Reglerna har undantag och beloppen
              ändras mellan åren — stäm av mot Skatteverket eller din redovisningskonsult innan du
              bokför något du är osäker på.
            </p>
          </div>
        )}

        </>)}

        <p className="foot">
          Valutakurser är fasta demokurser. Skattesiffrorna för Sverige gäller inkomstår 2026 och är
          uppskattningar för enskild firma — grundavdraget är approximerat och jobbskatteavdrag ingår inte.
          {" · "}<button className="linkbtn" onClick={() => setFlik("konto")}>Villkor, policy och din data</button>
          {hasAuth && session && <> · Inloggad som {session.user.email}</>}
        </p>
      </div>

      {/* PAYWALL */}
      {showPaywall && (
        <div className="modalBg" onClick={() => setShowPaywall(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="eyebrow">Kvario Pro</div>
            <h2>{trial.ended ? "Ta tillbaka Pro" : trial.active ? "Behåll Pro" : "Se hela bilden"}</h2>
            {trial.active && (
              <p className="modalLead">
                Du har {trial.daysLeft} {trial.daysLeft === 1 ? "dag" : "dagar"} kvar av provperioden.
                Tecknar du nu fortsätter allt utan avbrott.
              </p>
            )}
            <ul className="perks">
              <li><b>Obegränsat med fakturor</b> och kostnader</li>
              <li><b>Vad kostar det dig?</b> — verklig kostnad och arbetstimmar för varje köp</li>
              <li><b>Årsprognos</b> med förvarning innan du passerar en skattegräns</li>
              <li><b>Export</b> till din redovisningskonsult</li>
              <li><b>Historik</b> över alla år, sparad</li>
            </ul>
            <div className="billing">
              <button className="bopt" data-on={billing === "year"} onClick={() => setBilling("year")}>
                <span className="bname">Per år</span>
                <span className="bprice">{PLANS.pro.year} kr</span>
                <span className="bnote">82 kr/mån · spara 17 %</span>
              </button>
              <button className="bopt" data-on={billing === "month"} onClick={() => setBilling("month")}>
                <span className="bname">Per månad</span>
                <span className="bprice">{PLANS.pro.month} kr</span>
                <span className="bnote">Säg upp när du vill</span>
              </button>
            </div>
            {checkoutFel && <p className="authError">{checkoutFel}</p>}

            <button className="add wide" onClick={startCheckout}>
              Fortsätt till betalning · {billing === "year" ? `${PLANS.pro.year} kr/år` : `${PLANS.pro.month} kr/mån`}
            </button>

            <p className="modalNote">
              Priset är inklusive moms. Du får en orderbekräftelse med kvitto och
              momsspecifikation via e-post direkt efter betalningen.
            </p>
            <p className="modalNote">
              Du har 14 dagars ångerrätt. Ångrar du dig inom den tiden får du pengarna
              tillbaka, även om du hunnit använda tjänsten. Prenumerationen kan sägas
              upp när som helst.
            </p>
            <button className="linkbtn center" onClick={() => setShowPaywall(false)}>Inte nu</button>
          </div>
        </div>
      )}

    </div>
  );
}
