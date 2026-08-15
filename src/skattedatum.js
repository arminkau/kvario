/* ============================================================
   Skattedatum

   Kvario är inte skatterådgivning. Datumet nedan är Skatteverkets
   vanliga mönster år efter år för den som redovisar moms en gång om
   året tillsammans med inkomstdeklarationen — vanligast bland
   frilansare under omsättningsgränsen. Redovisar du moms varje
   kvartal eller månad i stället gäller andra datum. Kontrollera
   alltid ditt eget datum på skatteverket.se.
   ============================================================ */

/* Andra maj, förskjutet till närmaste vardag om det är helg. */
function inkomstdeklarationDatum(ar) {
  const forsok = new Date(ar, 4, 2); // maj = index 4
  const dag = forsok.getDay();
  if (dag === 0) return new Date(ar, 4, 3); // söndag -> måndag
  if (dag === 6) return new Date(ar, 4, 4); // lördag -> måndag
  return forsok;
}

export function nastaSkattedatum(nu = new Date()) {
  const ar = nu.getFullYear();
  let datum = inkomstdeklarationDatum(ar);
  let inkomstar = ar - 1;
  if (nu > datum) {
    datum = inkomstdeklarationDatum(ar + 1);
    inkomstar = ar;
  }
  const dagarKvar = Math.ceil((datum - nu) / 86400000);
  return { datum, inkomstar, dagarKvar };
}
