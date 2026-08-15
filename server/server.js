/* ============================================================
   Kvario — minimal prenumerationsserver

   Detta är den enda delen som inte kan ligga i webbläsaren:
   Stripes hemliga nyckel får aldrig lämna servern.

   Kör:
     npm i express stripe cors
     STRIPE_SECRET_KEY=sk_... STRIPE_WEBHOOK_SECRET=whsec_... \
     PRICE_MONTH=price_... PRICE_YEAR=price_... node server.js

   I Stripe Dashboard skapar du en produkt "Kvario Pro" med två priser:
   99 kr/månad och 990 kr/år. Sätt valuta till SEK.
   ============================================================ */

import express from "express";
import Stripe from "stripe";
import cors from "cors";
import { skickaOrderbekraftelse } from "./epost.js";
import { skapaOrder, markeraAterbetald, hamtaOrder, hamtaKund, sattStripeKund, sattPlan, db } from "./db.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();
app.use(cors({ origin: process.env.APP_URL || "http://localhost:5173" }));

/* Kundens Stripe-id och plan läses från subscriptions, inte från
   minnet i processen. En in-memory Map nollställs vid varje omstart
   (vanligt på Railways gratisnivå) — utan detta skulle varje omstart
   ge nya, dubbla Stripe-kunder för samma person. */

/* ---------- Adminbehörighet ----------
   Två vägar in: ADMIN_TOKEN för curl/manuellt bruk (se README), eller
   en inloggad admins egen Supabase-session för adminpanelen i appen.
   Panelen kan aldrig få ADMIN_TOKEN — den ligger bara i webbläsaren
   och skulle kunna läsas ut av vem som helst som öppnar konsolen. */
async function arAdminSession(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || !db) return false;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return false;
  const { data: roll } = await db.from("roller").select("admin").eq("user_id", data.user.id).maybeSingle();
  return roll?.admin === true;
}

async function kravAdmin(req, res) {
  if (req.headers["x-admin-token"] === process.env.ADMIN_TOKEN) return true;
  if (await arAdminSession(req)) return true;
  res.status(401).json({ error: "Obehörig" });
  return false;
}


/* ---------- 1. Starta betalning ----------
   Frontend anropar denna när någon klickar "Fortsätt till betalning". */

app.post("/checkout", express.json(), async (req, res) => {
  const { userId, email, interval, angerratt } = req.body;
  if (!userId) return res.status(400).json({ error: "userId saknas" });

  try {
    const kund = await hamtaKund(userId);
    let customerId = kund?.stripe_customer_id;

    // Återanvänd kunden om personen redan handlat, annars skapa en ny.
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { userId },
      });
      customerId = customer.id;
      await sattStripeKund(userId, customerId);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{
        price: interval === "month" ? process.env.PRICE_MONTH : process.env.PRICE_YEAR,
        quantity: 1,
      }],
      // Metadata följer med till webhooken så vi vet vem som betalade.
      // Metadata följer med till webhooken. Samtycket till omedelbar
      // leverans måste dokumenteras — utan det gäller 14 dagars
      // ångerrätt även efter att kunden börjat använda tjänsten.
      subscription_data: { metadata: { userId, angerratt: angerratt ? "ja" : "nej" } },
      success_url: `${process.env.APP_URL}/?betalt=1`,
      cancel_url: `${process.env.APP_URL}/?avbruten=1`,
      allow_promotion_codes: true,
      locale: "sv",
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Kunde inte starta betalningen" });
  }
});


/* ---------- 2. Webhook ----------
   Detta är den del folk hoppar över och sedan får problem med.
   Lita ALDRIG på success_url för att aktivera Pro — den kan öppnas
   av vem som helst. Bara webhooken vet att pengarna kom fram.

   OBS: express.raw måste ligga före express.json på denna route,
   annars går signaturkontrollen inte att göra. */

