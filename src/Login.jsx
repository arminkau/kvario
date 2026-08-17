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

  /* Supabase svarar på engelska. Ett obegripligt "Något gick fel"
     lämnade användaren utan att veta om adressen var upptagen, om
     lösenordet var fel eller om det bara var trögt just då — och
     alla tre kräver olika saker av en.

     Att kontot redan finns berättas med flit. Supabase har redan
     avslöjat det i sitt eget svar, så tystnaden här skyddar
     ingenting men lämnar kvar en person som inte kommer vidare. */
  const tolkaFel = (e, vilketLage) => {
    const m = String(e?.message || "");
    if (/already registered|already been registered|User already/i.test(m))
      return "Det finns redan ett konto med den adressen. Logga in i stället, eller välj Glömt lösenordet.";
    if (/Invalid login credentials/i.test(m))
      return vilketLage === "in"
        ? "Fel e-post eller lösenord."
        : "Uppgifterna godtogs inte. Kontrollera adressen.";
    if (/Email not confirmed|not confirmed/i.test(m))
      return "Kontot är inte bekräftat än. Klicka på länken i mejlet vi skickade, eller välj Glömt lösenordet.";
    if (/rate limit|too many|For security purposes/i.test(m))
      return "För många försök på kort tid. Vänta någon minut och prova igen.";
    if (/Password should be|password.*6/i.test(m))
      return "Lösenordet måste vara minst 6 tecken.";
    if (/invalid format|Unable to validate email/i.test(m))
      return "E-postadressen ser inte giltig ut. Kontrollera stavningen.";
    if (/fetch|network|Failed to fetch/i.test(m))
      return "Ingen kontakt med servern. Kontrollera din uppkoppling.";
    return "Något gick fel. Försök igen om en stund.";
  };

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
      setError(tolkaFel(e, lage));
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
