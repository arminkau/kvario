import { supabase } from "./auth";

/* ============================================================
   Godkända villkor

   Skälet att det här ligger i en egen tabell står i schemat: vid en
   tvist är raden beviset på vad som godkändes, när, och vilken
   version av texten det gällde.

   Det räcker inte att spara det i user_state. Den datan äger
   användaren själv och skriver över när som helst — och "Radera all
   data" nollställer den till DEFAULT_STATE, där villkor är null. Då
   försvinner beviset samtidigt som kunden raderar sina fakturor.
   Tabellen här rörs inte av någondera.

   Skrivningen får aldrig blockera onboardingen. Går den inte igenom
   är det bättre att släppa in användaren och sakna en rad, än att
   låsa ute någon för att nätet hackade till i fel sekund.
   ============================================================ */
export async function sparaGodkannande(userId, version) {
  /* Utan konto finns ingen rad att knyta godkännandet till — appen
     går att använda utan inloggning, och då ligger det bara kvar i
     den lokala datan tills ett konto skapas. */
  if (!userId) return false;

  try {
    const { error } = await supabase.from("terms_acceptance").insert({
      user_id: userId,
      version,
      /* Klipps för att en märklig eller påhittad user agent inte ska
         kunna göra raden godtyckligt stor. */
      user_agent: navigator.userAgent?.slice(0, 400) || null,
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn("Kunde inte spara godkännandet av villkoren:", e?.message || e);
    return false;
  }
}
