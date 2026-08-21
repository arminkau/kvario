import { createClient } from "@supabase/supabase-js";

/* ============================================================
   Databasåtkomst från servern

   Servern använder service_role-nyckeln, som går förbi Row Level
   Security. Den får ALDRIG hamna i frontend — med den kan man läsa
   och ändra allt i databasen. Den ligger bara i serverns
   miljövariabler.

   Två saker som gör systemet robust snarare än snabbt:

   1. Idempotens. Stripe skickar om webhooks vid timeout, nätverksfel
      eller om din server svarar långsamt. Utan spärr får samma
      betalning två ordernummer och kunden två mejl. Spärren är ett
      unikt index på stripe_invoice_id.

   2. Atomiskt löpnummer. Numret hämtas med en databasfunktion, inte
      genom att läsa och sedan skriva. Två samtidiga köp kan annars
      få samma nummer.
   ============================================================ */

const url = process.env.SUPABASE_URL;

/* Båda namnen godtas. Supabase kallar nyckeln service_role i sitt
   gränssnitt, och det är lätt att sätta variabeln utan _KEY på
   slutet — jag gjorde själv det misstaget i README, och resultatet
   blev att db blev null och hela databaslagret tystnade. Betalningar
   gick igenom utan att Pro aktiverades. Ett stavfel ska inte kunna
   kosta det. */
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

export const db = url && serviceKey
  ? createClient(url, serviceKey, { auth: { persistSession: false } })
  : null;

/* Läses av /halsa. En server utan databas ser frisk ut utifrån —
   den svarar på allt — men sparar inga ordrar och aktiverar ingen
   prenumeration. Det måste synas. */
export const dbKonfigurerad = Boolean(db);
export const dbSaknar = [
  !url && "SUPABASE_URL",
  !serviceKey && "SUPABASE_SERVICE_ROLE_KEY",
].filter(Boolean);

const MOMSSATS = 0.25;

/* Samma villkor som i breven, av samma källa. brev.js hade redan den
   här kontrollen men db.js saknade den, så kvittot sa "ingen moms
   debiterad" medan ordern i databasen fick moms_ore ifyllt. Det är
   inte en kosmetisk avvikelse utan ett bokföringsfel: momsen fanns
   aldrig, betalades aldrig, och skulle inte redovisas. */
const ARMOMSREGISTRERAD = Boolean(process.env.FORETAG_MOMSNR?.trim());

/* Momsen räknas baklänges ur bruttobeloppet, eftersom priset
   anges inklusive moms mot konsument. Utan momsregistrering finns
   ingen moms i beloppet alls — hela summan är netto. */
export function momsdelar(bruttoOre, sats = MOMSSATS) {
  if (!ARMOMSREGISTRERAD) return { netto: bruttoOre, moms: 0 };
  const netto = Math.round(bruttoOre / (1 + sats));
  return { netto, moms: bruttoOre - netto };
}

/* Returnerar { order, nyskapad }. Är nyskapad false har den här
   betalningen redan hanterats och inget mejl ska skickas igen. */
export async function skapaOrder({
  userId, epost, namn, stripeInvoiceId, stripeCustomerId,
  beloppOre, valuta, interval, betaldAt, periodSlut, angerratt,
}) {
  if (!db) throw new Error("Databasen är inte konfigurerad");

  const { data: befintlig } = await db
    .from("orders")
    .select("*")
    .eq("stripe_invoice_id", stripeInvoiceId)
    .maybeSingle();

  if (befintlig) return { order: befintlig, nyskapad: false };

  const { data: nummer, error: numFel } = await db.rpc("nasta_ordernummer");
  if (numFel) throw numFel;

  const { moms } = momsdelar(beloppOre);

  const rad = (uid) => ({
    ordernummer: nummer,
    user_id: uid,
    epost,
    namn: namn || null,
    stripe_invoice_id: stripeInvoiceId,
    stripe_customer_id: stripeCustomerId,
    belopp_ore: beloppOre,
    moms_ore: moms,
    valuta: valuta || "SEK",
    interval,
    betald_at: betaldAt,
    period_slut: periodSlut,
    angerratt_samtycke: !!angerratt,
  });

  let { data, error } = await db.from("orders").insert(rad(userId || null)).select().single();

  // userId pekar inte på ett riktigt konto (borttaget, eller ett
  // testvärde). Ordern och kvittot ska ändå sparas — bara utan
  // koppling till ett konto — så pengarna aldrig tappas bort.
  if (error?.code === "23503") {
    ({ data, error } = await db.from("orders").insert(rad(null)).select().single());
  }

  if (error) {
    // Kapplöpning: en annan webhookleverans hann före mellan vår
    // kontroll och insert. Hämta den som skapades och gå vidare.
    if (error.code === "23505") {
      const { data: d } = await db.from("orders").select("*")
        .eq("stripe_invoice_id", stripeInvoiceId).single();
      return { order: d, nyskapad: false };
    }
    throw error;
  }

  return { order: data, nyskapad: true };
}

export async function markeraAterbetald(stripeInvoiceId, aterbetaltOre, orsak) {
  if (!db) return null;
  const { data: order } = await db.from("orders").select("*")
    .eq("stripe_invoice_id", stripeInvoiceId).maybeSingle();
  if (!order) return null;

  const totalt = (order.aterbetalt_ore || 0) + aterbetaltOre;
  const { data } = await db.from("orders").update({
    aterbetalt_ore: totalt,
    status: totalt >= order.belopp_ore ? "aterbetald" : "delvis_aterbetald",
    aterbetald_at: new Date().toISOString(),
    aterbetalning_orsak: orsak || null,
  }).eq("id", order.id).select().single();

  return data;
}

export async function hamtaOrder(ordernummer) {
  if (!db) return null;
  const { data } = await db.from("orders").select("*")
    .eq("ordernummer", ordernummer).maybeSingle();
  return data;
}

export async function sattPlan(userId, plan, extra = {}) {
  if (!db || !userId) return;
  await db.from("subscriptions").upsert(
    { user_id: userId, plan, updated_at: new Date().toISOString(), ...extra },
    { onConflict: "user_id" }
  );
}

/* Kundens rad i subscriptions — bland annat stripe_customer_id,
   så att servern kan starta om utan att glömma vem som redan är kund. */
export async function hamtaKund(userId) {
  if (!db || !userId) return null;
  const { data } = await db.from("subscriptions").select("*").eq("user_id", userId).maybeSingle();
  return data;
}

/* Sätter bara stripe_customer_id — rör aldrig plan. Kunden kan
   redan ha en rad från signup-triggern, eller sakna en helt. */
export async function sattStripeKund(userId, customerId) {
  if (!db || !userId) return;
  await db.from("subscriptions").upsert(
    { user_id: userId, stripe_customer_id: customerId, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
}
