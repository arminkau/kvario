/* ============================================================
   Utskick

   Den här filen gör en enda sak: skickar. Vad som står i breven
   ligger i brev.js, och ramen kring dem i brevmall.js.

   TVÅ VÄGAR UT

   Resend över HTTPS när RESEND_API_KEY är satt, annars SMTP.

   Skälet till att HTTPS finns är inte att den är finare, utan att
   Railway inte släpper ut SMTP alls. Både 465 och 587 gick i
   timeout därifrån, medan samma värd svarar på en halv sekund från
   en vanlig uppkoppling. Port 443 är den enda ingen spärrar.

   SMTP-vägen är kvar med flit. Den fungerar överallt utom just på
   Railway, och koden ska inte tappa en förmåga bara för att en
   plattform saknar den. Flyttar servern någon gång räcker det att
   ta bort nyckeln.

   Inget utskick får fälla anropet som kallade hit. Breven skickas
   från webhookar där betalningen redan är genomförd, och en order
   utan bekräftelse är långt bättre än en order som rullas tillbaka
   för att mejlservern hade en dålig dag.
   ============================================================ */

import nodemailer from "nodemailer";
import { promises as dns } from "node:dns";
import * as BREV from "./brev.js";
import { SALJARE } from "./brevmall.js";

const AVSANDARE = process.env.EPOST_AVSANDARE || "Kvario <info@kvario.se>";

/* Vilken väg som används. Läses av /halsa så att det syns utifrån
   vilken transport som faktiskt är igång. */
export const transportSort = () =>
  process.env.RESEND_API_KEY ? "resend"
  : (process.env.SMTP_VARD && process.env.SMTP_ANVANDARE && process.env.SMTP_LOSENORD) ? "smtp"
  : null;

/* ---------- Resend över HTTPS ----------
   Ett vanligt POST-anrop, ingen klientbibliotek behövs. Adressen
   måste ligga på en domän som verifierats hos Resend, annars
   avvisas brevet med 403. */
async function skickaViaResend(till, { amne, html, text }) {
  const svar = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: AVSANDARE,
      to: [till],
      reply_to: SALJARE.epost,
      subject: amne,
      html,
      text,
    }),
    // Utan detta kan ett hängande anrop hålla webhooken öppen tills
    // Stripe ger upp och gör om den.
    signal: AbortSignal.timeout(15000),
  });

  if (!svar.ok) {
    const kropp = await svar.text().catch(() => "");
    let orsak = `HTTP ${svar.status}`;
    try { orsak = JSON.parse(kropp).message || orsak; } catch { if (kropp) orsak = kropp.slice(0, 200); }
    throw new Error(orsak);
  }
  return svar.json().catch(() => ({}));
}

/* ---------- SMTP ----------
   Anslutningen görs en gång och återanvänds. Nodemailer håller en
   pool, vilket spelar roll här: webhooken kan få flera betalningar
   tätt inpå varandra, och Strato stryper den som öppnar en ny
   session per brev.

   Port 465 är implicit TLS och är det som rekommenderas. 587 med
   STARTTLS fungerar också — sätt SMTP_PORT så väljs rätt läge av
   sig självt. */
let transportLofte = null;

/* Slår upp IPv4-adressen själv och skickar den vidare som host.

   Anledningen är att nodemailer gör sitt eget uppslag, hämtar både A-
   och AAAA-poster och sedan väljer en av dem SLUMPMÄSSIGT:

       addresses[Math.floor(Math.random() * addresses.length)]

   Strato har båda. Railways containrar har ett IPv6-gränssnitt men
   ingen väg ut, så varannan anslutning dog med ENETUNREACH mot en
   2a01:238-adress. Ett fel som ser ut som ett tappat lösenord, och
   som dessutom försvann om man provade igen — det värsta slaget.

   family-flaggan hjälper inte: den styr namnuppslag, och vid det
   laget har nodemailer redan ersatt namnet med en färdig adress.
   Ger man i stället en IP direkt hoppar den över uppslaget helt.
   servername måste då sättas, annars kontrolleras certifikatet mot
   IP-adressen i stället för mot värdnamnet. */
