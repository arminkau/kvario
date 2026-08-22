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
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  skickaOrderbekraftelse, skickaValkommen, skickaProvperiodSlutar,
  skickaBetalningMisslyckades, skickaUppsagd, skickaAterbetalning,
  skickaProvbrev, provaEpost, PROVBREV,
  skickaAdminNyttKonto, skickaAdminNyPrenumeration, skickaAdminAterbetalning,
  skickaAdminUppsagd, skickaAdminBetalningsfel, skickaUtskick,
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
    /* De valfria bitarna. Utan dem fungerar allt annat, men något
       tystnar — och tystnad är svårt att felsöka. Adressen skrivs ut
       eftersom det är din egen och en felstavning annars bara syns
       som uteblivna brev. */
    konfig: {
      adminEpost: process.env.ADMIN_EPOST || null,
      hookHemlighetSatt: Boolean(process.env.SUPABASE_HOOK_SECRET),
      adminTokenSatt: Boolean(process.env.ADMIN_TOKEN),
    },
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

/* ---------- Periodens slut ur en prenumeration ----------

   Stripe flyttade current_period_end från prenumerationen till dess
   rader i API-version 2025-03-31. På ett konto som kör den versionen
   är fältet borta där koden letade, och new Date(undefined * 1000)
   ger Invalid Date.

   Det kraschade hela webhook-hanteraren på .toISOString() — innan
   planen hann sparas. Uppsägningen registrerades därför aldrig, och
   felet syntes bara som "RangeError: Invalid time value" i loggen
   eftersom unhandledRejection fångade det och lät servern gå vidare.

   Läser båda formerna. Saknas datumet i båda returneras null, och den
   som frågar får avgöra vad som ska hända — aldrig ett ogiltigt Date
   som går sönder först några rader senare. */
function periodSlutet(sub) {
  const sekunder = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end ?? null;
  if (!Number.isFinite(sekunder)) return null;
  const d = new Date(sekunder * 1000);
  return Number.isNaN(d.getTime()) ? null : d;
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
  const { userId, email, interval, plattform } = req.body;
  if (!userId) return res.status(400).json({ error: "userId saknas" });

  /* Startade köpet i mobilappen läggs retur=app på returadressen. Sidan
     som Stripe skickar till studsar då vidare till se.kvario.app://betalt
     och lämnar tillbaka kunden till appen.

     Stripe godtar bara http och https i success_url, så djuplänken kan
     inte stå här direkt — därför omvägen via en sida på kvario.se. */
  const retur = plattform === "app" ? "&retur=app" : "";

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
    success_url: `${process.env.APP_URL}/?betalt=1${retur}`,
    cancel_url: `${process.env.APP_URL}/?avbruten=1${retur}`,
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

  /* ---------- Kvittera först, arbeta sedan ----------

     Stripe väntar bara några sekunder på ett svar. Handlaren nedan gör
     databasfrågor, hämtar kunden från Stripe och skickar två brev över
     SMTP innan den var klar — och en SMTP-anslutning till Strato tar
     sekunder i sig. Svaret kom alltså för sent.

     Resultatet blev 32 timeouts sedan 18 augusti, och ett brev från
     Stripe om att endpointen stängs av 27 augusti. Arbetet blev ändå
     gjort — servern räknade färdigt efter att Stripe gett upp — så
     ingenting såg trasigt ut från appens sida. Bara långsamt, och bara
     synligt hos Stripe.

     Priset för att kvittera direkt: misslyckas något efteråt skickar
     Stripe inte om händelsen, eftersom vi redan sagt att den kom fram.
     Därför loggas fel högljutt här. Det är avvägningen Stripe själva
     rekommenderar, och den rätta: ett tyst omförsök som ändå hinner
     göra timeout hjälper ingen. */
  res.json({ received: true });

  try {
    await hanteraStripeHandelse(event);
  } catch (fel) {
    console.error(`Webhooken ${event.type} misslyckades efter kvittens:`, fel?.stack || fel);
  }
});

/* Varje hanterad händelse loggas, inte bara de som skickar brev.

   Utan det här gick det inte att svara på "vad ändrade planen?" — en
   lyckad subscription.updated skrev till databasen och lämnade inget
   spår alls. Två gånger har jag stått med en ändrad rad och en tyst
   logg, och gissat. Det är en rad kod för att slippa gissa. */
