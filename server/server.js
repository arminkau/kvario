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
import {
  skickaOrderbekraftelse, skickaValkommen, skickaProvperiodSlutar,
  skickaBetalningMisslyckades, skickaUppsagd, skickaAterbetalning,
  skickaProvbrev, provaEpost, PROVBREV,
  skickaAdminNyttKonto, skickaAdminNyPrenumeration,
} from "./epost.js";
import { skapaOrder, markeraAterbetald, hamtaOrder, hamtaKund, sattStripeKund, sattPlan, db, dbSaknar } from "./db.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();

/* Ett fel i en asynkron rutt blir en oupptäckt promise-rejektion,
   och Node avslutar processen för sådana. En enda trasig förfrågan
   tog alltså ner hela servern för alla andra — vi fick 502 och Fly
   startade om.

   Loggas i stället. Kvarstår problemet syns det i loggen; är det
   övergående fortsätter servern att ta emot betalningar. */
process.on("unhandledRejection", (fel) => {
  console.error("Ohanterat fel, servern fortsätter:", fel?.stack || fel);
});
process.on("uncaughtException", (fel) => {
  console.error("Ohanterat undantag, servern fortsätter:", fel?.stack || fel);
});
/* Både med och utan www. Den som skriver www.kvario.se i webbläsaren
   ska inte mötas av ett tyst CORS-fel vid första betalningen. */
const tillatnaUrsprung = [
  process.env.APP_URL || "http://localhost:5173",
  ...(process.env.APP_URL?.startsWith("https://") && !process.env.APP_URL.includes("www.")
    ? [process.env.APP_URL.replace("https://", "https://www.")]
    : []),
];
app.use(cors({ origin: tillatnaUrsprung }));

/* Lever servern? Svarar utan att röra vare sig databas eller mejl.
   Plattformen pingar den här varje halvminut, och /halsa öppnar en
   riktig SMTP-anslutning — den skulle hamra Strato i onödan och
   dessutom göra hälsokontrollen beroende av att posten fungerar. */
app.get("/", (_req, res) => res.json({ tjanst: "kvario", ok: true }));

/* Säger om servern kan skicka e-post, utan att skicka något. En fel
   nyckel eller ett felstavat lösenord syns då direkt i stället för
   vid första betalningen — där det bara hade blivit en rad i loggen
   som ingen läser.

   smtp-fältet heter så av vana och behålls; via-fältet inuti säger
   vilken väg som faktiskt används. */
/* Kontrollerar att nyckeln och priserna hör till samma läge.

   Stripe håller sandbox och live helt åtskilda, och ett price-id
   som skapats i sandbox finns inte i live. Utan den här kontrollen
   upptäcks det vid första riktiga köpet, med "No such price" — för
   en kund som redan bestämt sig för att betala. */
async function provaStripe() {
  const nyckel = process.env.STRIPE_SECRET_KEY;
  if (!nyckel) return { ok: false, orsak: "STRIPE_SECRET_KEY saknas" };

  const lage = nyckel.startsWith("sk_live_") ? "live"
             : nyckel.startsWith("sk_test_") ? "test"
             : "okänt";

  const priser = {};
  for (const [namn, id] of [["manad", process.env.PRICE_MONTH], ["ar", process.env.PRICE_YEAR]]) {
    if (!id) { priser[namn] = "saknas"; continue; }
    try {
      const p = await stripe.prices.retrieve(id);
      priser[namn] = `${(p.unit_amount / 100).toLocaleString("sv-SE")} ${p.currency.toUpperCase()}${p.active ? "" : " (INAKTIVT)"}`;
    } catch (e) {
      priser[namn] = `FEL: ${e?.message?.slice(0, 90) || "okänt"}`;
    }
  }

  const allaOk = Object.values(priser).every((v) => !String(v).startsWith("FEL") && v !== "saknas");
  return { ok: allaOk, lage, priser };
}

/* Slår mot databasen på riktigt. Att klienten finns säger ingenting
   om att nyckeln duger eller att tabellerna är på plats. */
