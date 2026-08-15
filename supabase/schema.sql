-- ============================================================
-- Kvario — databasschema
-- Klistra in i Supabase: SQL Editor -> New query -> Run
-- ============================================================

-- ---------- 1. Användarens data ----------
-- Allt appen sparar. Användaren äger sin egen rad, inget annat.

create table if not exists public.user_state (
  user_id    uuid primary key references auth.users on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

-- Row Level Security: databasen släpper bara igenom din egen rad.
-- Även om någon får tag i din publika API-nyckel kommer de inte
-- åt någon annans data. Detta är varför nyckeln får ligga i webbläsaren.
create policy "läs egen data" on public.user_state
  for select using (auth.uid() = user_id);
create policy "skriv egen data" on public.user_state
  for insert with check (auth.uid() = user_id);
create policy "uppdatera egen data" on public.user_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ---------- 2. Prenumeration och provperiod ----------
-- Separat tabell av ett enda skäl: användaren får LÄSA men aldrig SKRIVA.
-- Låg man planen i user_state kunde vem som helst sätta sig själv till Pro
-- med två rader i webbläsarkonsolen. Här kan bara servern ändra.

create table if not exists public.subscriptions (
  user_id            uuid primary key references auth.users on delete cascade,
  plan               text        not null default 'free',
  trial_start        timestamptz not null default now(),
  current_period_end timestamptz,
  stripe_customer_id text,
  updated_at         timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Bara läsning. Inga insert- eller update-policyer för användaren.
-- Servern använder service_role-nyckeln som går förbi RLS.
create policy "läs egen prenumeration" on public.subscriptions
  for select using (auth.uid() = user_id);


-- ---------- 3. Starta provperioden automatiskt ----------
-- Provperioden får aldrig sättas av klienten. Startas den i webbläsaren
-- kan vem som helst nollställa den och få 14 nya dagar för alltid.

create or replace function public.start_trial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (user_id, plan, trial_start)
  values (new.id, 'free', now())
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.start_trial();


-- ---------- 4. Godkända villkor ----------
-- Sparas separat från användarens data så att den inte kan ändras
-- av misstag. Vid tvist är det här beviset på vad som accepterats,
-- när, och vilken version av texten det gällde.

create table if not exists public.terms_acceptance (
  id         bigserial primary key,
  user_id    uuid not null references auth.users on delete cascade,
  version    text not null,
  accepted_at timestamptz not null default now(),
  user_agent text
);

alter table public.terms_acceptance enable row level security;

create policy "läs egna godkännanden" on public.terms_acceptance
  for select using (auth.uid() = user_id);
create policy "spara eget godkännande" on public.terms_acceptance
  for insert with check (auth.uid() = user_id);

create index if not exists terms_acceptance_user_idx
  on public.terms_acceptance (user_id, accepted_at desc);


-- ============================================================
-- 5. Ordrar och löpnummer
-- ============================================================

-- Löpnumret måste vara atomiskt. Två samtidiga köp får aldrig
-- samma nummer. En UPDATE ... RETURNING i Postgres är atomisk
-- i sig — raden låses under uppdateringen — så vi behöver inga
-- explicita lås.

create table if not exists public.order_serie (
  ar int primary key,
  n  int not null default 0
);

alter table public.order_serie enable row level security;
-- Inga policyer: bara servern med service_role-nyckeln når tabellen.

create or replace function public.nasta_ordernummer()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  y int := extract(year from now())::int;
  v int;
begin
  insert into public.order_serie (ar, n) values (y, 0)
    on conflict (ar) do nothing;
  update public.order_serie set n = n + 1 where ar = y returning n into v;
  return 'K-' || y || '-' || lpad(v::text, 4, '0');
end;
$$;


create table if not exists public.orders (
  id                 bigserial primary key,
  ordernummer        text unique not null,
  user_id            uuid references auth.users on delete set null,
  epost              text,

  -- Unik nyckel mot Stripe. Detta är idempotensen: Stripe skickar om
  -- webhooks vid timeout eller fel, och utan denna spärr skulle samma
  -- betalning kunna ge två ordernummer och två bekräftelsemejl.
  stripe_invoice_id  text unique,
  stripe_customer_id text,

  belopp_ore         int not null,
  moms_ore           int not null default 0,
  valuta             text not null default 'SEK',
  interval           text,

  betald_at          timestamptz,
  period_slut        timestamptz,
  angerratt_samtycke boolean not null default false,

  status             text not null default 'betald',   -- betald, aterbetald, delvis_aterbetald
  aterbetalt_ore     int not null default 0,
  aterbetald_at      timestamptz,
  aterbetalning_orsak text,

  created_at         timestamptz not null default now()
);

alter table public.orders enable row level security;

-- Användaren får läsa sina egna ordrar. Ingen får skriva från klienten.
create policy "läs egna ordrar" on public.orders
  for select using (auth.uid() = user_id);

create index if not exists orders_user_idx on public.orders (user_id, betald_at desc);
create index if not exists orders_customer_idx on public.orders (stripe_customer_id);


-- Bokföringslagen kräver sju års arkivering. Radering av ett konto
-- ska därför inte ta bort ordern — user_id sätts till null i stället,
-- vilket sker automatiskt via "on delete set null" ovan.


-- ============================================================
-- 6. Adminroll
-- ============================================================

-- Rollen ligger i en egen tabell som användaren bara får läsa.
-- Låg den i user_state kunde vem som helst göra sig till admin
-- med två rader i webbläsarkonsolen.

create table if not exists public.roller (
  user_id  uuid primary key references auth.users on delete cascade,
  admin    boolean not null default false,
  skapad   timestamptz not null default now()
);

alter table public.roller enable row level security;

create policy "läs egen roll" on public.roller
  for select using (auth.uid() = user_id);

-- Hjälpfunktion så att andra policyer kan fråga om admin.
create or replace function public.ar_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select admin from public.roller where user_id = auth.uid()), false);
$$;

