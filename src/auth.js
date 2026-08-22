import { createClient } from "@supabase/supabase-js";
import { Preferences } from "@capacitor/preferences";
import { Browser } from "@capacitor/browser";
import { App as NativeApp } from "@capacitor/app";

/* ============================================================
   Inloggning

   Supabase sköter konton, sessioner och lösenordslösa länkar.
   Gratis upp till 50 000 användare per månad.

   Är nycklarna inte satta kör appen vidare utan konto och
   sparar lokalt — så att du kan utveckla utan att sätta upp något.
   ============================================================ */

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasAuth = Boolean(url && key);

/* anon-nyckeln är publik med flit. Det som skyddar datan är
   Row Level Security i databasen, inte att nyckeln är hemlig. */

/* ---------- Var sessionen sparas ----------
   I webbläsaren duger localStorage. I appen gör den inte det:
   Androids webbvy garanterar inte att localStorage hinner skrivas
   till disk innan processen dödas, så den som stängde appen kunde
   få logga in igen. Testat — samma konto låg kvar i Chrome på
   telefonen men inte i appen.

   Inuti appen sparas sessionen därför i telefonens egen lagring
   via Capacitor, som överlever att appen stängs.

   Bara i appen. På webben skulle ett byte av lagring logga ut alla
   som redan är inloggade, eftersom nycklarna heter något annat. */
/* isPluginAvailable, inte bara isNativePlatform. Webbkoden hämtas från
   sajten medan den nativa delen sitter i den installerade appen, så en
   äldre app kan mycket väl köra den här raden utan att ha modulen. Då
   kastar Capacitor "not implemented on android" och appen blir vit.
   Med kontrollen faller den istället tillbaka på localStorage — samma
   beteende som förut, tills användaren installerat den nya appen. */
const harPlugin = (namn) => {
  try {
    const C = window.Capacitor;
    return C?.isNativePlatform?.() === true && C?.isPluginAvailable?.(namn) === true;
  } catch { return false; }
};

const iApp = harPlugin("Preferences");

/* Läses av Konto-fliken. Att raden syns är också vårt enda kvitto på
   att bytet slog igenom — vi kan inte köra appen härifrån. */
export const sessionLagring = iApp ? "app" : "webblasare";

const telefonLagring = {
  getItem: async (nyckel) => (await Preferences.get({ key: nyckel })).value ?? null,
  setItem: async (nyckel, varde) => { await Preferences.set({ key: nyckel, value: varde }); },
  removeItem: async (nyckel) => { await Preferences.remove({ key: nyckel }); },
};

/* Inställningarna nedan är Supabases standardvärden, utskrivna med
   flit. Att en inloggning överlever att appen stängs är inget man
   vill att en framtida biblioteksuppdatering ska kunna ändra tyst. */
export const supabase = hasAuth
  ? createClient(url, key, {
      auth: {
        persistSession: true,      // överlever omstart
        autoRefreshToken: true,    // förnyar accesstoken innan den går ut
        detectSessionInUrl: true,  // krävs för Google och återställningslänkar
        ...(iApp ? { storage: telefonLagring } : {}),
      },
    })
  : null;

/* ---------- Förnyelse när appen vaknar ----------
   autoRefreshToken drivs av en timer. Ligger appen i bakgrunden på
   telefonen fryser den timern, och när användaren kommer tillbaka
   kan accesstoken ha gått ut. Utan det här kan appen visa
   inloggningsrutan i en sekund innan den hämtat sig — eller fastna
   där om första anropet råkar gå före förnyelsen.

   getSession() förnyar av sig själv när token är utgången, så det
   räcker att fråga efter den vid uppvaknandet. */
export function bevakaSession() {
  if (!hasAuth) return () => {};

  const vakna = () => {
    if (document.visibilityState === "visible") supabase.auth.getSession();
  };

  document.addEventListener("visibilitychange", vakna);
  window.addEventListener("focus", vakna);
  return () => {
    document.removeEventListener("visibilitychange", vakna);
    window.removeEventListener("focus", vakna);
  };
}