app.post("/stripe-webhook", express.raw({ type: "application/json" }), async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Signaturen stämmer inte: ${err.message}`);
  }

  const sub = event.data.object;
  const userId = sub.metadata?.userId;

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      if (!userId) break;
      const active = ["active", "trialing"].includes(sub.status);
      await sattPlan(userId, active ? "pro" : "free", {
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      });
      break;
    }
    case "customer.subscription.deleted": {
      if (!userId) break;
      await sattPlan(userId, "free");
      break;
    }
    /* Orderbekräftelsen skickas här, inte från frontend.
       invoice.paid är det enda som säkert betyder att pengarna
       kommit fram. */
    case "invoice.paid": {
      const faktura = event.data.object;
      try {
        // Nyare API-versioner flyttade subscription-fältet till
        // parent.subscription_details.subscription — kollar båda
        // så att en Stripe-uppdatering inte tyst tappar bort vem
        // som betalade och aldrig sätter kontot till Pro.
        const subscriptionId = faktura.subscription || faktura.parent?.subscription_details?.subscription;
        const sub = subscriptionId
          ? await stripe.subscriptions.retrieve(subscriptionId)
          : null;
        const uid = sub?.metadata?.userId;
        const interval = sub?.items?.data?.[0]?.price?.recurring?.interval || "year";
        const betaldAt = new Date((faktura.status_transitions?.paid_at || faktura.created) * 1000);
        const periodSlut = sub?.current_period_end ? new Date(sub.current_period_end * 1000) : null;

        const { order, nyskapad } = await skapaOrder({
          userId: uid,
          epost: faktura.customer_email,
          stripeInvoiceId: faktura.id,
          stripeCustomerId: faktura.customer,
          beloppOre: faktura.amount_paid,
          valuta: (faktura.currency || "sek").toUpperCase(),
          interval,
          betaldAt: betaldAt.toISOString(),
          periodSlut: periodSlut?.toISOString() || null,
          angerratt: sub?.metadata?.angerratt === "ja",
        });

        await sattPlan(uid, "pro", {
          current_period_end: periodSlut?.toISOString() || null,
          stripe_customer_id: faktura.customer,
        });

        // Skickas bara första gången. Stripe gör om leveransen vid
        // fel, och kunden ska inte få samma kvitto två gånger.
        if (nyskapad) {
          await skickaOrderbekraftelse({
            ordernummer: order.ordernummer,
            epost: order.epost,
            belopp: order.belopp_ore,
            interval,
            betaldatum: betaldAt,
            periodSlut: periodSlut || betaldAt,
            angerrattSamtycke: order.angerratt_samtycke,
            fakturaUrl: faktura.hosted_invoice_url || faktura.invoice_pdf,
          });
        }
      } catch (err) {
        // Ett fel här får aldrig fälla webhooken. Svarar vi något
        // annat än 200 gör Stripe om leveransen i timmar.
        console.error("Kunde inte hantera invoice.paid:", err);
      }
      break;
    }

    /* Återbetalningar loggas oavsett om de görs härifrån eller
       direkt i Stripes kontrollpanel. */
    case "charge.refunded": {
      try {
        const charge = event.data.object;
        if (charge.invoice) {
          await markeraAterbetald(charge.invoice, charge.amount_refunded, "Återbetald via Stripe");
        }
      } catch (err) {
        console.error("Kunde inte logga återbetalning:", err);
      }
      break;
    }

    case "invoice.payment_failed": {
      // Skicka ett vänligt mejl. Stänger inte av direkt — Stripe gör
      // flera återförsök innan prenumerationen faktiskt avslutas.
      console.log("Betalning misslyckades för", userId);
      break;
    }
  }

  res.json({ received: true });
});


/* ---------- 3. Vilken plan har jag? ----------
   Frontend frågar denna vid inloggning. Planen får aldrig komma
   från klienten — det är hela poängen med betalväggen. */

app.get("/me/:userId", async (req, res) => {
  const kund = await hamtaKund(req.params.userId);
  res.json({ plan: kund?.plan || "free", renewsAt: kund?.current_period_end || null });
});


/* ---------- 4. Hantera prenumerationen ----------
   Stripes egen portal sköter uppsägning, kortbyte och kvitton.
   Bygg inte det själv. */

app.post("/portal", express.json(), async (req, res) => {
  const kund = await hamtaKund(req.body.userId);
  if (!kund?.stripe_customer_id) return res.status(400).json({ error: "Ingen kund" });

  const session = await stripe.billingPortal.sessions.create({
    customer: kund.stripe_customer_id,
    return_url: process.env.APP_URL,
  });
  res.json({ url: session.url });
});


/* ---------- 5. Återbetalning ----------
   Skyddad med en enkel adminnyckel. Det räcker för en ensam
   utvecklare, men bygg riktig inloggning innan någon annan
   ska kunna göra återbetalningar. */

app.post("/admin/aterbetala", express.json(), async (req, res) => {
  if (!(await kravAdmin(req, res))) return;

  const { ordernummer, belopp, orsak, begaranId } = req.body;
  try {
    const order = await hamtaOrder(ordernummer);
    if (!order) return res.status(404).json({ error: "Ordern finns inte" });

    const kvarAttAterbetala = order.belopp_ore - (order.aterbetalt_ore || 0);
    const summa = belopp ? Math.round(belopp * 100) : kvarAttAterbetala;
    if (summa <= 0 || summa > kvarAttAterbetala) {
      return res.status(400).json({ error: `Beloppet måste vara mellan 1 och ${kvarAttAterbetala / 100} kr` });
    }

    // Hitta betalningen bakom fakturan
    const faktura = await stripe.invoices.retrieve(order.stripe_invoice_id);
    if (!faktura.charge) return res.status(400).json({ error: "Ingen betalning att återbetala" });

    const refund = await stripe.refunds.create({
      charge: faktura.charge,
      amount: summa,
      reason: "requested_by_customer",
      metadata: { ordernummer, orsak: orsak || "" },
    });

    // charge.refunded-webhooken uppdaterar också, men vi skriver
    // direkt så att svaret till dig blir korrekt på en gång.
    const uppdaterad = await markeraAterbetald(order.stripe_invoice_id, summa, orsak);

    // Godkänns en begäran från Återbetalningar-fliken, stäng den —
    // annars ligger den kvar som "Väntar" trots att den är klar.
    if (begaranId && db) {
      await db.from("aterbetalningar")
        .update({ status: "genomford", hanterad_at: new Date().toISOString() })
        .eq("id", begaranId);
    }

    res.json({ ok: true, refundId: refund.id, order: uppdaterad });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* Lista ordrar — enkel översikt utan att behöva öppna Stripe. */
app.get("/admin/ordrar", async (req, res) => {
  if (!(await kravAdmin(req, res))) return;
  const { data, error } = await db
    .from("orders").select("*").order("betald_at", { ascending: false }).limit(100);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Kvario-servern lyssnar på :${PORT}`));