async function provaDb() {
  const url = process.env.SUPABASE_URL || null;
  if (!db) return { ok: false, url, orsak: `Saknas: ${dbSaknar.join(", ")}` };

  try {
    const { error } = await db.from("subscriptions").select("user_id").limit(1);
    if (!error) return { ok: true, url };

    /* supabase-js sväljer den underliggande orsaken och lämnar bara
       "fetch failed", vilket kan betyda allt från fel adress till
       stängd port. Vi frågar om direkt för att få veta vad det var. */
    let detalj = null;
    try {
      await fetch(`${url}/rest/v1/`, { signal: AbortSignal.timeout(8000) });
    } catch (e) {
      detalj = e?.cause?.code || e?.cause?.message || e?.message || null;
    }
    return { ok: false, url, orsak: error.message, detalj };
  } catch (e) {
    return { ok: false, url, orsak: e?.message || "okänt fel", detalj: e?.cause?.code || null };
  }
}

app.get("/halsa", async (_req, res) => {
  const [epost, stripeLage, databas] = await Promise.all([provaEpost(), provaStripe(), provaDb()]);
  res.json({
    appUrl: process.env.APP_URL || null,
    databas,
    stripe: stripeLage,
    epost,
    smtp: epost,
  });
});

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
  /* Båda måste finnas innan de jämförs.

     Utan den kontrollen blev undefined === undefined sant på en
     server där ADMIN_TOKEN glömts — och då räckte det att låta bli
     att skicka huvudet för att komma in på återbetalningar och
     kundlistor. Ett fel som blir farligt just när något annat redan
     gått snett, vilket är den sämsta tidpunkten. */
  const forvantat = process.env.ADMIN_TOKEN;
  const skickat = req.headers["x-admin-token"];
  if (forvantat && skickat && skickat === forvantat) return true;

  if (await arAdminSession(req)) return true;
  res.status(401).json({ error: "Obehörig" });
  return false;
}


/* ---------- 1. Starta betalning ----------
   Frontend anropar denna när någon klickar "Fortsätt till betalning". */