-- Admin får läsa allt. Vanliga användare bara sitt eget.
create policy "admin läser alla ordrar" on public.orders
  for select using (public.ar_admin());
create policy "admin läser alla prenumerationer" on public.subscriptions
  for select using (public.ar_admin());
create policy "admin läser alla roller" on public.roller
  for select using (public.ar_admin());

-- Gör dig själv till admin efter att du registrerat dig:
--   insert into public.roller (user_id, admin)
--   select id, true from auth.users where email = 'din@epost.se'
--   on conflict (user_id) do update set admin = true;


-- ============================================================
-- 7. Återbetalningsförfrågningar
-- ============================================================

create table if not exists public.aterbetalningar (
  id          bigserial primary key,
  order_id    bigint references public.orders on delete cascade,
  user_id     uuid references auth.users on delete set null,
  belopp_ore  int not null,
  orsak       text,
  status      text not null default 'begard',  -- begard, godkand, nekad, genomford
  automatisk  boolean not null default false,
  begard_at   timestamptz not null default now(),
  hanterad_at timestamptz,
  kommentar   text
);

alter table public.aterbetalningar enable row level security;

create policy "läs egna återbetalningar" on public.aterbetalningar
  for select using (auth.uid() = user_id or public.ar_admin());
create policy "begär egen återbetalning" on public.aterbetalningar
  for insert with check (auth.uid() = user_id);

create index if not exists aterbet_status_idx on public.aterbetalningar (status, begard_at desc);


-- ============================================================
-- 8. Kundlista för adminpanelen
-- ============================================================

-- subscriptions har inget e-postfält — det ligger bara i auth.users,
-- som klienten aldrig får läsa direkt. Den här funktionen gör det
-- enda undantaget: en admin får se e-post ihopkopplat med plan och
-- provperiod, aldrig lösenord eller annat från auth.users.
create or replace function public.admin_kunder()
returns table (
  user_id uuid,
  epost text,
  plan text,
  trial_start timestamptz,
  current_period_end timestamptz,
  stripe_customer_id text
)
language sql stable security definer set search_path = public as $$
  select s.user_id, u.email, s.plan, s.trial_start, s.current_period_end, s.stripe_customer_id
  from public.subscriptions s
  join auth.users u on u.id = s.user_id
  where public.ar_admin();
$$;
