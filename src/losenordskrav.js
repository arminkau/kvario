/* ============================================================
   Krav på lösenord

   Sex tecken var för lite. Men vägen framåt är inte fler regler om
   stora bokstäver och specialtecken — de kraven ger i praktiken
   Sommar1! och Kvario2026!, som är lätta att gissa och svåra att
   minnas. NIST tog bort dem ur sina rekommendationer 2017 av just
   det skälet.

   Längd väger tyngre. Tolv tecken utan regler slår åtta med, både
   i motståndskraft och i hur troligt det är att någon minns det.

   Det vi stoppar är i stället det som faktiskt går att gissa:
   för kort, bara siffror, samma tecken om och om igen, ord ur den
   egna adressen, och de vanligaste lösenorden.

   OBS: det här är hjälp till användaren, inte säkerhet. Kontrollen
   sker i webbläsaren och går att kringgå. Sätt samma minsta längd i
   Supabase under Authentication -> Providers -> Email, det är den
   som gäller på riktigt.
   ============================================================ */

export const MINSTA_LANGD = 12;

/* De vanligaste, plus svenska varianter som listorna sällan har.
   Jämförelsen görs på gemener och utan siffror på slutet, så att
   lösenord123 fastnar på samma rad som lösenord. */
const VANLIGA = [
  "password", "passord", "losenord", "lösenord", "hemligt", "hemlighet",
  "qwerty", "qwertyui", "asdfghjk", "abcdefgh",
  "welcome", "valkommen", "välkommen", "sommar", "vinter", "sverige",
  "kvario", "iloveyou", "princess", "dragon", "monkey", "letmein",
  "football", "fotboll", "hockey", "master", "solskenet",
];

/* Sekvenser som 123456 och abcdef. Kollas åt båda hållen. */
function arSekvens(text) {
  if (text.length < 4) return false;
  const kod = [...text].map((c) => c.charCodeAt(0));
  const stigande = kod.every((k, i) => i === 0 || k === kod[i - 1] + 1);
  const fallande = kod.every((k, i) => i === 0 || k === kod[i - 1] - 1);
  return stigande || fallande;
}

/* Returnerar null när lösenordet duger, annars en mening som säger
   vad som behöver ändras. Ett fel i taget — en lista med fem krav
   får folk att ge upp. */
export function granskaLosenord(losenord, epost = "") {
  const l = String(losenord || "");

  if (l.length < MINSTA_LANGD) {
    const kvar = MINSTA_LANGD - l.length;
    return `Lösenordet måste vara minst ${MINSTA_LANGD} tecken. ${kvar} kvar.`;
  }

  if (/^\d+$/.test(l)) {
    return "Bara siffror är lätt att gissa. Blanda in bokstäver eller ord.";
  }

  // Samma tecken om och om igen, aaaaaaaaaaaa
  if (new Set(l.toLowerCase()).size <= 3) {
    return "För få olika tecken. Använd fler.";
  }

  if (arSekvens(l)) {
    return "Tecken i följd är lätta att gissa. Blanda om.";
  }

  const jamfor = l.toLowerCase().replace(/\d+$/, "");
  if (VANLIGA.some((v) => jamfor === v || (v.length >= 6 && jamfor.includes(v)))) {
    return "Det där lösenordet finns i listor som används för att gissa. Välj något annat.";
  }

  /* Adressen är det första någon provar. Delen före snabel-a räcker
     att stoppa; hela adressen fastnar ändå på samma regel. */
  const namn = String(epost).split("@")[0].toLowerCase();
  if (namn.length >= 4 && l.toLowerCase().includes(namn)) {
    return "Lösenordet innehåller din e-postadress. Välj något som inte går att lista ut.";
  }

  return null;
}

/* Fyra steg, till stapeln under fältet. Bygger på längd och
   variation — inte på om det råkar finnas ett utropstecken. */
export function styrka(losenord) {
  const l = String(losenord || "");
  if (!l) return { niva: 0, ord: "" };

  const sorter = [/[a-zåäö]/, /[A-ZÅÄÖ]/, /\d/, /[^a-zA-ZåäöÅÄÖ0-9]/]
    .filter((r) => r.test(l)).length;

  let poang = 0;
  if (l.length >= MINSTA_LANGD) poang++;
  if (l.length >= 16) poang++;
  if (sorter >= 2) poang++;
  if (sorter >= 3) poang++;

  const niva = Math.min(4, Math.max(1, poang));
  return { niva, ord: ["", "Svagt", "Godkänt", "Bra", "Starkt"][niva] };
}
