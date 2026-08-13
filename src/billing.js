/* ============================================================
   Betalning

   Frontend får ALDRIG bestämma vem som är Pro.
   Den frågar servern, och servern vet det bara via Stripes webhook.
   ============================================================ */

const API = import.meta.env.VITE_API_URL;

/* Tillfälligt id tills du bygger riktig inloggning.
   Byt mot användarens id från din auth så fort du har en. */
function userId() {
  let id = localStorage.getItem("kvario:uid");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("kvario:uid", id);
  }
  return id;
}

/* Skickar användaren till Stripe Checkout.
   Returnerar false om ingen server är konfigurerad, så att
   appen kan falla tillbaka på simulerat Pro under utveckling. */
export async function startCheckout(interval, angerratt = false) {
  if (!API) return false;
  try {
    const r = await fetch(`${API}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: userId(), interval, angerratt }),
    });
    const { url } = await r.json();
    if (url) {
      window.location.href = url;
      return true;
    }
  } catch (e) {
    console.error("Checkout misslyckades", e);
  }
  return false;
}

/* Anropa vid start. Detta är sanningen om användarens plan. */
export async function fetchPlan() {
  if (!API) return null;
  try {
    const r = await fetch(`${API}/me/${userId()}`);
    const { plan } = await r.json();
    return plan;
  } catch {
    return null;
  }
}

/* Öppnar Stripes egen sida för uppsägning, kortbyte och kvitton.
   Bygg inte det själv — det är veckor av arbete du får gratis. */
export async function openPortal() {
  if (!API) return;
  const r = await fetch(`${API}/portal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: userId() }),
  });
  const { url } = await r.json();
  if (url) window.location.href = url;
}
