import { createClient } from "@supabase/supabase-js";
import { Preferences } from "@capacitor/preferences";

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
const iApp = (() => {
  try { return window.Capacitor?.isNativePlatform?.() === true; }
  catch { return false; }
})();

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
    .select("ordernummer, betald_at, belopp_ore, moms_ore, valuta, interval, status, aterbetalt_ore")
    .eq("user_id", userId)
    .order("betald_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

/* ---------- Google ----------
   Slås på i Supabase under Authentication -> Providers. */
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
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
    .select("plan, trial_start, current_period_end")
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