function loggaHandelse(event, utfall) {
  const o = event.data?.object || {};
  const detaljer = [
    o.status && `status=${o.status}`,
    o.cancel_at_period_end !== undefined && `uppsagd=${o.cancel_at_period_end}`,
    o.metadata?.userId && `user=${String(o.metadata.userId).slice(0, 8)}`,
  ].filter(Boolean).join(" ");
  console.log(`Stripe ${event.type}: ${utfall}${detaljer ? ` — ${detaljer}` : ""}`);
}

async function hanteraStripeHandelse(event) {
  const sub = event.data.object;
  const userId = sub.metadata?.userId;

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      if (!userId) break;
      const active = ["active", "trialing"].includes(sub.status);

      /* Uppsägningen syntes ingenstans förut.

         Stripe raderar inte prenumerationen när kunden säger upp den —
         den fortsätter vara active med cancel_at_period_end satt, och
         customer.subscription.deleted kommer först när perioden löper
         ut, alltså upp till en månad senare.

         Servern lyssnade bara på deleted. Alltså: inget brev till
         kunden, inget till admin, ingenting i appen och ingenting i
         adminpanelen — trots att kunden just sagt upp. Det såg ut som
         att uppsägningen inte gick igenom. */
      const uppsagd = Boolean(sub.cancel_at_period_end);
      const kundrad = await hamtaKund(userId);
      const varUppsagd = Boolean(kundrad?.uppsagd_at);
      const slutar = periodSlutet(sub) || (kundrad?.current_period_end ? new Date(kundrad.current_period_end) : null);

      /* Betald period gäller, oavsett hur uppsägningen gjordes.

         Förut satte status ensam planen: allt utom active och trialing
         gav free. En uppsägning som Stripe utför direkt i stället för
         vid periodens slut nollade därför Pro på en kund som betalat
         till den 18 september — och kontot föll tillbaka på
         provperioden, som om köpet aldrig skett.

         Kunden har betalat för tiden. Att ta bort den för att
         uppsägningen registrerades på ett annat sätt är fel, och det
         är oss den skulle gynna. */
      const kvarAvPerioden = slutar && slutar.getTime() > Date.now();
      const skaHaPro = active || kvarAvPerioden;

      /* Uppsagd är inte samma sak som cancel_at_period_end.

         Det fältet är bara sant när uppsägningen sker vid periodens
         slut. Avslutas prenumerationen direkt är det falskt, medan
         status blir canceled — och den kombinationen nollade flaggan
         på en kund som just sagt upp.

         Flaggan tas bort bara vid en riktig återaktivering: aktiv
         status och ingen väntande uppsägning. */
      const arAvslutad = uppsagd || sub.status === "canceled";
      const uppsagdTid = arAvslutad
        ? (kundrad?.uppsagd_at || new Date().toISOString())
        : null;

      await sattPlan(userId, skaHaPro ? "pro" : "free", {
        /* Utelämnas helt om Stripe inte skickade med något datum, i
           stället för att skriva null. Ett null hade raderat perioden vi
           redan fått från invoice.paid. */
        ...(slutar ? { current_period_end: slutar.toISOString() } : {}),
        uppsagd_at: uppsagdTid,
      });

      loggaHandelse(event, `plan=${skaHaPro ? "pro" : "free"} uppsagd_at=${uppsagdTid ? "satt" : "null"} period=${slutar ? slutar.toISOString().slice(0, 10) : "-"}`);

      // Brev bara vid övergången, inte vid varje uppdatering Stripe skickar.
      if (arAvslutad && !varUppsagd) {
        try {
          const kund = sub.customer ? await stripe.customers.retrieve(sub.customer) : null;
          if (kund?.email) {
            await skickaUppsagd(kund.email, { slutar });
            await skickaAdminUppsagd({ epost: kund.email, slutar });
          }
        } catch (e) {
          console.error("Kunde inte skicka uppsägningsbrev:", e?.message || e);
        }
      }
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
          const slutar = periodSlutet(sub)
            || (sub.canceled_at ? new Date(sub.canceled_at * 1000) : new Date());
          await skickaUppsagd(kund.email, { slutar });
          await skickaAdminUppsagd({ epost: kund.email, slutar });
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
        /* Samma flytt som ovan gäller här. Den här raden gav null i
           stället för att krascha, så orderbekräftelsen skickades ändå
           — men utan förnyelsedatum, och prenumerationsraden fick
           ingen period att räkna nåd på. */
        const periodSlut = periodSlutet(sub);

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
          const nastaForsok = faktura.next_payment_attempt ? new Date(faktura.next_payment_attempt * 1000) : null;
          await skickaBetalningMisslyckades(till, {
            belopp: faktura.amount_due, nastaForsok, portalUrl: null,
          });
          await skickaAdminBetalningsfel({ epost: till, belopp: faktura.amount_due, nastaForsok });
        }
      } catch (err) {
        console.error("Kunde inte skicka betalningsbrev:", err?.message || err);
      }
      break;
    }
  }
}


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
    /* Utan locale gissar Stripe utifrån webbläsaren, och kunden kunde
       hamna på en engelsk sida mitt i en svensk app. Kassan sattes till
       "sv" från början; portalen glömdes bort. */
    locale: "sv",
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

