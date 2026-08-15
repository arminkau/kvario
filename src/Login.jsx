import React, { useState } from "react";
import { sendMagicLink, signInWithGoogle, signInWithPassword, signUpWithPassword } from "./auth";
import { TESTKONTON } from "./testdata";

export default function Login({ onBack, onTestkonto }) {
  const [satt, setSatt] = useState("lank"); // lank | losenord
  const [lage, setLage] = useState("in"); // in | upp — bara i lösenordsläge
  const [email, setEmail] = useState("");
  const [losenord, setLosenord] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [uppSkickad, setUppSkickad] = useState(false);

  const giltigEpost = /^\S+@\S+\.\S+$/.test(email);

  const submitLank = async () => {
    if (!giltigEpost) return setError("Skriv en giltig e-postadress.");
    setStatus("sending");
    setError("");
    try {
      await sendMagicLink(email.trim());
      setStatus("sent");
    } catch {
      setError("Kunde inte skicka länken. Försök igen om en stund.");
      setStatus("idle");
    }
  };

  const submitLosenord = async () => {
    if (!giltigEpost) return setError("Skriv en giltig e-postadress.");
    if (losenord.length < 6) return setError("Lösenordet måste vara minst 6 tecken.");
    setStatus("sending");
    setError("");
    try {
      if (lage === "in") {
        await signInWithPassword(email.trim(), losenord);
      } else {
        const { session } = await signUpWithPassword(email.trim(), losenord);
        // Utan bekräftelsemejl (avstängt i Supabase-inställningarna) blir
        // man inloggad direkt — annars måste länken i mejlet klickas först.
        if (!session) { setUppSkickad(true); setStatus("idle"); return; }
      }
    } catch (e) {
      setError(e.message === "Invalid login credentials"
        ? "Fel e-post eller lösenord."
        : "Något gick fel. Försök igen om en stund.");
      setStatus("idle");
    }
  };

  if (status === "sent") {
    return (
      <div className="onboard">
        <div className="obCard">
          <div className="brand"><h1>Kvario</h1></div>
          <h2 className="obTitle">Kolla din inkorg</h2>
          <p className="obLead">
            Vi skickade en inloggningslänk till <b>{email}</b>. Klicka på den så är
            du inne — inget lösenord att komma ihåg.
          </p>
          <button className="linkbtn" onClick={() => setStatus("idle")}>
            Skickade vi till fel adress?
          </button>
        </div>
      </div>
    );
  }

  if (uppSkickad) {
    return (
      <div className="onboard">
        <div className="obCard">
          <div className="brand"><h1>Kvario</h1></div>
          <h2 className="obTitle">Kolla din inkorg</h2>
          <p className="obLead">
            Vi skickade en bekräftelselänk till <b>{email}</b>. Klicka på den för
            att aktivera kontot, sedan kan du logga in med lösenordet du valde.
          </p>
          <button className="linkbtn" onClick={() => { setUppSkickad(false); setLage("in"); }}>
            Tillbaka till inloggning
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="onboard">
      <div className="obCard">
        <div className="brand"><h1>Kvario</h1></div>
        <h2 className="obTitle">Vad av pengarna är faktiskt dina?</h2>
        <p className="obLead">
          Se direkt hur mycket av det du fakturerar som är moms, skatt och
          egenavgifter — och vad som blir kvar. Fjorton dagar med allt upplåst,
          inget kort.
        </p>

        <label className="authLabel">
          E-post
          <input
            type="email"
            value={email}
            placeholder="du@exempel.se"
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (satt === "lank" ? submitLank() : submitLosenord())}
            autoComplete="email"
          />
        </label>

        {satt === "losenord" && (
          <label className="authLabel">
            Lösenord
            <input
              type="password"
              value={losenord}
              placeholder={lage === "upp" ? "Minst 6 tecken" : "Ditt lösenord"}
              onChange={(e) => setLosenord(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitLosenord()}
              autoComplete={lage === "upp" ? "new-password" : "current-password"}
            />
          </label>
        )}

        {error && <p className="authError">{error}</p>}

        {satt === "lank" ? (
          <button className="add wide" onClick={submitLank} disabled={status === "sending"}>
            {status === "sending" ? "Skickar…" : "Fortsätt med e-post"}
          </button>
        ) : (
          <button className="add wide" onClick={submitLosenord} disabled={status === "sending"}>
            {status === "sending" ? "Skickar…" : lage === "in" ? "Logga in" : "Skapa konto"}
          </button>
        )}

        <button className="linkbtn center" onClick={() => {
          setError("");
          if (satt === "lank") { setSatt("losenord"); setLage("in"); }
          else { setSatt("lank"); }
        }}>
          {satt === "lank" ? "Använd lösenord istället" : "Använd engångslänk istället"}
        </button>

        {satt === "losenord" && (
          <button className="linkbtn center" onClick={() => { setError(""); setLage(lage === "in" ? "upp" : "in"); }}>
            {lage === "in" ? "Ny här? Skapa konto" : "Har redan ett konto? Logga in"}
          </button>
        )}

        <div className="authOr"><span>eller</span></div>

        <button className="authAlt" onClick={signInWithGoogle}>
          Fortsätt med Google
        </button>

        {onBack && <button className="linkbtn center" onClick={onBack}>Tillbaka</button>}

        {onTestkonto && (
          <div className="testkonton">
            <div className="eyebrow" style={{ marginBottom: 9 }}>Testkonton</div>
            <p className="tkHjalp">
              Klicka på ett konto för att logga in direkt. Skriver du adressen i fältet ovan
              fungerar det också — rollen avgörs av adressen.
            </p>
            {TESTKONTON.map((k) => (
              <button key={k.epost} className="testkonto" onClick={() => onTestkonto(k)}>
                <span className="tkNamn">{k.namn}{k.admin && <span className="regelTag">Admin</span>}</span>
                <span className="tkBesk">{k.beskrivning}</span>
              </button>
            ))}
          </div>
        )}

        <p className="authNote">
          {satt === "lank"
            ? "Vi skickar en engångslänk istället för att be dig hitta på ännu ett lösenord. Ingen data delas med någon."
            : "Ingen data delas med någon."}
        </p>
      </div>
    </div>
  );
}
