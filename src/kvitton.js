import { supabase } from "./auth";

/* ============================================================
   Kvitton och underlag

   Bokföringslagen kräver att underlaget sparas i sju år. Siffran i
   appen är inte underlaget — kvittot är det.

   Filerna ligger i en PRIVAT Storage-bucket, en mapp per användare.
   Mappnamnet är användarens id, och policyerna i schema.sql låter
   bara ägaren röra sin egen mapp. Länkar som visas i appen är
   signerade och kortlivade; en publik bucket vore fel eftersom
   kvitton ofta innehåller adresser och kontouppgifter.
   ============================================================ */

const BUCKET = "kvitton";
const MAX_BYTES = 10 * 1024 * 1024;
const TILLATNA = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

export async function laddaUppKvitto({ userId, kostnadId, fil }) {
  if (!TILLATNA.includes(fil.type)) {
    throw new Error("Filen måste vara en bild eller PDF.");
  }
  if (fil.size > MAX_BYTES) {
    throw new Error("Filen är större än 10 MB.");
  }

  // Slumpad del i namnet så att två kvitton med samma filnamn inte
  // skriver över varandra.
  const ren = fil.name.replace(/[^\w.\-]/g, "_").slice(-60);
  const sokvag = `${userId}/${kostnadId}/${Date.now()}-${ren}`;

  const { error: uppFel } = await supabase.storage
    .from(BUCKET)
    .upload(sokvag, fil, { cacheControl: "3600", upsert: false });
  if (uppFel) throw uppFel;

  const { data, error } = await supabase
    .from("kvitton")
    .insert({
      user_id: userId,
      kostnad_id: String(kostnadId),
      sokvag,
      filnamn: fil.name,
      storlek: fil.size,
      mimetyp: fil.type,
    })
    .select()
    .single();

  if (error) {
    // Raden kunde inte skapas — låt inte filen bli kvar utan spår.
    await supabase.storage.from(BUCKET).remove([sokvag]);
    throw error;
  }
  return data;
}

export async function hamtaKvitton(userId) {
  const { data, error } = await supabase
    .from("kvitton")
    .select("*")
    .eq("user_id", userId)
    .order("uppladdad_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

/* Signerad länk som gäller en timme. Bucketen är privat, så det här
   är enda sättet att visa filen i webbläsaren. */
export async function kvittoLank(sokvag) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(sokvag, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function raderaKvitto(kvitto) {
  const { error: filFel } = await supabase.storage.from(BUCKET).remove([kvitto.sokvag]);
  if (filFel) throw filFel;
  const { error } = await supabase.from("kvitton").delete().eq("id", kvitto.id);
  if (error) throw error;
}