app.post("/checkout", express.json(), async (req, res) => {
  const { userId, email, interval } = req.body;
  if (!userId) return res.status(400).json({ error: "userId saknas" });

  const nyttCheckoutFörsök = async (customerId) => stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{
      price: interval === "month" ? process.env.PRICE_MONTH : process.env.PRICE_YEAR,
      quantity: 1,
    }],
    // Metadata följer med till webhooken så vi vet vem som betalade.
    // Alla behåller full 14 dagars ångerrätt — vi ber aldrig någon
    // avsäga sig den. Äldre prenumerationer kan ha "ja" sparat och
    // läses fortfarande korrekt i invoice.paid.
    subscription_data: { metadata: { userId, angerratt: "nej" } },
    // Bara namnet, inte hela adressen — den räcker för kvittot och
    // är den enda extra uppgiften som faktiskt behövs.
    custom_fields: [{
      key: "namn",
      label: { type: "custom", custom: "Namn (till kvittot)" },
      type: "text",
      optional: false,
    }],
    success_url: `${process.env.APP_URL}/?betalt=1`,
    cancel_url: `${process.env.APP_URL}/?avbruten=1`,
    allow_promotion_codes: true,
    locale: "sv",
  });

  try {
    const kund = await hamtaKund(userId);
    let customerId = kund?.stripe_customer_id;

    // Återanvänd kunden om personen redan handlat, annars skapa en ny.
    if (!customerId) {
      const customer = await stripe.customers.create({ email, metadata: { userId } });
      customerId = customer.id;
      await sattStripeKund(userId, customerId);
    }

    let session;
    try {
      session = await nyttCheckoutFörsök(customerId);
    } catch (err) {
      // Sparad kund finns inte hos Stripe — t.ex. efter byte av Stripe-
      // konto eller mellan test- och skarpt läge. Skapa en ny i stället
      // för att fastna permanent på en död referens.
      if (err.code === "resource_missing" && err.param === "customer") {
        const customer = await stripe.customers.create({ email, metadata: { userId } });
        customerId = customer.id;
        await sattStripeKund(userId, customerId);
        session = await nyttCheckoutFörsök(customerId);
      } else {
        throw err;
      }
    }

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

      /* Uppsägningsbrevet är det enda tillfället att fråga varför.
         Den som just slutat betala svarar oftare än man tror, och
         svaret är värt mer än brevet kostar att skicka. */
      try {
        const kund = sub.customer ? await stripe.customers.retrieve(sub.customer) : null;
        if (kund?.email) {
          await skickaUppsagd(kund.email, {
            slutar: new Date((sub.current_period_end || sub.canceled_at || Date.now() / 1000) * 1000),
          });
        }
      } catch (err) {
        console.error("Kunde inte skicka uppsägningsbrev:", err?.message || err);
      }
      break;
    }
    /* Namnet kommer via ett eget fält i Checkout (se /checkout), inte
       via billing_address_collection — vi vill bara ha namnet, inte
       hela adressen. Sparas på Stripe-kunden så att invoice.paid kan
       läsa det direkt via faktura.customer_name. */
    case "checkout.session.completed": {
      const session = event.data.object;
      const namn = session.custom_fields?.find((f) => f.key === "namn")?.text?.value;
      if (namn && session.customer) {
        try { await stripe.customers.update(session.customer, { name: namn }); }
        catch (err) { console.error("Kunde inte spara namnet på kunden:", err); }
      }
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
        // user_id är en uuid-kolumn med foreign key mot auth.users.
        // Ett trasigt eller ogiltigt userId i metadata ska aldrig
        // få hela ordern att falla — bara kopplingen till kontot.
        const raradUid = sub?.metadata?.userId;
        const uid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raradUid || "")
          ? raradUid
          : null;
        const interval = sub?.items?.data?.[0]?.price?.recurring?.interval || "year";
        const betaldAt = new Date((faktura.status_transitions?.paid_at || faktura.created) * 1000);
        const periodSlut = sub?.current_period_end ? new Date(sub.current_period_end * 1000) : null;

        const { order, nyskapad } = await skapaOrder({
          userId: uid,
          epost: faktura.customer_email,
          namn: faktura.customer_name || null,
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
            namn: order.namn,
            belopp: order.belopp_ore,
            interval,
            betaldatum: betaldAt,
            periodSlut: periodSlut || betaldAt,
            angerrattSamtycke: order.angerratt_samtycke,
            fakturaUrl: faktura.hosted_invoice_url || faktura.invoice_pdf,
          });

          // Ditt eget besked, efter kundens kvitto. Samma spärr mot
          // dubbletter gäller — Stripe gör om leveransen vid fel.
          await skickaAdminNyPrenumeration({
            epost: order.epost,
            namn: order.namn,
            ordernummer: order.ordernummer,
            belopp: order.belopp_ore,
            interval,
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
        const order = charge.invoice
          ? await markeraAterbetald(charge.invoice, charge.amount_refunded, "Återbetald via Stripe")
          : null;

        /* Kvitto på återbetalningen. Köparen behöver det som underlag
           i sin egen bokföring — momsen måste specificeras även när
           pengarna går åt andra hållet.

           Adressen tas från ordern, inte från Stripe-betalningen.
           billing_details fylls bara i när kortet krävde adress, och
           saknas ofta helt. */
        const till = order?.epost || charge.billing_details?.email || charge.receipt_email;
        if (till) {
          await skickaAterbetalning(till, {
            ordernummer: order?.ordernummer || "—",
            belopp: charge.amount_refunded,
            helt: charge.amount_refunded >= charge.amount,
          });
        }
      } catch (err) {
        console.error("Kunde inte logga återbetalning:", err);
      }
      break;
    }

    /* Stänger inte av direkt — Stripe gör flera återförsök innan
       prenumerationen faktiskt avslutas. Brevet är brådskande för
       kunden men inte för oss: kortet måste bytas av dem. */
    case "invoice.payment_failed": {
      const faktura = event.data.object;
      console.log("Betalning misslyckades för", userId || faktura.customer);
      try {
        const till = faktura.customer_email;
        if (till) {
          await skickaBetalningMisslyckades(till, {
            belopp: faktura.amount_due,
            nastaForsok: faktura.next_payment_attempt ? new Date(faktura.next_payment_attempt * 1000) : null,
            portalUrl: null,
          });
        }
      } catch (err) {
        console.error("Kunde inte skicka betalningsbrev:", err?.message || err);
      }
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

/* ---------- Nytt konto ----------
   Kontot skapas i Supabase, inte här, så vi får veta det via en
   databas-webhook på auth.users. Den skickar en hemlighet i huvudet
   som måste stämma — annars kunde vem som helst utlösa brev genom
   att gissa adresser.

   Se README för hur webhooken sätts upp. */
app.post("/hook/nytt-konto", express.json(), async (req, res) => {
  const hemlighet = process.env.SUPABASE_HOOK_SECRET;
  if (!hemlighet || req.headers["x-hook-secret"] !== hemlighet) {
    return res.status(401).json({ error: "Obehörig" });
  }

  // Supabase skickar { type, table, record, old_record }
  const epost = req.body?.record?.email;
  if (!epost) return res.status(400).json({ error: "Ingen e-postadress i anropet" });

  const r = await skickaValkommen(epost);

  /* Ditt eget besked. Skickas efter kundens, och får inte fälla
     anropet — uteblir det spelar det ingen roll för användaren som
     just registrerat sig. */
  let antal = null;
  try {
    if (db) {
      const { count } = await db.from("subscriptions").select("user_id", { count: "exact", head: true });
      antal = count ?? null;
    }
    await skickaAdminNyttKonto({ epost, antal });
  } catch (err) {
    console.error("Kunde inte skicka adminbesked:", err?.message || err);
  }

  res.json({ skickad: r.skickad });
});

/* ---------- Påminnelse om provperioden ----------
   Körs av ett schemalagt anrop, inte av en händelse — det finns
   ingen webhook för "tre dagar kvar". Railway har cron, eller så
   räcker en gratis kronotjänst som pingar adressen dagligen.

   Idempotent: kollar paminnelse_skickad i subscriptions så att ett
   dubbelt anrop inte ger två brev. */
app.post("/jobb/provperiod", express.json(), async (req, res) => {
  if (!(await kravAdmin(req, res))) return;
  // Utan den här kraschade anropet på db.from() av en null-referens.
  if (!db) return res.status(503).json({ error: `Databasen saknas: ${dbSaknar.join(", ")}` });

  const DAGAR_INNAN = 3;
  const nu = new Date();
  const granslage = new Date(nu.getTime() + DAGAR_INNAN * 86400000);

  const { data: rader, error } = await db
    .from("subscriptions")
    .select("user_id, trial_start, plan, paminnelse_skickad")
    .eq("plan", "free")
    .is("paminnelse_skickad", null);

  if (error) return res.status(500).json({ error: error.message });

  let skickade = 0;
  for (const r of rader || []) {
    if (!r.trial_start) continue;
    const slutar = new Date(new Date(r.trial_start).getTime() + 14 * 86400000);
    if (slutar > granslage || slutar < nu) continue;   // inte inom fönstret

    /* Adressen bor i auth.users, inte i subscriptions. Den hämtas
       per rad i stället för att dubbellagras — en kopia hade behövt
       hållas i takt med adressbyten, och det är just den sortens
       synkning som tyst går sönder. Volymen är en handfull om dagen. */
    const { data: anv } = await db.auth.admin.getUserById(r.user_id);
    const epost = anv?.user?.email;
    if (!epost) continue;

    const svar = await skickaProvperiodSlutar(epost, {
      dagarKvar: Math.ceil((slutar - nu) / 86400000),
      slutar,
    });
    if (svar.skickad) {
      await db.from("subscriptions")
        .update({ paminnelse_skickad: new Date().toISOString() })
        .eq("user_id", r.user_id);
      skickade++;
    }
  }
  res.json({ granskade: rader?.length || 0, skickade });
});

/* ---------- Provbrev ----------
   Skickar vilket som helst av breven med påhittade uppgifter till en
   adress du anger. Utan den går e-posten bara att prova genom att
   faktiskt köpa något, säga upp något och misslyckas med en betalning
   — och då upptäcks ett fel först när en riktig kund väntar.

   Bakom adminspärren med flit: annars hade vem som helst kunnat
   skicka brev i ditt namn från din server. */
app.post("/admin/provbrev", express.json(), async (req, res) => {
  if (!(await kravAdmin(req, res))) return;

  const till = req.body?.epost;
  const sort = req.body?.sort || "order";
  if (!till || !/^\S+@\S+\.\S+$/.test(till)) {
    return res.status(400).json({ error: "Ange en giltig e-postadress" });
  }
  if (!PROVBREV[sort]) {
    return res.status(400).json({ error: `Okänd brevsort. Välj en av: ${Object.keys(PROVBREV).join(", ")}` });
  }

  const r = await skickaProvbrev(till, sort);
  if (!r.skickad) return res.status(502).json({ error: r.orsak || "Kunde inte skicka" });
  res.json({ skickad: true, till, sort });
});

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
