import React, { useState } from "react";
import { sendMagicLink, signInWithGoogle } from "./auth";
import { TESTKONTON } from "./testdata";

export default function Login({ onBack, onTestkonto }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Skriv en giltig e-postadress.");
      return;
    }
    setStatus("sending");
    setError("");
    try {
      await sendMagicLink(email.trim());
      setStatus("sent");
    } catch (e) {
      setError("Kunde inte skicka länken. Försök igen om en stund.");
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
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoComplete="email"
          />
        </label>

        {error && <p className="authError">{error}</p>}

        <button className="add wide" onClick={submit} disabled={status === "sending"}>
          {status === "sending" ? "Skickar…" : "Fortsätt med e-post"}
        </button>

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
          Vi skickar en engångslänk istället för att be dig hitta på ännu ett
          lösenord. Ingen data delas med någon.
        </p>
      </div>
    </div>
  );
}