/* ---------- Länkar som pekar hit i stället för på Supabase ----------
   Supabases färdiga länk går till projektets egen adress, som är en
   slumpsträng: sjdcxtalwnbtuaxgywbr.supabase.co. Mitt i ett
   bekräftelsemejl ser den ut som nätfiske, och det är precis den
   sortens tvekan man inte vill ha vid registreringen.

   I stället skickar mallarna bara engångstoken, och länken byggs mot
   kvario.se. Den här funktionen växlar in den mot en session.

   Typen avgör vad som händer efteråt: signup och invite loggar in,
   recovery ger en session som bara duger till att sätta nytt
   lösenord, email_change bekräftar bytet. */
export async function loginViaToken({ token_hash, type }) {
  const { data, error } = await supabase.auth.verifyOtp({ token_hash, type });
  if (error) throw error;
  return data;
}

/* ---------- Lösenord ----------
   Appens huvudsakliga inloggning. Den magiska länken är borttagen:
   den var lätt att missförstå, eftersom en redan använd länk gav
   samma tysta återgång till startsidan som ett misslyckat försök. */
export async function signInWithPassword(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/* Kräver bekräftelsemejl om Supabase-projektet har "Confirm email"
   påslaget (standard) — kontot blir då inte inloggat förrän länken
   i det mejlet klickats. */
export async function signUpWithPassword(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
  return data;
}

/* ---------- Glömt lösenord ----------
   Även för konton som aldrig haft ett lösenord — t.ex. de som
   skapades via den nu borttagna magiska länken. Skickar en länk
   som loggar in med en tillfällig session, se sattNyttLosenord. */
export async function skickaLosenordsAterstallning(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
}

export async function sattNyttLosenord(nyttLosenord) {
  const { error } = await supabase.auth.updateUser({ password: nyttLosenord });
  if (error) throw error;
}

/* Byter inloggnings-e-post. Supabase skickar en bekräftelselänk till
   den nya adressen — bytet sker först när länken klickats, så att
   ingen kan låsa ut någon annan genom att skriva fel adress. */
export async function bytEpost(nyEpost) {
  const { error } = await supabase.auth.updateUser(
    { email: nyEpost },
    { emailRedirectTo: window.location.origin }
  );
  if (error) throw error;
}

/* Kundens egna ordrar. RLS släpper bara igenom de egna raderna. */
export async function fetchOrdrar(userId) {
  const { data, error } = await supabase
    .from("orders")
    .select("ordernummer, betald_at, belopp_ore, moms_ore, valuta, interval, status, aterbetalt_ore, period_slut")
    .eq("user_id", userId)
    .order("betald_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

/* ---------- Google ----------
   Slås på i Supabase under Authentication -> Providers.

   I appen är det här krångligare än det ser ut. Google vägrar visa
   sin inloggningsruta i en inbäddad webbvy, så inloggningen måste
   ske utanför appen. Frågan är bara vart användaren kommer tillbaka.

   Förut pekade redirectTo på webbplatsen. Då skapades sessionen i
   webbläsaren i stället för i appen, och den som stängde appen och
   öppnade igen var utloggad — trots att hen nyss loggat in.

   Nu öppnas Google i en flik ovanpå appen, och svaret skickas till
   se.kvario.app://auth, som Android lämnar tillbaka till appen. Se
   intent-filter i AndroidManifest.xml.

   APP_ADRESS måste finnas bland tillåtna Redirect URLs i Supabase,
   annars vägrar Supabase skicka vidare dit. */
const APP_ADRESS = "se.kvario.app://auth";

/* ---------- Retur från Stripe ----------

   Kassan ligger på checkout.stripe.com, alltså utanför appens egen
   adress. Öppnas den med window.location lämnar man appen och hamnar
   i systemets webbläsare — där man aldrig loggat in, och där man blev
   stående efter att ha betalat.

   I stället öppnas den i en flik ovanpå appen, precis som Google, och
   Stripe skickar tillbaka till en sida som studsar vidare hit. Då är
   man tillbaka i appen med sin session i behåll.

   Adressen måste stå i AndroidManifest.xml och i Info.plist, samma
   ställen som se.kvario.app://auth. */
const APP_BETALT = "se.kvario.app://betalt";

/* Prenumeranterna sitter i App.jsx. En uppsättning i stället för en
   enda funktion: React kan montera om och registrera sig på nytt, och
   en ensam variabel hade då tappat den förra utan att märkas. */
const betalningsLyssnare = new Set();

export function narBetalningReturnerar(fn) {
  betalningsLyssnare.add(fn);
  return () => betalningsLyssnare.delete(fn);
}

/* Öppnar Stripe i en flik ovanpå appen. Faller tillbaka på vanlig
   navigering när plugin saknas — då fungerar köpet ändå, det blir
   bara den gamla vägen via webbläsaren. */
export async function oppnaIAppen(url) {
  if (!harPlugin("Browser")) { window.location.href = url; return false; }
  await Browser.open({ url, presentationStyle: "popover" });
  return true;
}

export const betalningGarIAppen = harPlugin("Browser") && harPlugin("App");

/* Svaret kan se ut på två sätt, och det är inte vi som väljer vilket.

   supabase-js kör flowType "implicit" som standard. Då kommer nycklarna
   tillbaka i adressens fragment, efter #, och sätts direkt. Med "pkce"
   kommer i stället en engångskod som byts mot en session.

   Båda hanteras här. Antog man bara det ena blev resultatet att appen
   tog emot svaret och tyst slängde det — vilket är svårare att upptäcka
   än ett fel, eftersom ingenting alls händer. */
async function taEmotSvar(url) {
  if (!url?.startsWith(APP_ADRESS)) return false;
  /* Lyssnaren sätts numera upp även utan Supabase, för betalningens
     skull. Utan den här raden anropades auth på en klient som är null
     när nycklarna saknas. */
  if (!hasAuth) return false;

  const delEfter = (tecken) =>
    url.includes(tecken) ? url.slice(url.indexOf(tecken) + 1) : "";

  // Fragmentet först: ligger det ett # i adressen hör frågedelen till
  // det som står före, inte efter.
  const fragment = new URLSearchParams(delEfter("#"));
  const fraga = new URLSearchParams(
    (url.includes("?") ? url.slice(url.indexOf("?") + 1) : "").split("#")[0]
  );

  const fel = fragment.get("error_description") || fragment.get("error")
           || fraga.get("error_description") || fraga.get("error");
  if (fel) throw new Error(fel);

  const stang = async () => { try { await Browser.close(); } catch {} };

  const access_token = fragment.get("access_token");
  const refresh_token = fragment.get("refresh_token");
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;
    await stang();
    return true;
  }

  const code = fraga.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    await stang();
    return true;
  }

  return false;
}

/* Lyssnaren sätts upp en gång, inte per inloggning.

   Skälet är att svaret inte alltid kommer till en app som står och
   väntar. Ligger Google framme en stund kan Android hinna döda appen
   bakom, och då startar den om när svaret kommer — utan att någon
   lyssnare hunnit registreras. Adressen ligger i stället i
   startintentet, och getLaunchUrl är det enda stället den finns.

   Att båda vägarna leder till samma funktion gör att en inloggning
   som råkar komma tillbaka på det ena sättet inte beter sig
   annorlunda än den som kommer tillbaka på det andra. */
/* Två sorters retur kommer in här: inloggningen och betalningen. De
   skiljs på adressen och inte på ordningen de kommer i — appen kan bli
   väckt av vilken som helst av dem först. */
async function taEmotDjuplank(url) {
  if (!url) return false;

  if (url.startsWith(APP_BETALT)) {
    /* Fliken stängs innan lyssnarna körs. Låg den kvar hamnade
       kvittot bakom Stripes sida, och det såg ut som att ingenting
       hände fastän betalningen gått igenom. */
    try { await Browser.close(); } catch { /* redan stängd */ }
    const avbruten = url.includes("avbruten=1");
    for (const fn of betalningsLyssnare) {
      try { fn({ avbruten }); } catch { /* en trasig lyssnare får inte stoppa de andra */ }
    }
    return true;
  }

  return taEmotSvar(url);
}

if (harPlugin("App")) {
  NativeApp.addListener("appUrlOpen", ({ url }) => {
    taEmotDjuplank(url).catch(() => {});
  });
  NativeApp.getLaunchUrl()
    .then((r) => taEmotDjuplank(r?.url))
    .catch(() => {});
}

/* Sant i appen oavsett vilka moduler den har. Skilt från harPlugin
   för att kunna säga varför något inte går, i stället för att tyst
   välja en väg som ändå inte kan fungera. */
export const iNativApp = (() => {
  try { return window.Capacitor?.isNativePlatform?.() === true; }
  catch { return false; }
})();

export const googleGarIAppen = harPlugin("Browser") && harPlugin("App");

export async function signInWithGoogle() {
  /* En äldre app hamnar annars på webbvägen, och den kan inte
     fungera här: den skickar webbvyn till Google, som vägrar visa
     sin inloggning i en inbäddad vy. Resultatet blir en knapp som
     inte gör något — vilket är precis vad som gick att missta för
     ett fel i koden. */
  if (iNativApp && !googleGarIAppen) {
    throw new Error(
      "Den här versionen av appen kan inte logga in med Google. " +
      "Installera den senaste appen, eller logga in med e-post och lösenord så länge."
    );
  }

  if (!googleGarIAppen) {
    // Webben.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return;
  }

  /* Steget skrivs ut i felet. Inloggningen sker på en telefon vi inte
     kan felsöka härifrån, och skillnaden mellan "Supabase svarade
     inte" och "fliken gick inte att öppna" avgör vad som ska lagas. */
  let steg = "hämta adressen från Supabase";
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: APP_ADRESS, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data?.url) throw new Error("inget svar");

    steg = "öppna webbfliken";
    // Svaret tas emot av lyssnaren ovan, som redan står och väntar.
    await Browser.open({ url: data.url });
  } catch (e) {
    throw new Error(`Kunde inte ${steg}: ${e?.message || e}`);
  }
}