/* ---------- Begäran om återbetalning ----------
   Begäran skapas av kunden själv i appen och hamnar direkt i
   databasen. Servern får därför veta via samma sorts trigger som
   nya konton — se README.

   Det här är det enda adminbrevet som är brådskande: ångerrätten
   ger fjorton dagar från att du fått veta, och en begäran som
   ligger osedd i panelen är en frist som rinner ut. */
app.post("/hook/aterbetalning", express.json(), async (req, res) => {
  const hemlighet = process.env.SUPABASE_HOOK_SECRET;
  if (!hemlighet || req.headers["x-hook-secret"] !== hemlighet) {
    return res.status(401).json({ error: "Obehörig" });
  }

  const rad = req.body?.record;
  if (!rad) return res.status(400).json({ error: "Ingen rad i anropet" });

  // Adressen bor i auth.users, inte i begäran.
  let epost = "okänd";
  try {
    if (db && rad.user_id) {
      const { data } = await db.auth.admin.getUserById(rad.user_id);
      epost = data?.user?.email || epost;
    }
  } catch { /* adressen är trevlig att ha, inte nödvändig */ }

  const r = await skickaAdminAterbetalning({
    epost,
    belopp: rad.belopp_ore,
    orsak: rad.orsak,
    automatisk: rad.automatisk === true,
  });
  res.json({ skickad: r.skickad });
});

/* ---------- Påminnelse om provperioden ----------
   Det finns ingen webhook för "tre dagar kvar", så någon måste fråga
   med jämna mellanrum. Den frågan ställer servern numera själv, längst
   ned i filen — se kommentaren där om varför inte GitHub.

   Bruten ur endpointen så att timern och HTTP-anropet kör exakt samma
   kod. Två kopior av villkoret för när ett brev ska gå ut hade glidit
   isär, och den sortens glidning märks först när fel kund får fel brev.

   Idempotent: kollar paminnelse_skickad i subscriptions så att ett
   dubbelt anrop inte ger två brev. Det är också vad som gör det
   ofarligt att köra den ofta. */
async function kollaProvperioder() {
  if (!db) throw new Error(`Databasen saknas: ${dbSaknar.join(", ")}`);

  const DAGAR_INNAN = 3;
  const nu = new Date();
  const granslage = new Date(nu.getTime() + DAGAR_INNAN * 86400000);

  const { data: rader, error } = await db
    .from("subscriptions")
    .select("user_id, trial_start, plan, paminnelse_skickad")
    .eq("plan", "free")
    .is("paminnelse_skickad", null);

  if (error) throw new Error(error.message);

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
  return { granskade: rader?.length || 0, skickade };
}

/* Kvar för att kunna köra jobbet för hand vid felsökning, utan att
   vänta på nästa varv. */
