import { createClient } from "@supabase/supabase-js";

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
export const supabase = hasAuth ? createClient(url, key) : null;

/* ---------- Lösenord ----------
   Alternativ till den magiska länken, för den som hellre vill
   logga in direkt utan att lämna appen och kolla mejlen. */
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