/* ---------- BankID ----------
   Kräver en återförsäljare, exempelvis Criipto eller Signicat,
   som exponerar BankID som en vanlig OIDC-leverantör. Den kopplas
   sedan in i Supabase under Authentication -> Providers -> Custom.

   Kostar löpande och fungerar bara i Sverige, så det är ett tillägg
   för svenska användare — inte ett ersättande av e-postinloggningen.

   När du har avtalet på plats blir hela integrationen ungefär detta:

   export async function signInWithBankID() {
     const { error } = await supabase.auth.signInWithOAuth({
       provider: "keycloak",          // eller den provider din leverantör anger
       options: {
         redirectTo: window.location.origin,
         scopes: "openid ssn",
       },
     });
     if (error) throw error;
   }
*/

export async function signOut() {
  await supabase.auth.signOut();
}

/* ---------- Plan och provperiod ----------
   Hämtas alltid från servern. Klienten får aldrig avgöra
   vem som är Pro eller när provperioden började. */
export async function fetchSubscription(userId) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan, trial_start, current_period_end, uppsagd_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/* ---------- Adminroll ----------
   Ligger i en egen tabell (roller), inte i subscriptions — se
   schema.sql. Användaren får bara läsa sin egen rad. */
export async function fetchAdmin(userId) {
  const { data, error } = await supabase
    .from("roller")
    .select("admin")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.admin === true;
}
