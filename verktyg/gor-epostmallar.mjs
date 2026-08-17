/* ============================================================
   E-postmallar till Supabase

   Supabase skickar bekräftelser och lösenordslänkar med sina egna
   mallar, och de går inte att styra från koden — de klistras in i
   projektets inställningar. Men de ska se ut som våra andra brev,
   annars ser kunden två olika avsändare för samma tjänst.

   Därför genereras de här, ur samma färger och samma märke som
   server/brevmall.js. Ändras formspråket räcker det att köra om.

   Kör:
     node verktyg/gor-epostmallar.mjs

   Filerna hamnar i supabase/epostmallar/ och klistras in under
   Authentication -> Emails -> Templates.

   VARIABLERNA MÅSTE STÅ KVAR ORÖRDA. {{ .ConfirmationURL }} och
   {{ .NewEmail }} byts ut av Supabase vid utskicket; skrivs de fel
   skickas brevet utan fungerande länk.
   ============================================================ */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HAR = dirname(fileURLToPath(import.meta.url));
const UT = join(HAR, "..", "supabase", "epostmallar");

const F = {
  botten: "#E4EBE7", papper: "#FAFCFB", black: "#131E26",
  dampad: "#4A5D68", linje: "#C6D3CD", massing: "#B8862B",
  mist: "#8698A1", varning: "#9A4A25",
  band1: "#3E5566", band2: "#63798A", band3: "#8A9CA8",
};

/* Märket ritas med tabellceller som har bakgrundsfärg, aldrig som
   bild — Gmail och Outlook blockerar bilder tills mottagaren
   tillåter dem, och ett kvitto som öppnar med en tom ruta och ett
   kryss ser ut som skräppost. */
const band = (h, farg) =>
  `<tr><td height="${h}" style="height:${h}px;background:${farg};font-size:0;line-height:0">&nbsp;</td></tr>`;

const MARKE = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>
      <td width="40" style="padding-right:11px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="40" style="border-collapse:collapse;background:${F.black};border-radius:9px">
          <tr><td style="padding:5px">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="30" style="border-collapse:collapse">
              ${band(6, F.band1)}${band(1, F.black)}${band(4, F.band2)}${band(1, F.black)}${band(4, F.band3)}${band(1, F.black)}${band(13, F.massing)}
            </table>
          </td></tr>
        </table>
      </td>
      <td style="font-size:21px;font-weight:700;letter-spacing:-.02em;color:${F.black};vertical-align:middle">Kvario</td>
    </tr></table>`;

const knapp = (text, url) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${F.black};border-radius:3px">
        <a href="${url}" style="display:inline-block;color:${F.papper};text-decoration:none;font-size:14px;font-weight:600;padding:13px 26px">${text}</a>
      </td></tr></table>`;

/* Varning i stället för vänlig avslutning. Används där ett oväntat
   brev betyder att någon annan är inne på kontot — då är "bortse
   från detta" fel råd. */
const varningsruta = (text) =>
  `<div style="background:${F.botten};border-left:3px solid ${F.varning};border-radius:0 4px 4px 0;padding:15px 17px;margin-top:26px">
        <p style="margin:0;font-size:12.5px;line-height:1.65;color:${F.dampad}">${text}</p>
      </div>`;

const lugnruta = (text) =>
  `<div style="background:${F.botten};border-left:3px solid ${F.massing};border-radius:0 4px 4px 0;padding:15px 17px;margin-top:26px">
        <p style="margin:0;font-size:12.5px;line-height:1.65;color:${F.dampad}">${text}</p>
      </div>`;

function mall({ rubrik, ingress, knapptext, kropp = "", avslut }) {
  return `<!doctype html>
<html lang="sv">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:${F.botten};font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${F.black}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;margin:0 auto;background:${F.papper};border-radius:6px">

  <tr><td style="padding:32px 32px 0">
    ${MARKE}
    <h1 style="font-size:22px;font-weight:700;margin:22px 0 8px;line-height:1.25">${rubrik}</h1>
    <p style="font-size:14px;line-height:1.65;color:${F.dampad};margin:0 0 26px">${ingress}</p>
  </td></tr>

  <tr><td style="padding:0 32px">
    ${knapp(knapptext, "{{ .ConfirmationURL }}")}
    <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:${F.mist}">
      Fungerar inte knappen, kopiera den här adressen till webbläsaren:<br>
      <span style="color:${F.dampad};word-break:break-all">{{ .ConfirmationURL }}</span>
    </p>
    ${kropp}
    ${avslut}
  </td></tr>

  <tr><td style="padding:28px 32px 30px">
    <div style="border-top:1px solid ${F.linje};padding-top:16px;font-size:11px;line-height:1.7;color:${F.mist}">
      <b style="color:${F.black}">Kvario</b> — se vad av pengarna som faktiskt är dina<br>
      <a href="https://kvario.se" style="color:${F.mist}">kvario.se</a> ·
      <a href="mailto:info@kvario.se" style="color:${F.mist}">info@kvario.se</a>
      <p style="margin:12px 0 0">Kvario är ett beräknings- och planeringsverktyg, inte skatterådgivning.</p>
    </div>
  </td></tr>

</table>
</body>
</html>`;
}

