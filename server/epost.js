/* ============================================================
   Utskick

   Den här filen gör en enda sak: skickar. Vad som står i breven
   ligger i brev.js, och ramen kring dem i brevmall.js.

   Går över SMTP från kvario.se hos Strato. Avsändaradressen måste
   vara samma konto som autentiseringen sker med — Strato avvisar
   brev där from pekar någon annanstans.

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
async function skicka(till, { amne, html, text }) {
  const t = await hamtaTransport();
  if (!t) {
    console.warn("SMTP är inte konfigurerat — inget brev skickat till", till);
    return { skickad: false, orsak: "okonfigurerad" };
  }
  if (!till || !/^\S+@\S+\.\S+$/.test(till)) {
    return { skickad: false, orsak: "ogiltig mottagare" };
  }

  try {
    await t.sendMail({ from: AVSANDARE, to: till, replyTo: SALJARE.epost, subject: amne, html, text });
    console.log("Skickade brev:", amne, "->", till);
    return { skickad: true };
  } catch (e) {
    console.error("Kunde inte skicka brev:", amne, "->", till, "—", e?.message || e);
    return { skickad: false, orsak: e?.message || "okänt fel" };
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
export async function provaSmtp() {
  /* Inställningarna redovisas oavsett utfall. Utan det går det inte
     att skilja "koden är inte utrullad än" från "det är verkligen
     nätverket" — och de två felen ser likadana ut utifrån.
     kod-fältet bumpas när något här ändras, så det syns direkt
     vilken version som svarar. */
  const bas = {
    kod: 3,
    varden: process.env.SMTP_VARD || null,
    port: Number(process.env.SMTP_PORT || 465),
    anvandare: process.env.SMTP_ANVANDARE || null,
    losenordSatt: Boolean(process.env.SMTP_LOSENORD),
  };

  try {
    const t = await hamtaTransport();
    if (!t) return { ...bas, ok: false, orsak: "SMTP-variablerna är inte satta" };
    await t.verify();
    return { ...bas, ok: true, avsandare: AVSANDARE, ansluterTill: t.options.host };
  } catch (e) {
    return { ...bas, ok: false, orsak: e?.message || "okänt fel" };
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
