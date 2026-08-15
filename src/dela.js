import { supabase } from "./auth";

/* ============================================================
   Delade rapporter

   En token i en offentlig länk, inget konto för mottagaren.
   Precis som en delad Google Docs-länk — token ÄR behörigheten.
   Skyddet ligger i att den är slumpad, går att återkalla, och
   bara visar en skrivskyddad rapport, aldrig något som går att
   ändra.
   ============================================================ */

export async function skapaDelning(userId) {
  const { data, error } = await supabase
    .from("delade_rapporter")
    .insert({ user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listaDelningar(userId) {
  const { data, error } = await supabase
    .from("delade_rapporter")
    .select("*")
    .eq("user_id", userId)
    .eq("aterkallad", false)
    .gt("giltig_till", new Date().toISOString())
    .order("skapad_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function aterkallaDelning(token) {
  const { error } = await supabase
    .from("delade_rapporter")
    .update({ aterkallad: true })
    .eq("token", token);
  if (error) throw error;
}

/* Publik — anropas utan inloggning från mottagarens sida. */
export async function hamtaDeladRapport(token) {
  const { data, error } = await supabase.rpc("hamta_delad_rapport", { t: token });
  if (error) throw error;
  return data;
}

export function delaUrl(token) {
  return `${window.location.origin}/?dela=${token}`;
}
