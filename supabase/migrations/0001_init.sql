-- Schéma initial complet — L'art de vivre (conciergerie de luxe).
-- Contrairement au projet Harmonie Yacht (base créée à la main, migrations
-- incrémentales seulement), TOUT le schéma est versionné ici : un
-- `supabase db push` sur un projet vierge suffit à recréer la base.

-- ════════════════════════════════════════════════════════════════════
-- 1. Cœur CRM
-- ════════════════════════════════════════════════════════════════════

create type lead_status as enum
  ('new','contacted','qualified','quote_sent','followed_up','booked','lost');

create table public.leads (
  id                        uuid primary key default gen_random_uuid(),
  first_name                text,
  phone                     text unique,          -- E.164 (+33…)
  source_channel            text default 'whatsapp',
  status                    lead_status not null default 'new',
  score                     int check (score between 0 and 10),
  -- Qualification conciergerie
  service_type              text check (service_type in
                              ('yacht','villa','evenement','transport','gastronomie','bien_etre','autre')),
  service_detail            text,                 -- ex. « charter 30 m, Grand Prix de Monaco »
  occasion                  text,
  party_size                int,
  desired_date              date,
  desired_date_end          date,                 -- séjours multi-jours (villas, charters)
  desired_time_slot         text,
  budget_range              text check (budget_range in
                              ('moins_5k','5k_15k','15k_50k','plus_50k','non_communique')),
  location                  text,                 -- ex. « Saint-Tropez », « Courchevel »
  ai_memo                   text,                 -- brief de mission rédigé par l'agent
  needs_human_intervention  boolean not null default false,
  followup_count            int not null default 0,
  last_followup_at          timestamptz,
  last_interaction_at       timestamptz,
  archived                  boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index leads_status_idx  on public.leads (status) where not archived;
create index leads_created_idx on public.leads (created_at);

-- ════════════════════════════════════════════════════════════════════
-- 2. Conversations (formats identiques à Harmonie Yacht → code porté tel quel)
-- ════════════════════════════════════════════════════════════════════

-- Historique agent ↔ client consommé par le cerveau.
-- messages = jsonb [{from: "client"|"ai"|"human", text, at}]
create table public.conversations (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid references public.leads (id) on delete set null,
  channel     text not null default 'whatsapp',
  messages    jsonb not null default '[]',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index conversations_lead_idx on public.conversations (lead_id);

-- État par numéro WhatsApp (pause, rattachement lead, non-lus).
create table public.wa_conversations (
  id               uuid primary key default gen_random_uuid(),
  customer_phone   text not null unique,
  customer_name    text,
  lead_id          uuid references public.leads (id) on delete set null,
  is_paused        boolean not null default false,
  paused_until     timestamptz,
  unread_count     int not null default 0,
  last_message_at  timestamptz,
  created_at       timestamptz not null default now()
);

-- Fil de messages bruts (affiché dans l'inbox du dashboard).
create table public.wa_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.wa_conversations (id) on delete cascade,
  from_me          boolean not null default false,
  is_from_human    boolean not null default false,
  body             text,
  wa_message_id    text,
  created_at       timestamptz not null default now()
);

create index wa_messages_conv_idx on public.wa_messages (conversation_id, created_at);

-- Buffer de debounce : quand un client envoie plusieurs messages rapprochés
-- (« Bonjour » + « Je cherche un yacht »), le service Baileys bufferise et
-- n'appelle le cerveau qu'une fois, avec tous les messages concaténés.
-- La contrainte unique sur wa_message_id déduplique les échos Baileys.
create table public.wa_inbox (
  id            bigserial primary key,
  wa_message_id text not null unique,
  phone         text not null,
  text          text not null,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index wa_inbox_phone_pending_idx
  on public.wa_inbox (phone, received_at)
  where processed_at is null;

create index wa_inbox_received_idx on public.wa_inbox (received_at);

-- Cleanup : on garde 7 jours pour le debug, puis purge.
create or replace function public.wa_inbox_cleanup()
returns void
language sql
as $$
  delete from public.wa_inbox where received_at < now() - interval '7 days';
$$;

-- Session Baileys persistée (survit aux redémarrages Railway).
create table public.wa_auth_state (
  id          text primary key,
  data        jsonb,
  updated_at  timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════
-- 3. Config de l'agent (base de connaissances éditable depuis /reglages)
-- ════════════════════════════════════════════════════════════════════

create table public.agent_config (
  id                     uuid primary key default gen_random_uuid(),
  identity               jsonb not null default '{}',  -- {agent_name, company, base_location, languages}
  services               jsonb not null default '{}',  -- catalogue de prestations
  faq                    jsonb not null default '{}',
  business_hours         jsonb not null default '{}',
  auto_followup_enabled  boolean not null default true,
  max_followups          int not null default 2,
  updated_at             timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════
-- 4. Metering & facturation à l'usage
-- ════════════════════════════════════════════════════════════════════

-- 1 ligne = 1 appel à l'API Anthropic (chaque tour de la boucle d'outils,
-- fidèle à la facturation réelle du fournisseur).
create table public.ai_usage_events (
  id                           bigint generated always as identity primary key,
  occurred_at                  timestamptz not null default now(),
  source                       text not null check (source in ('agent','followup')),
  model                        text not null,
  lead_id                      uuid references public.leads (id) on delete set null,
  customer_phone               text,
  input_tokens                 int not null default 0,
  output_tokens                int not null default 0,
  cache_creation_input_tokens  int not null default 0,
  cache_read_input_tokens     int not null default 0,
  tool_turn                    int,      -- n° du tour dans la boucle d'outils (debug)
  request_id                   text      -- header request-id Anthropic (traçabilité)
);

create index ai_usage_events_occurred_idx on public.ai_usage_events (occurred_at);
create index ai_usage_events_lead_idx     on public.ai_usage_events (lead_id);

-- Pricing versionné (USD / MTok) — jamais de prix en dur dans le code.
-- Un changement de modèle ou de tarif = une nouvelle ligne, l'historique
-- reste valorisé au prix en vigueur au moment de l'appel.
create table public.model_pricing (
  model                     text not null,
  effective_from            date not null default current_date,
  input_usd_per_mtok        numeric(10,4) not null,
  output_usd_per_mtok       numeric(10,4) not null,
  cache_write_usd_per_mtok  numeric(10,4) not null,
  cache_read_usd_per_mtok   numeric(10,4) not null,
  primary key (model, effective_from)
);

-- effective_from dans le passé : tout événement, même antérieur au jour du
-- déploiement, trouve son prix (la jointure de la vue exige effective_from ≤ date d'appel).
insert into public.model_pricing
  (model, effective_from, input_usd_per_mtok, output_usd_per_mtok, cache_write_usd_per_mtok, cache_read_usd_per_mtok)
values
  ('claude-sonnet-4-6', date '2025-01-01', 3.00, 15.00, 3.75, 0.30);

-- Paramètres de facturation (singleton). plan_type/included/overage sont
-- prêts pour une bascule future en forfait + dépassement, sans refonte :
-- seul lib/billing.ts changera.
create table public.billing_settings (
  id                   boolean primary key default true check (id),
  margin_multiplier    numeric(6,2) not null default 3.0,
  usd_eur_rate         numeric(8,4) not null default 0.92,
  plan_type            text not null default 'usage' check (plan_type in ('usage','forfait')),
  included_amount_eur  numeric(10,2),
  overage_multiplier   numeric(6,2),
  updated_at           timestamptz not null default now()
);

insert into public.billing_settings (id) values (true);

-- Agrégat jour × modèle, valorisé au pricing en vigueur à la date de l'appel.
create view public.v_ai_usage_daily as
select date_trunc('day', e.occurred_at)::date       as day,
       e.model,
       count(*)::int                                as calls,
       sum(e.input_tokens)::bigint                  as input_tokens,
       sum(e.output_tokens)::bigint                 as output_tokens,
       sum(e.cache_creation_input_tokens)::bigint   as cache_write_tokens,
       sum(e.cache_read_input_tokens)::bigint       as cache_read_tokens,
       sum( e.input_tokens                * p.input_usd_per_mtok
          + e.output_tokens               * p.output_usd_per_mtok
          + e.cache_creation_input_tokens * p.cache_write_usd_per_mtok
          + e.cache_read_input_tokens     * p.cache_read_usd_per_mtok ) / 1e6
                                                    as cost_usd
from public.ai_usage_events e
-- left join : un modèle sans ligne de pricing reste visible (coût null),
-- il ne disparaît pas silencieusement de la facturation.
left join lateral (
  select * from public.model_pricing p
  where p.model = e.model and p.effective_from <= e.occurred_at::date
  order by p.effective_from desc limit 1
) p on true
group by 1, 2;

-- ════════════════════════════════════════════════════════════════════
-- 5. RLS
-- ════════════════════════════════════════════════════════════════════
-- Mono-tenant : tout utilisateur connecté = l'équipe de la conciergerie.
-- wa_inbox et wa_auth_state restent sans policy (service_role uniquement).

alter table public.leads            enable row level security;
alter table public.conversations    enable row level security;
alter table public.wa_conversations enable row level security;
alter table public.wa_messages      enable row level security;
alter table public.wa_inbox         enable row level security;
alter table public.wa_auth_state    enable row level security;
alter table public.agent_config     enable row level security;
alter table public.ai_usage_events  enable row level security;
alter table public.model_pricing    enable row level security;
alter table public.billing_settings enable row level security;

create policy "authenticated full access" on public.leads
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.conversations
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.wa_conversations
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.wa_messages
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.agent_config
  for all to authenticated using (true) with check (true);
create policy "authenticated read" on public.ai_usage_events
  for select to authenticated using (true);
create policy "authenticated read" on public.model_pricing
  for select to authenticated using (true);
create policy "authenticated full access" on public.billing_settings
  for all to authenticated using (true) with check (true);
