/* ============================================================
   Gemensam mall för alla brev

   Ett enda ställe för ram, färger och fot. Breven skrivs annars
   isär över tid: någon får en knapp i fel färg, någon annan tappar
   företagsuppgifterna i foten, och det syns först hos mottagaren.

   E-post är inte webb. Tabeller i stället för flex och grid, allt
   formatvärde inline, och inga externa bilder — Gmail och Outlook
   tar bort <style> i huvudet och blockerar bilder tills mottagaren
   tillåter dem. Märket ritas därför som text och färgade rutor.
   ============================================================ */

const F = {
  botten: "#E4EBE7",
  papper: "#FAFCFB",
  black: "#131E26",
  dampad: "#4A5D68",
  linje: "#C6D3CD",
  massing: "#B8862B",
  massingMork: "#8C6418",
  mist: "#8698A1",
  varning: "#9A4A25",
};

/* Momsnumret avgör om säljaren är momsregistrerad. Är det tomt tas
   ingen moms ut, och då får kvittot varken specificera moms eller
   ange ett momsnummer — att visa moms man inte har rätt att ta ut är
   fel uppgift till både kunden och bokföringen.

   Organisationsnumret är frivilligt av ett skäl som gäller just
   enskild firma: där ÄR organisationsnumret personnumret. På ett
   kvitto för nittionio kronor, långt under gränsen för förenklad
   faktura, finns ingen anledning att sprida det. */
const tomt = (v) => !v || !String(v).trim();

export const SALJARE = {
  namn: process.env.FORETAG_NAMN || "[Ditt företagsnamn]",
  orgnr: tomt(process.env.FORETAG_ORGNR) ? null : process.env.FORETAG_ORGNR.trim(),
  adress: process.env.FORETAG_ADRESS || "[Gatuadress, postnummer, ort]",
  epost: process.env.FORETAG_EPOST || "[din@epost.se]",
  momsreg: tomt(process.env.FORETAG_MOMSNR) ? null : process.env.FORETAG_MOMSNR.trim(),
};

export const ARMOMSREGISTRERAD = Boolean(SALJARE.momsreg);

export const APP_URL = process.env.APP_URL || "https://kvario.se";

export const kr = (ore) => (ore / 100).toLocaleString("sv-SE", { minimumFractionDigits: 2 });
export const datum = (d) => new Date(d).toLocaleDateString("sv-SE");

/* Skyddar mot att ett namn eller en adress bryter ut ur HTML:en.
   Uppgifterna kommer från Stripe och från registreringen, alltså
   utifrån — de ska aldrig tolkas som markup. */
export function fly(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function knapp(text, url) {
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td
      style="background:${F.black};border-radius:3px">
      <a href="${fly(url)}" style="display:inline-block;color:${F.papper};text-decoration:none;
         font-size:13px;font-weight:600;padding:12px 24px">${fly(text)}</a>
    </td></tr></table>`;
}

export function ruta(rubrik, innehall, ton = "lugn") {
  const kant = ton === "varning" ? F.varning : F.massing;
  return `<div style="background:${F.botten};border-left:3px solid ${kant};border-radius:0 4px 4px 0;padding:15px 17px">
    <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${F.mist};font-weight:600;margin-bottom:7px">${fly(rubrik)}</div>
    <p style="margin:0;font-size:12.5px;line-height:1.65;color:${F.dampad}">${innehall}</p>
  </div>`;
}

/* Rader med etikett och belopp, som en liten tabell. */
export function rader(poster) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px">
    ${poster.map(([etikett, varde, stark]) => `
      <tr>
        <td style="padding:9px 0;border-top:1px solid ${F.linje};color:${stark ? F.black : F.dampad}${stark ? ";font-weight:700" : ""}">${fly(etikett)}</td>
        <td align="right" style="padding:9px 0;border-top:1px solid ${F.linje};font-family:monospace${stark ? `;font-weight:700;color:${F.massingMork}` : ""}">${varde}</td>
      </tr>`).join("")}
  </table>`;
}

/* Ramen. rubrik och ingress står överst, kropp är fri HTML. */
export function brev({ rubrik, ingress, kropp, fot }) {
  return `<!doctype html>
<html lang="sv"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${fly(rubrik)}</title></head>
<body style="margin:0;padding:24px;background:${F.botten};font-family:-apple-system,'Segoe UI',Roboto,sans-serif;color:${F.black}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:${F.papper};border-radius:6px">

<tr><td style="padding:32px 32px 0">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td width="26" style="padding-right:9px">
      <div style="width:26px;height:26px;background:${F.black};border-radius:6px"></div>
    </td>
    <td style="font-size:19px;font-weight:700;letter-spacing:-.02em;color:${F.black}">Kvario</td>
  </tr></table>
  <h1 style="font-size:22px;font-weight:700;margin:20px 0 6px;line-height:1.25">${fly(rubrik)}</h1>
  ${ingress ? `<p style="font-size:14px;line-height:1.6;color:${F.dampad};margin:0 0 24px">${ingress}</p>` : ""}
</td></tr>

<tr><td style="padding:0 32px">${kropp}</td></tr>

<tr><td style="padding:26px 32px 30px">
  <div style="border-top:1px solid ${F.linje};padding-top:16px;font-size:11px;line-height:1.7;color:${F.mist}">
    ${fot ? `<p style="margin:0 0 12px;font-size:12px;line-height:1.6;color:${F.dampad}">${fot}</p>` : ""}
    <b style="color:${F.black}">${fly(SALJARE.namn)}</b><br>
    ${[
      SALJARE.orgnr && `Org.nr ${fly(SALJARE.orgnr)}`,
      SALJARE.momsreg && `Momsreg.nr ${fly(SALJARE.momsreg)}`,
    ].filter(Boolean).join(" · ")}${SALJARE.orgnr || SALJARE.momsreg ? "<br>" : ""}
    ${fly(SALJARE.adress)}<br>
    <a href="mailto:${fly(SALJARE.epost)}" style="color:${F.mist}">${fly(SALJARE.epost)}</a>
    <p style="margin:14px 0 0">
      Kvario är ett beräknings- och planeringsverktyg, inte skatterådgivning.
    </p>
  </div>
</td></tr>
</table>
</body></html>`;
}

/* Textversionen. Vissa klienter visar bara den, och ett brev utan
   textdel får sämre bedömning av skräppostfiltren. */
export function textbrev({ rubrik, stycken, fot }) {
  // Samma villkor som i HTML-foten. Saknas numren ska de utelämnas,
  // inte skrivas ut som "null" — vilket de gjorde.
  const identitet = [
    SALJARE.orgnr && `org.nr ${SALJARE.orgnr}`,
    SALJARE.momsreg && `momsreg.nr ${SALJARE.momsreg}`,
  ].filter(Boolean).join(", ");

  return [
    rubrik,
    "",
    ...stycken,
    "",
    fot || "",
    identitet ? `${SALJARE.namn}, ${identitet}` : SALJARE.namn,
    SALJARE.adress,
    SALJARE.epost,
    APP_URL,
  ].filter((r) => r !== null && r !== undefined).join("\n");
}
