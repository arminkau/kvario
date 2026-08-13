/* ============================================================
   Testanvändare

   Två konton för att kunna klicka igenom båda vyerna utan att
   sätta upp Supabase. I skarp drift kommer motsvarande data
   från databasen, och adminrollen läses ur tabellen roller.
   ============================================================ */

export const TESTKONTON = [
  {
    epost: "test@kvario.se",
    namn: "Vanlig användare",
    beskrivning: "Enskild firma med ett halvår inlagt. Provperioden har nio dagar kvar.",
    admin: false,
  },
  {
    epost: "admin@kvario.se",
    namn: "Administratör",
    beskrivning: "Samma app, plus adminpanelen med kunder, ordrar, återbetalningar och utskick.",
    admin: true,
  },
];

const dag = 86400000;
const iso = (d) => new Date(Date.now() - d * dag).toISOString();

export const ADMIN_TESTDATA = {
  kunder: [
    { user_id: "u1", epost: "anna.lindqvist@exempel.se", plan: "pro", trial_start: iso(212), current_period_end: iso(-153) },
    { user_id: "u2", epost: "johan.berg@exempel.se", plan: "pro", trial_start: iso(178), current_period_end: iso(-187) },
    { user_id: "u3", epost: "sara.nystrom@exempel.se", plan: "free", trial_start: iso(6), current_period_end: null },
    { user_id: "u4", epost: "mikael.ohlsson@exempel.se", plan: "pro", trial_start: iso(96), current_period_end: iso(-269) },
    { user_id: "u5", epost: "elin.dahl@exempel.se", plan: "free", trial_start: iso(41), current_period_end: null },
    { user_id: "u6", epost: "petter.wall@exempel.se", plan: "free", trial_start: iso(2), current_period_end: null },
    { user_id: "u7", epost: "linnea.forsberg@exempel.se", plan: "pro", trial_start: iso(64), current_period_end: iso(-301) },
    { user_id: "u8", epost: "oskar.hedlund@exempel.se", plan: "free", trial_start: iso(88), current_period_end: null },
  ],
  ordrar: [
    { id: 1, ordernummer: "K-2026-0001", epost: "anna.lindqvist@exempel.se", belopp_ore: 99000, moms_ore: 19800, betald_at: iso(198), status: "betald", aterbetalt_ore: 0 },
    { id: 2, ordernummer: "K-2026-0002", epost: "johan.berg@exempel.se", belopp_ore: 99000, moms_ore: 19800, betald_at: iso(164), status: "betald", aterbetalt_ore: 0 },
    { id: 3, ordernummer: "K-2026-0003", epost: "mikael.ohlsson@exempel.se", belopp_ore: 9900, moms_ore: 1980, betald_at: iso(82), status: "betald", aterbetalt_ore: 0 },
    { id: 4, ordernummer: "K-2026-0004", epost: "linnea.forsberg@exempel.se", belopp_ore: 99000, moms_ore: 19800, betald_at: iso(50), status: "betald", aterbetalt_ore: 0 },
    { id: 5, ordernummer: "K-2026-0005", epost: "mikael.ohlsson@exempel.se", belopp_ore: 9900, moms_ore: 1980, betald_at: iso(52), status: "betald", aterbetalt_ore: 0 },
    { id: 6, ordernummer: "K-2026-0006", epost: "tidigare.kund@exempel.se", belopp_ore: 99000, moms_ore: 19800, betald_at: iso(31), status: "aterbetald", aterbetalt_ore: 99000 },
    { id: 7, ordernummer: "K-2026-0007", epost: "mikael.ohlsson@exempel.se", belopp_ore: 9900, moms_ore: 1980, betald_at: iso(22), status: "betald", aterbetalt_ore: 0 },
  ],
  aterbetalningar: [
    { id: 1, epost: "tidigare.kund@exempel.se", belopp_ore: 99000, orsak: "Ångerrätt inom 14 dagar", status: "genomford", automatisk: true, begard_at: iso(31) },
    { id: 2, epost: "sara.nystrom@exempel.se", belopp_ore: 9900, orsak: "Köpte fel plan av misstag", status: "begard", automatisk: false, begard_at: iso(3) },
  ],
};
