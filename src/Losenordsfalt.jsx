import React, { useState } from "react";
import { granskaLosenord, styrka, MINSTA_LANGD } from "./losenordskrav";

/* ============================================================
   Lösenordsfält med möjlighet att se det man skriver

   Ett dolt fält är rimligt när någon tittar över axeln. Vid
   registrering är det tvärtom: man hittar på ett nytt lösenord,
   skriver fel, och får veta det först vid inloggningen — utan att
   veta vad man faktiskt skrev.

   Delat mellan registrering, återställning och lösenordsbyte. Ett
   fält som visar lösenordet på ett ställe men inte på ett annat
   känns trasigt, och det är samma sorts fält överallt.

   Knappen har type="button" med flit. Utan det räknas den som
   submit inuti ett formulär, och att titta på lösenordet hade
   skickat iväg det.
   ============================================================ */
export default function Losenordsfalt({
  varde, satt, placeholder, autoComplete = "current-password",
  onEnter, etikett = "Lösenord", id,
  /* naken utelämnar etiketten, för fält som redan sitter i en rad
     med egen rubrik ovanför — som lösenordsbytet under Konto. */
  naken = false,
  /* Sätts när ett nytt lösenord ska väljas. Då visas kraven medan
     man skriver; vid inloggning vore det bara i vägen — där ska
     man skriva ett lösenord man redan har. */
  nytt = false,
  epost = "",
}) {
  const [syns, setSyns] = useState(false);
  const [rort, setRort] = useState(false);

  const invand = nytt && rort && varde.length > 0;
  const anmarkning = invand ? granskaLosenord(varde, epost) : null;
  const styrkan = invand && !anmarkning ? styrka(varde) : null;

  const falt = (
    <span className={`losenordRad${naken ? " grow" : ""}`}>
      <input
        id={id}
        type={syns ? "text" : "password"}
        value={varde}
        placeholder={placeholder}
        onChange={(e) => { satt(e.target.value); setRort(true); }}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        autoComplete={autoComplete}
        aria-describedby={nytt ? `${id}-krav` : undefined}
      />
      <button
        type="button"
        className="losenordOga"
        onClick={() => setSyns((s) => !s)}
        aria-label={syns ? "Dölj lösenordet" : "Visa lösenordet"}
        aria-pressed={syns}
        /* Utan detta flyttas fokus från fältet vid klick, och den
           som skriver vidare med tangentbordet tappar bort sig. */
        onMouseDown={(e) => e.preventDefault()}
      >
        {syns ? "Dölj" : "Visa"}
      </button>
    </span>
  );

  /* Beskedet under fältet. Innan man börjat skriva står bara kravet,
     så att det inte kommer som en överraskning efteråt. */
  const besked = nytt && (
    <p className="losenordKrav" id={`${id}-krav`} aria-live="polite">
      {anmarkning ? (
        <span className="losenordFel">{anmarkning}</span>
      ) : styrkan ? (
        <>
          <span className={`losenordStapel niva${styrkan.niva}`} aria-hidden="true">
            <i /><i /><i /><i />
          </span>
          {styrkan.ord}
        </>
      ) : (
        `Minst ${MINSTA_LANGD} tecken. En mening du minns är både starkare och lättare än ett kort krångligt ord.`
      )}
    </p>
  );

  if (naken) return <>{falt}{besked}</>;

  return (
    <label className="authLabel" htmlFor={id}>
      {etikett}
      {falt}
      {besked}
    </label>
  );
}
