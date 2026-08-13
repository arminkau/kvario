/* ============================================================
   Lagring

   Ett enda ställe som bestämmer var datan hamnar.
   Är Supabase konfigurerat följer datan användaren mellan
   telefon och dator. Annars sparas den i webbläsaren.
   ============================================================ */

import { supabase, hasAuth } from "./auth";

const local = {
  async get(key) {
    const value = localStorage.getItem(key);
    return value === null ? null : { key, value };
  },
  async set(key, value) {
    localStorage.setItem(key, value);
    return { key, value };
  },
};

/* Databasen tar emot ett enda jsonb-fält per användare.
   Det är avsiktligt enkelt: appen kan ändra form utan migreringar,
   och en frilansares hela år får plats i några kilobyte. */
const cloud = (userId) => ({
  async get() {
    const { data, error } = await supabase
      .from("user_state")
      .select("data")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data?.data ? { key: "state", value: JSON.stringify(data.data) } : null;
  },
  async set(key, value) {
    const { error } = await supabase
      .from("user_state")
      .upsert(
        { user_id: userId, data: JSON.parse(value), updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    if (error) throw error;
    return { key, value };
  },
});

export function makeStorage(userId) {
  return hasAuth && userId ? cloud(userId) : local;
}

export const storage = local;
