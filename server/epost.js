/* ============================================================
   Orderbekräftelse via e-post

   Skickas från webhooken när Stripe bekräftat betalningen.
   Aldrig från frontend — en bekräftelse får bara gå ut när
   pengarna faktiskt kommit fram.

   Kräver ett e-postkonto hos en leverantör. Resend har en gratis
   nivå som räcker långt: sätt RESEND_API_KEY och verifiera din
   domän, annars hamnar breven i skräpposten.

   TVÅ SAKER SOM MÅSTE VARA RÄTT:

   1. Momsen ska specificeras med belopp och sats. Köparen kan
      behöva den för sin egen bokföring.

   2. Ångerrätten för digitala tjänster upphör bara om kunden
      uttryckligen samtyckt till omedelbar leverans OCH bekräftat
      att ångerrätten då går förlorad. Samtycket måste dokumenteras
      — därför står det i bekräftelsen och sparas i databasen.
      Utan det har kunden 14 dagars ångerrätt även efter att ha
      använt tjänsten.
   ============================================================ */

const AVSANDARE = process.env.EPOST_AVSANDARE || "Kvario <no-reply@dindoman.se>";

export const SALJARE = {
  namn: process.env.FORETAG_NAMN || "[Ditt företagsnamn]",
  orgnr: process.env.FORETAG_ORGNR || "[Organisationsnummer]",
  adress: process.env.FORETAG_ADRESS || "[Gatuadress, postnummer, ort]",
  epost: process.env.FORETAG_EPOST || "[din@epost.se]",
  momsreg: process.env.FORETAG_MOMSNR || "[SE000000000001]",
};

const kr = (ore) => (ore / 100).toLocaleString("sv-SE", { minimumFractionDigits: 2 });
const datum = (d) => new Date(d).toLocaleDateString("sv-SE");

/* Momsen räknas baklänges ur bruttobeloppet, eftersom priset
   anges inklusive moms mot konsument. */
function momsdelar(bruttoOre, sats = 0.25) {
  const netto = Math.round(bruttoOre / (1 + sats));
  return { netto, moms: bruttoOre - netto, brutto: bruttoOre, sats };
}

