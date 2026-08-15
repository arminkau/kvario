import React, { useState } from "react";
import { signInWithGoogle, signInWithPassword, signUpWithPassword, skickaLosenordsAterstallning } from "./auth";
import { TESTKONTON } from "./testdata";

export default function Login({ onBack, onTestkonto }) {
  const [lage, setLage] = useState("in"); // in | upp
  const [email, setEmail] = useState("");
  const [losenord, setLosenord] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [uppSkickad, setUppSkickad] = useState(false);
  const [aterstallningSkickad, setAterstallningSkickad] = useState(false);

  const giltigEpost = /^\S+@\S+\.\S+$/.test(email);

  const submit = async () => {
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

  const glomtLosenord = async () => {
    if (!giltigEpost) return setError("Skriv din e-postadress ovan först.");
    setStatus("sending");
    setError("");
    try {
      await skickaLosenordsAterstallning(email.trim());
      setAterstallningSkickad(true);
    } catch {
      setError("Kunde inte skicka länken. Försök igen om en stund.");
    }
    setStatus("idle");
  };

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

  if (aterstallningSkickad) {
    return (
      <div className="onboard">
        <div className="obCard">
          <div className="brand"><h1>Kvario</h1></div>
          <h2 className="obTitle">Kolla din inkorg</h2>
          <p className="obLead">
            Vi skickade en länk till <b>{email}</b> för att sätta ett nytt lösenord.
          </p>
          <button className="linkbtn" onClick={() => setAterstallningSkickad(false)}>
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
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoComplete="email"
          />
        </label>

        <label className="authLabel">
          Lösenord
          <input
            type="password"
            value={losenord}
            placeholder={lage === "upp" ? "Minst 6 tecken" : "Ditt lösenord"}
            onChange={(e) => setLosenord(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoComplete={lage === "upp" ? "new-password" : "current-password"}
          />
        </label>

        {error && <p className="authError">{error}</p>}

        <button className="add wide" onClick={submit} disabled={status === "sending"}>
          {status === "sending" ? "Skickar…" : lage === "in" ? "Logga in" : "Skapa konto"}
        </button>

        {lage === "in" && (
          <button className="linkbtn center" onClick={glomtLosenord} disabled={status === "sending"}>
            Glömt lösenordet?
          </button>
        )}

        <button className="linkbtn center" onClick={() => { setError(""); setLage(lage === "in" ? "upp" : "in"); }}>
          {lage === "in" ? "Ny här? Skapa konto" : "Har redan ett konto? Logga in"}
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

        <p className="authNote">Ingen data delas med någon.</p>
      </div>
    </div>
  );
}