app.post("/jobb/provperiod", express.json(), async (req, res) => {
  if (!(await kravAdmin(req, res))) return;
  // Utan den här kraschade anropet på db.from() av en null-referens.
  if (!db) return res.status(503).json({ error: `Databasen saknas: ${dbSaknar.join(", ")}` });
  try {
    res.json(await kollaProvperioder());
  } catch (fel) {
    res.status(500).json({ error: fel.message });
  }
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

/* ---------- Massutskick ----------

   Avregistreringslänken måste fungera utan inloggning: den som vill
   slippa fler brev ska inte behöva minnas ett lösenord för att komma
   bort. Samtidigt får länken inte gå att gissa — annars kan vem som
   helst avregistrera någon annan.

   Lösningen är en signatur i länken i stället för ett sparat token.
   Den räknas fram ur användarens id och en hemlighet servern redan
   har, så det finns ingen tabell att hålla i takt och inget som kan
   bli inaktuellt.

   timingSafeEqual och inte === : en vanlig jämförelse avbryter vid
   första felaktiga tecknet, och den skillnaden i tid går att mäta sig
   fram till rätt signatur med. */
function utskickSignatur(userId) {
  const hemlighet = process.env.ADMIN_TOKEN || process.env.SUPABASE_HOOK_SECRET || "";
  return createHmac("sha256", hemlighet).update(`utskick:${userId}`).digest("hex").slice(0, 32);
}

function signaturStammer(userId, signatur) {
  const vantad = Buffer.from(utskickSignatur(userId));
  const fick = Buffer.from(String(signatur || ""));
  return vantad.length === fick.length && timingSafeEqual(vantad, fick);
}

/* Serverns egen adress, inte appens.

   Länken byggdes mot APP_URL, alltså kvario.se — men rutten ligger
   här på servern. kvario.se är en ensidesapp: okända sökvägar serverar
   index.html, så mottagaren hamnade på landningssidan och blev aldrig
   avregistrerad. Inget felmeddelande, ingen aning om att det inte
   fungerat.

   FLY_APP_NAME sätts av plattformen, så adressen stämmer utan att
   någon behöver komma ihåg att sätta den. */
const SERVER_URL = process.env.SERVER_URL
  || (process.env.FLY_APP_NAME ? `https://${process.env.FLY_APP_NAME}.fly.dev` : `http://localhost:${process.env.PORT || 3000}`);

const avregistreraUrlFor = (userId) =>
  `${SERVER_URL}/avregistrera?u=${userId}&s=${utskickSignatur(userId)}`;

/* Svarar med en sida och inte med JSON — det här är en länk någon
   klickar på i sitt e-postprogram, inte ett API-anrop. */
app.get("/avregistrera", async (req, res) => {
  const { u, s } = req.query;
  const sida = (rubrik, text) => res.status(200).send(
    `<!doctype html><html lang="sv"><head><meta charset="utf-8">
     <meta name="viewport" content="width=device-width,initial-scale=1">
     <title>${rubrik}</title></head>
     <body style="margin:0;padding:48px 24px;background:#E4EBE7;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;color:#12211C">
     <div style="max-width:460px;margin:0 auto;background:#F7FAF8;border-radius:6px;padding:36px 32px">
     <h1 style="margin:0 0 14px;font-size:19px">${rubrik}</h1>
     <p style="margin:0;font-size:14px;line-height:1.7;color:#4A5D68">${text}</p>
     <p style="margin:22px 0 0"><a href="${process.env.APP_URL}" style="color:#8A6420">Till Kvario</a></p>
     </div></body></html>`);

  if (!u || !signaturStammer(u, s)) {
    return sida("Länken gäller inte", "Den här avregistreringslänken är felaktig eller ofullständig. Svara på brevet du fick så tar vi bort dig för hand.");
  }
  if (!db) return sida("Något gick fel", "Vi kunde inte nå databasen just nu. Försök igen om en stund.");

  try {
    await db.from("subscriptions")
      .update({ utskick_av: new Date().toISOString() })
      .eq("user_id", u);
  } catch {
    return sida("Något gick fel", "Vi kunde inte spara ditt val. Svara på brevet så tar vi bort dig för hand.");
  }
  /* Tydligt om vad som faktiskt slutar komma. "Du är avregistrerad"
     utan mer får folk att tro att kvitton och orderbekräftelser också
     upphör — och de måste fortsätta gå ut. */
  return sida("Klart, du är avregistrerad",
    "Du får inga fler nyhetsbrev eller allmänna utskick från oss. Brev som rör din egen order, din prenumeration och din betalning fortsätter komma — dem är vi skyldiga att skicka.");
});

/* Grupperna motsvarar valen i adminpanelen. */
async function utskickMottagare(grupp) {
  const { data: rader, error } = await db
    .from("subscriptions")
    .select("user_id, plan, trial_start, utskick_av");
  if (error) throw new Error(error.message);

  const nu = Date.now();
  const provAktiv = (r) => r.trial_start && (nu - new Date(r.trial_start).getTime()) / 86400000 < 14;

  const valda = (rader || []).filter((r) => {
    // Avregistrerade får aldrig massutskick, oavsett vald grupp.
    if (r.utskick_av) return false;
    if (grupp === "pro") return r.plan === "pro";
    if (grupp === "trial") return r.plan !== "pro" && provAktiv(r);
    if (grupp === "utgangen") return r.plan !== "pro" && r.trial_start && !provAktiv(r);
    return true;
  });

  /* Adresserna bor i auth.users. En rad utan konto kan finnas kvar om
     kontot raderats, och den ska hoppas över tyst. */
  const med = [];
  for (const r of valda) {
    const { data } = await db.auth.admin.getUserById(r.user_id);
    const epost = data?.user?.email;
    if (epost) med.push({ userId: r.user_id, epost });
  }
  return med;
}

const UTSKICK_TAK = 200;

app.post("/admin/utskick", express.json(), async (req, res) => {
  if (!(await kravAdmin(req, res))) return;
  if (!db) return res.status(503).json({ error: `Databasen saknas: ${dbSaknar.join(", ")}` });

  const { mottagare = "alla", amne, text } = req.body || {};
  if (!amne?.trim() || !text?.trim()) {
    return res.status(400).json({ error: "Ämne och meddelande måste fyllas i" });
  }

  let lista;
  try { lista = await utskickMottagare(mottagare); }
  catch (e) { return res.status(500).json({ error: e.message }); }

  if (!lista.length) return res.json({ mottagare: 0, skickade: 0, misslyckade: 0 });

  /* Taket finns för att svaret ska hinna fram. Vid fler mottagare
     behöver utskicket köras i bakgrunden med en kö, och det är inte
     byggt — bättre att säga ifrån än att låta anropet timeouta mitt i
     och lämna halva listan skickad utan att någon vet vilka. */
  if (lista.length > UTSKICK_TAK) {
    return res.status(400).json({
      error: `${lista.length} mottagare är fler än vad utskicket klarar i ett svep (${UTSKICK_TAK}). Hör av dig så bygger vi kö.`,
    });
  }

  let skickade = 0;
  const misslyckade = [];
  for (const m of lista) {
    const svar = await skickaUtskick(m.epost, {
      amne: amne.trim(),
      text: text.trim(),
      avregistreraUrl: avregistreraUrlFor(m.userId),
    });
    if (svar.skickad) skickade++;
    else misslyckade.push(m.epost);
    /* Paus mellan breven. Strato stryper avsändare som kommer med
       hundra meddelanden på en sekund, och då hamnar resten i kö eller
       i skräpposten hos mottagarna. */
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(`Utskick "${amne}" till ${mottagare}: ${skickade} av ${lista.length} skickade`);
  res.json({ mottagare: lista.length, skickade, misslyckade: misslyckade.length, adresser: misslyckade });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Kvario-servern lyssnar på :${PORT}`));

/* ---------- Inbyggd schemaläggning ----------

   Jobbet låg tidigare i ett GitHub-workflow. Det har en fälla: i ett
   publikt repo stänger GitHub av schemalagda workflows efter 60 dagar
   utan aktivitet i repot. Går det två månader utan en commit slutar
   alltså både påminnelsebreven och Supabase-aktiviteten — tyst, och
   just när projektet är som mest bortglömt.

   Servern har inte det problemet. fly.toml håller den vid liv med
   auto_stop_machines = 'off' och min_machines_running = 1, eftersom
   Stripes webhook måste kunna landa när som helst. En maskin som
   ändå står och snurrar dygnet runt kan lika gärna ställa frågan
   själv, utan konto hos någon tredje part som kan sluta fungera.

   Två saker på en gång: breven går ut, och frågan mot subscriptions
   räknas som aktivitet hos Supabase, vars fria plan pausar projekt
   efter sju dygn utan trafik.

   Var sjätte timme och inte en gång om dygnet, för att ett enstaka
   misslyckat varv inte ska kosta en hel dag. Extra varv är gratis:
   paminnelse_skickad gör körningen idempotent, så ingen får två brev.
   Av samma skäl är det ofarligt om appen någon gång skalas till fler
   maskiner som alla kör sin egen timer. */
const KOLL_TIMMAR = 6;
let kollPagar = false;

async function provperiodsvarv(anledning) {
  /* En hängande databasfråga får inte stapla varv på varandra. Utan
     flaggan hade en tyst timeout på tio minuter gett två samtidiga
     körningar, och båda hade läst samma rader innan någon hann
     skriva paminnelse_skickad. */
  if (kollPagar) return;
  kollPagar = true;
  try {
    const r = await kollaProvperioder();
    console.log(`Provperiodskoll (${anledning}): granskade ${r.granskade}, skickade ${r.skickade}`);
  } catch (fel) {
    /* Loggas men kastas aldrig vidare. En misslyckad koll får inte
       fälla servern — då stannar även betalningarna. */
    console.error(`Provperiodskollen misslyckades (${anledning}):`, fel?.message || fel);
  } finally {
    kollPagar = false;
  }
}

/* Inte direkt vid start: en omstart mitt i en deploy ska hinna få upp
   databasanslutningen först, och ett par deployer i rad ska inte ge
   en skur av körningar. */
setTimeout(() => provperiodsvarv("start"), 60_000);
setInterval(() => provperiodsvarv("timer"), KOLL_TIMMAR * 3600_000);