export function orderbekraftelseHtml({
  ordernummer, epost, namn, belopp, interval, betaldatum,
  periodSlut, angerrattSamtycke, fakturaUrl,
}) {
  const m = momsdelar(belopp);
  const plan = interval === "month" ? "Kvario Pro, månadsvis" : "Kvario Pro, årsvis";
  const period = interval === "month" ? "1 månad" : "12 månader";

  return `<!doctype html>
<html lang="sv"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#E4EBE7;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;color:#131E26">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#FAFCFB;border-radius:6px">
<tr><td style="padding:32px 32px 0">
  <div style="font-size:19px;font-weight:700;letter-spacing:-.02em">Kvario</div>
  <h1 style="font-size:22px;font-weight:700;margin:18px 0 6px">Tack för din beställning</h1>
  <p style="font-size:14px;line-height:1.6;color:#4A5D68;margin:0 0 26px">
    Din prenumeration är aktiverad och alla funktioner är upplåsta.
  </p>
</td></tr>

<tr><td style="padding:0 32px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px">
    <tr><td style="padding:9px 0;border-top:1px solid #C6D3CD;color:#4A5D68">Ordernummer</td>
        <td align="right" style="padding:9px 0;border-top:1px solid #C6D3CD;font-family:monospace">${ordernummer}</td></tr>
    <tr><td style="padding:9px 0;border-top:1px solid #C6D3CD;color:#4A5D68">Betaldatum</td>
        <td align="right" style="padding:9px 0;border-top:1px solid #C6D3CD">${datum(betaldatum)}</td></tr>
    <tr><td style="padding:9px 0;border-top:1px solid #C6D3CD;color:#4A5D68">Beställare</td>
        <td align="right" style="padding:9px 0;border-top:1px solid #C6D3CD">${namn ? `${namn}<br><span style="color:#8698A1;font-size:12px">${epost}</span>` : epost}</td></tr>
  </table>
</td></tr>

<tr><td style="padding:26px 32px 0">
  <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8698A1;font-weight:600;margin-bottom:10px">Sammanfattning</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px">
    <tr><td style="padding:10px 0;border-top:1px solid #C6D3CD">
          <b>${plan}</b><br>
          <span style="color:#8698A1;font-size:12px">Period ${period}, förnyas ${datum(periodSlut)}</span>
        </td>
        <td align="right" style="padding:10px 0;border-top:1px solid #C6D3CD;font-family:monospace">${kr(m.brutto)} kr</td></tr>
    <tr><td style="padding:8px 0;color:#4A5D68">Varav netto</td>
        <td align="right" style="padding:8px 0;font-family:monospace">${kr(m.netto)} kr</td></tr>
    <tr><td style="padding:8px 0;color:#4A5D68">Varav moms ${Math.round(m.sats * 100)} %</td>
        <td align="right" style="padding:8px 0;font-family:monospace">${kr(m.moms)} kr</td></tr>
    <tr><td style="padding:12px 0;border-top:2px solid #131E26"><b>Totalt betalt</b></td>
        <td align="right" style="padding:12px 0;border-top:2px solid #131E26;font-family:monospace;font-weight:700;color:#8C6418">${kr(m.brutto)} kr</td></tr>
  </table>
</td></tr>

${fakturaUrl ? `<tr><td style="padding:22px 32px 0">
  <a href="${fakturaUrl}" style="display:inline-block;background:#131E26;color:#FAFCFB;text-decoration:none;font-size:13px;font-weight:600;padding:11px 22px;border-radius:3px">Ladda ner kvitto som PDF</a>
</td></tr>` : ""}

<tr><td style="padding:26px 32px 0">
  <div style="background:#E4EBE7;border-radius:5px;padding:16px 18px">
    <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8698A1;font-weight:600;margin-bottom:8px">Ångerrätt</div>
    <p style="margin:0;font-size:12px;line-height:1.65;color:#4A5D68">
      ${angerrattSamtycke
        ? `Du begärde att tjänsten skulle levereras omedelbart och bekräftade att ångerrätten
           då upphör när leveransen påbörjats. Tjänsten aktiverades ${datum(betaldatum)}.
           Du kan fortfarande säga upp prenumerationen när som helst och behåller tillgången
           till ${datum(periodSlut)}.`
        : `Som konsument har du 14 dagars ångerrätt från köpet. Kontakta ${SALJARE.epost}
           om du vill utnyttja den. Prenumerationen kan sägas upp när som helst och du
           behåller tillgången till ${datum(periodSlut)}.`}
    </p>
  </div>
</td></tr>

<tr><td style="padding:24px 32px 0">
  <p style="margin:0;font-size:12px;line-height:1.65;color:#4A5D68">
    Prenumerationen förnyas automatiskt tills du säger upp den. Du hanterar den, byter kort
    och hämtar kvitton via länken i appen under Din data.
  </p>
</td></tr>

<tr><td style="padding:24px 32px 30px">
  <div style="border-top:1px solid #C6D3CD;padding-top:16px;font-size:11px;line-height:1.7;color:#8698A1">
    <b style="color:#131E26">${SALJARE.namn}</b><br>
    Org.nr ${SALJARE.orgnr} · Momsreg.nr ${SALJARE.momsreg}<br>
    ${SALJARE.adress}<br>
    ${SALJARE.epost}
    <p style="margin:14px 0 0">
      Kvario är ett beräknings- och planeringsverktyg, inte skatterådgivning.
    </p>
  </div>
</td></tr>
</table>
</body></html>`;
}

/* Textversion — vissa e-postklienter visar bara den, och det
   höjer chansen att brevet inte hamnar i skräpposten. */
export function orderbekraftelseText({ ordernummer, namn, belopp, interval, betaldatum, periodSlut }) {
  const m = momsdelar(belopp);
  return `Tack för din beställning

Ordernummer: ${ordernummer}
${namn ? `Beställare: ${namn}\n` : ""}Betaldatum: ${datum(betaldatum)}

${interval === "month" ? "Kvario Pro, månadsvis" : "Kvario Pro, årsvis"}
Netto: ${kr(m.netto)} kr
Moms ${Math.round(m.sats * 100)} %: ${kr(m.moms)} kr
Totalt betalt: ${kr(m.brutto)} kr

Förnyas ${datum(periodSlut)}. Kan sägas upp när som helst.

${SALJARE.namn}, org.nr ${SALJARE.orgnr}
${SALJARE.epost}`;
}

/* Skickar brevet. Byt leverantör här om du väljer en annan —
   resten av koden behöver inte ändras. */
export async function skickaOrderbekraftelse(data) {
  const nyckel = process.env.RESEND_API_KEY;
  if (!nyckel) {
    console.warn("RESEND_API_KEY saknas — ingen orderbekräftelse skickad till", data.epost);
    return { skickad: false };
  }

  const svar = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${nyckel}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: AVSANDARE,
      to: data.epost,
      subject: `Orderbekräftelse ${data.ordernummer} — Kvario Pro`,
      html: orderbekraftelseHtml(data),
      text: orderbekraftelseText(data),
    }),
  });

  if (!svar.ok) {
    console.error("Kunde inte skicka orderbekräftelse:", await svar.text());
    return { skickad: false };
  }
  return { skickad: true };
}
