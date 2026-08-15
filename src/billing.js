/* ============================================================
   Betalning

   Frontend får ALDRIG bestämma vem som är Pro.
   Den frågar servern, och servern vet det bara via Stripes webhook.

   userId måste vara samma id som auth.users.id — subscriptions och
   orders har en foreign key mot den tabellen. Ett lokalt påhittat id
   skulle få varje webhook att misslyckas tyst med en FK-överträdelse,
   och betalande kunder skulle aldrig bli Pro i databasen.
   ============================================================ */

const API = import.meta.env.VITE_API_URL;

/* Skickar användaren till Stripe Checkout.
   reason "unconfigured" (ingen server/inget userId) är det enda läge
   där appen ska falla tillbaka på simulerat Pro — det är till för
   utveckling utan server. Ett verkligt fel ska visas som ett fel,
   aldrig tystas ner till gratis Pro. */
export async function startCheckout(userId, interval) {
  if (!API || !userId) return { ok: false, reason: "unconfigured" };
  try {
    const r = await fetch(`${API}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, interval }),
    });
    const data = await r.json();
    if (r.ok && data.url) {
      window.location.href = data.url;
      return { ok: true };
    }
    return { ok: false, reason: "error", message: data.error };
  } catch (e) {
    console.error("Checkout misslyckades", e);
    return { ok: false, reason: "error", message: e.message };
  }
}

/* Anropa vid start. Detta är sanningen om användarens plan. */
export async function fetchPlan(userId) {
  if (!API || !userId) return null;
  try {
    const r = await fetch(`${API}/me/${userId}`);
    const { plan } = await r.json();
    return plan;
  } catch {
    return null;
  }
}

/* Öppnar Stripes egen sida för uppsägning, kortbyte och kvitton.
   Bygg inte det själv — det är veckor av arbete du får gratis. */
export async function openPortal(userId) {
  if (!API || !userId) return;
  const r = await fetch(`${API}/portal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  const { url } = await r.json();
  if (url) window.location.href = url;
}

/* Adminåtgärd. accessToken är den inloggade adminens egen
   Supabase-session — servern verifierar den mot roller-tabellen
   innan något återbetalas. Panelen har aldrig ADMIN_TOKEN. */
export async function adminAterbetala({ accessToken, ordernummer, belopp, orsak, begaranId }) {
  if (!API) throw new Error("Ingen server konfigurerad");
  const r = await fetch(`${API}/admin/aterbetala`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ ordernummer, belopp, orsak, begaranId }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Återbetalningen misslyckades");
  return data;
}
