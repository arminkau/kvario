import React, { useState, useEffect } from "react";
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

  /* Knappen hade tidigare signInWithGoogle direkt som onClick. Den är
     asynkron, så varje fel blev en oupptäckt promise-rejektion — och
     användaren såg ingenting alls hända. Nu syns felet.

     Egen status, inte samma som formuläret ovan. I appen öppnas Google
     i en flik ovanpå, och den här vyn ligger kvar under tiden. */
  const [googlePagar, setGooglePagar] = useState(false);

  const googleLogin = async () => {
    setGooglePagar(true);
    setError("");
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e?.message || "Kunde inte öppna Google. Försök igen om en stund.");
      setGooglePagar(false);
    }
  };

  /* Backar man ur Google-fliken utan att logga in är man tillbaka här
     med en knapp som annars hade legat låst för gott. Lyckades det är
     den här vyn redan utbytt, så det finns inget att återställa. */
  useEffect(() => {
    if (!googlePagar) return;
    const vakna = () => { if (document.visibilityState === "visible") setGooglePagar(false); };
    document.addEventListener("visibilitychange", vakna);
    return () => document.removeEventListener("visibilitychange", vakna);
  }, [googlePagar]);

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
          {/* Registrerar man en adress som redan har ett konto skickas
              inget nytt mejl — och vi får aldrig veta om det, eftersom
              Supabase med flit svarar likadant oavsett. Skulle den
              säga ifrån kunde vem som helst kartlägga vilka adresser
              som är kunder.

              Utan den här raden slutar det i en återvändsgränd: man
              väntar på ett brev som aldrig kommer. */}
          <p className="obLead" style={{ marginTop: -6 }}>
            Kommer inget brev inom några minuter kan adressen redan ha ett konto.
            Gå tillbaka och välj <b>Glömt lösenordet</b> i stället — det fungerar
            även för konton som aldrig hunnit bekräftas.
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

        <button className="authAlt" onClick={googleLogin} disabled={googlePagar}>
          {googlePagar ? "Öppnar Google…" : "Fortsätt med Google"}
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