/* Mall utan länk — skickas när något redan har hänt. */
function beskedmall({ rubrik, ingress, avslut }) {
  return mall({ rubrik, ingress, knapptext: "", avslut })
    .replace(/<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#131E26[\s\S]*?<\/table>\s*<p style="margin:20px 0 0;font-size:12px[\s\S]*?<\/p>/, "");
}

const MALLAR = {
  "1-bekrafta-konto": {
    amne: "Bekräfta din e-postadress",
    html: mall({
      rubrik: "Bekräfta din e-postadress",
      ingress: "Tack för att du skapat ett konto. Klicka nedan så aktiveras det, och dina 14 dagar med Kvario Pro börjar direkt — inget kort behövs.",
      knapptext: "Bekräfta e-postadressen",
      avslut: lugnruta("Har du inte skapat något konto kan du bortse från det här brevet. Ingenting händer förrän länken klickats."),
    }),
  },

  "2-aterstall-losenord": {
    amne: "Återställ ditt lösenord",
    html: mall({
      rubrik: "Välj ett nytt lösenord",
      ingress: "Vi fick en begäran om att återställa lösenordet till ditt Kvario-konto. Länken gäller i en timme.",
      knapptext: "Välj nytt lösenord",
      avslut: lugnruta("Har du inte begärt detta kan du bortse från brevet. Ditt nuvarande lösenord fortsätter att gälla."),
    }),
  },

  "3-ny-epostadress": {
    amne: "Bekräfta din nya e-postadress",
    html: mall({
      rubrik: "Bekräfta din nya e-postadress",
      ingress: "Klicka nedan för att bekräfta <b>{{ .NewEmail }}</b> som din nya adress i Kvario.",
      knapptext: "Bekräfta den nya adressen",
      avslut: lugnruta("Adressen ändras inte förrän länken klickats. Har du inte begärt bytet kan du bortse från brevet."),
    }),
  },

  "4-godkann-adressbyte": {
    amne: "Din e-postadress håller på att bytas",
    html: mall({
      rubrik: "Din e-postadress håller på att bytas",
      ingress: "Vi har fått en begäran om att byta adressen på ditt Kvario-konto till <b>{{ .NewEmail }}</b>.",
      knapptext: "Godkänn bytet",
      avslut: varningsruta(
        "<b>Var det inte du?</b> Klicka inte på länken. Byt lösenord direkt och hör av dig till " +
        '<a href="mailto:info@kvario.se" style="color:#8C6418">info@kvario.se</a> — ett adressbyte du inte begärt kan betyda att någon annan kommit åt kontot.'
      ),
    }),
  },

  "5-losenord-andrat": {
    amne: "Ditt lösenord har ändrats",
    html: beskedmall({
      rubrik: "Ditt lösenord har ändrats",
      ingress: "Lösenordet till ditt Kvario-konto ändrades nyss. Du behöver inte göra något om det var du.",
      avslut: varningsruta(
        "<b>Var det inte du?</b> Återställ lösenordet omedelbart via Glömt lösenordet på " +
        '<a href="https://kvario.se" style="color:#8C6418">kvario.se</a> och hör av dig till ' +
        '<a href="mailto:info@kvario.se" style="color:#8C6418">info@kvario.se</a>.'
      ),
    }),
  },
};

mkdirSync(UT, { recursive: true });
const register = [];

for (const [namn, m] of Object.entries(MALLAR)) {
  writeFileSync(join(UT, `${namn}.html`), m.html);
  register.push(`${namn}.html  —  ämne: ${m.amne}`);
  console.log(`skrev ${namn}.html  (${m.html.length} tecken)`);
}

writeFileSync(join(UT, "LASMIG.txt"),
`E-POSTMALLAR TILL SUPABASE

Genererade av verktyg/gor-epostmallar.mjs. Ändra inte filerna direkt —
kör om skriptet, annars glider de isär från de andra breven.

Klistras in under Authentication -> Emails -> Templates.
Ämnesraden sätts i fältet ovanför HTML-rutan.

${register.join("\n")}

VARIABLERNA MÅSTE STÅ KVAR ORÖRDA:
  {{ .ConfirmationURL }}   länken Supabase skapar
  {{ .NewEmail }}          den nya adressen vid adressbyte

Skrivs de fel skickas brevet utan fungerande länk, och mottagaren
kommer inte vidare.

Mall 4 och 5 syns bara om Secure email change respektive
lösenordsnotiser är påslagna under Authentication.
`);
console.log("skrev LASMIG.txt");