async function skapaTransport(varden, anvandare, losenord) {
  const port = Number(process.env.SMTP_PORT || 465);

  let host = varden;
  let servername;
  try {
    const [ipv4] = await dns.resolve4(varden);
    if (ipv4) { host = ipv4; servername = varden; }
  } catch {
    // Går uppslaget inte alls, låt nodemailer försöka med namnet.
  }

  return nodemailer.createTransport({
    host,
    servername,
    port,
    secure: port === 465,   // 465 = TLS direkt, 587 = STARTTLS
    auth: { user: anvandare, pass: losenord },
    pool: true,
    maxConnections: 2,
    // Ett brev som hänger får inte hålla webhooken öppen; Stripe
    // gör om anropet om vi svarar för sent.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

async function hamtaTransport() {
  const varden = process.env.SMTP_VARD;
  const anvandare = process.env.SMTP_ANVANDARE;
  const losenord = process.env.SMTP_LOSENORD;
  if (!varden || !anvandare || !losenord) return null;

  if (!transportLofte) {
    transportLofte = skapaTransport(varden, anvandare, losenord).catch((e) => {
      // Ett misslyckat försök får inte cachas som ett trasigt löfte
      // för resten av processens liv.
      transportLofte = null;
      throw e;
    });
  }
  return transportLofte;
}

/* Skickar ett färdigt brev. Returnerar alltid, kastar aldrig. */
async function skicka(till, brevet) {
  const sort = transportSort();
  if (!sort) {
    console.warn("Ingen e-posttransport är konfigurerad — inget brev skickat till", till);
    return { skickad: false, orsak: "okonfigurerad" };
  }
  if (!till || !/^\S+@\S+\.\S+$/.test(till)) {
    return { skickad: false, orsak: "ogiltig mottagare" };
  }

  try {
    if (sort === "resend") {
      await skickaViaResend(till, brevet);
    } else {
      const t = await hamtaTransport();
      await t.sendMail({
        from: AVSANDARE, to: till, replyTo: SALJARE.epost,
        subject: brevet.amne, html: brevet.html, text: brevet.text,
      });
    }
    console.log(`Skickade brev via ${sort}:`, brevet.amne, "->", till);
    return { skickad: true, via: sort };
  } catch (e) {
    console.error(`Kunde inte skicka brev via ${sort}:`, brevet.amne, "->", till, "—", e?.message || e);
    return { skickad: false, orsak: e?.message || "okänt fel", via: sort };
  }
}

/* ---------- Ett anrop per händelse ----------
   Namngivna med flit i stället för ett generellt skicka(typ, data).
   Anropen syns då i sökningar, och det går att se vilka brev som
   faktiskt används utan att läsa serverkoden. */

export const skickaValkommen = (epost, data = {}) =>
  skicka(epost, BREV.valkommen({ epost, ...data }));

export const skickaProvperiodSlutar = (epost, data) =>
  skicka(epost, BREV.provperiodSlutar(data));

export const skickaOrderbekraftelse = (data) =>
  skicka(data.epost, BREV.orderbekraftelse(data));

export const skickaBetalningMisslyckades = (epost, data) =>
  skicka(epost, BREV.betalningMisslyckades(data));

export const skickaUppsagd = (epost, data) =>
  skicka(epost, BREV.uppsagd(data));

export const skickaAterbetalning = (epost, data) =>
  skicka(epost, BREV.aterbetalning(data));

/* Provar anslutningen utan att skicka något. Anropas av /halsa på
   servern, så att ett felstavat lösenord upptäcks direkt i stället
   för vid första betalningen. */
export async function provaEpost() {
  /* Inställningarna redovisas oavsett utfall. Utan det går det inte
     att skilja "koden är inte utrullad än" från "det är verkligen
     nätverket" — och de två felen ser likadana ut utifrån.
     kod-fältet bumpas när något här ändras, så det syns direkt
     vilken version som svarar. */
  const sort = transportSort();
  const bas = { kod: 4, via: sort, avsandare: AVSANDARE };

  if (!sort) {
    return { ...bas, ok: false, orsak: "Varken RESEND_API_KEY eller SMTP-variablerna är satta" };
  }

  if (sort === "resend") {
    /* Nyckeln provas mot domänlistan. Den skickar ingenting, men
       säger både att nyckeln duger och vilka domäner som är
       verifierade — det är den vanligaste orsaken till att brev
       avvisas sedan. */
    try {
      const svar = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        signal: AbortSignal.timeout(12000),
      });
      if (!svar.ok) {
        // Resend skriver ut vad som är fel med nyckeln. Ett bart
        // "HTTP 400" hade lämnat en att gissa.
        const kropp = await svar.text().catch(() => "");
        let orsak = `HTTP ${svar.status}`;
        try { orsak = JSON.parse(kropp).message || orsak; } catch { if (kropp) orsak = kropp.slice(0, 200); }
        return { ...bas, ok: false, orsak };
      }
      const data = await svar.json();
      const domaner = (data?.data || []).map((d) => `${d.name} (${d.status})`);
      return { ...bas, ok: true, domaner };
    } catch (e) {
      return { ...bas, ok: false, orsak: e?.message || "okänt fel" };
    }
  }

  try {
    const t = await hamtaTransport();
    await t.verify();
    return {
      ...bas, ok: true,
      varden: process.env.SMTP_VARD,
      port: Number(process.env.SMTP_PORT || 465),
      ansluterTill: t.options.host,
    };
  } catch (e) {
    return {
      ...bas, ok: false,
      varden: process.env.SMTP_VARD,
      port: Number(process.env.SMTP_PORT || 465),
      orsak: e?.message || "okänt fel",
    };
  }
}

/* Alla brev, för provutskick. Nyckeln är den som skickas in i
   /admin/provbrev. */
export const PROVBREV = {
  valkommen: () => BREV.valkommen({ epost: "prov@kvario.se" }),
  provperiod: () => BREV.provperiodSlutar({ dagarKvar: 3, slutar: new Date(Date.now() + 3 * 86400000) }),
  order: () => BREV.orderbekraftelse({
    ordernummer: "K-PROV-0000", epost: "prov@kvario.se", namn: "Provbrev",
    belopp: 9900, interval: "month", betaldatum: new Date(),
    periodSlut: new Date(Date.now() + 30 * 86400000), angerrattSamtycke: true, fakturaUrl: null,
  }),
  betalningsfel: () => BREV.betalningMisslyckades({
    belopp: 9900, nastaForsok: new Date(Date.now() + 3 * 86400000), portalUrl: null,
  }),
  uppsagd: () => BREV.uppsagd({ slutar: new Date(Date.now() + 21 * 86400000) }),
  aterbetalning: () => BREV.aterbetalning({ ordernummer: "K-PROV-0000", belopp: 9900, helt: true }),
};

export const skickaProvbrev = (epost, sort) => {
  const bygg = PROVBREV[sort];
  if (!bygg) return Promise.resolve({ skickad: false, orsak: `okänd brevsort: ${sort}` });
  return skicka(epost, bygg());
};
