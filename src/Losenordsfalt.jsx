import React, { useState } from "react";

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
}) {
  const [syns, setSyns] = useState(false);

  const falt = (
    <span className={`losenordRad${naken ? " grow" : ""}`}>
      <input
        id={id}
        type={syns ? "text" : "password"}
        value={varde}
        placeholder={placeholder}
        onChange={(e) => satt(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        autoComplete={autoComplete}
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

  if (naken) return falt;

  return (
    <label className="authLabel" htmlFor={id}>
      {etikett}
      {falt}
    </label>
  );
}
