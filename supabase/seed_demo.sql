-- Données de démonstration — permet de montrer le dashboard rempli avant la
-- mise en production (et de recetter les pages localement).
-- Idempotent : purge les données applicatives puis réinsère.
-- ⚠️ NE PAS exécuter sur la base de production une fois le client actif.

delete from public.ai_usage_events;
delete from public.wa_messages;
delete from public.wa_inbox;
delete from public.conversations;
delete from public.wa_conversations;
delete from public.leads;

-- ── Leads ────────────────────────────────────────────────────────────
insert into public.leads
  (id, first_name, phone, status, score, service_type, service_detail, occasion,
   party_size, desired_date, desired_date_end, budget_range, location, ai_memo,
   needs_human_intervention, last_interaction_at, created_at)
values
  ('11111111-0000-0000-0000-000000000001', 'Sophie',   '+33612000001', 'qualified',  9, 'yacht',      'Charter 30 m avec équipage, journée', 'Anniversaire de mariage', 10, current_date + 18, null, '15k_50k', 'Monaco',
   E'Demande : charter yacht ~30 m, journée complète au départ de Monaco.\nDates : dans ~3 semaines, flexible ±2 jours.\nInvités : 10 adultes.\nBudget : 15-50 k€.\nExigences : chef à bord, décoration anniversaire.\nProchaine étape : proposer 2-3 yachts avec devis.',
   false, now() - interval '2 hours',  now() - interval '3 days'),
  ('11111111-0000-0000-0000-000000000002', 'James',    '+44770000002', 'quote_sent', 8, 'villa',      'Villa 6 chambres, vue mer, staff complet', 'Vacances en famille', 12, current_date + 40, current_date + 54, 'plus_50k', 'Saint-Tropez',
   E'Demande : villa 6+ chambres à Saint-Tropez, 2 semaines en haute saison.\nStaff : chef + ménage quotidien.\nBudget : > 50 k€.\nProchaine étape : devis envoyé, relancer sous 72 h.',
   false, now() - interval '1 day',    now() - interval '8 days'),
  ('11111111-0000-0000-0000-000000000003', 'Isabelle', '+33612000003', 'booked',     9, 'evenement',  'Soirée 50 ans, 80 invités', '50e anniversaire', 80, current_date + 25, null, '15k_50k', 'Cannes',
   'Confirmé : lieu privatisé à Cannes, traiteur étoilé, DJ. Acompte reçu.',
   false, now() - interval '3 days',   now() - interval '21 days'),
  ('11111111-0000-0000-0000-000000000004', 'Karim',    '+33612000004', 'new',        6, 'yacht',      null, null, 6, null, null, 'non_communique', 'Cannes', null,
   false, now() - interval '35 minutes', now() - interval '35 minutes'),
  ('11111111-0000-0000-0000-000000000005', 'Charlotte','+33612000005', 'contacted',  5, 'gastronomie','Chef à domicile pour dîner de 8', 'Dîner d''affaires', 8, current_date + 6, null, 'moins_5k', 'Nice', null,
   false, now() - interval '6 hours',  now() - interval '2 days'),
  ('11111111-0000-0000-0000-000000000006', 'Alexandre','+33612000006', 'qualified',  7, 'transport',  'Hélicoptère Nice → Courchevel A/R', null, 4, current_date + 10, null, '5k_15k', 'Nice',
   E'Demande : transfert héli Nice → Courchevel aller-retour, 4 pax + bagages ski.\nProchaine étape : vérifier dispo opérateur.',
   true,  now() - interval '4 hours',  now() - interval '5 days'),
  ('11111111-0000-0000-0000-000000000007', 'Elena',    '+39330000007', 'followed_up',6, 'villa',      'Chalet 4 chambres', 'Nouvel an', 8, current_date + 140, current_date + 147, '15k_50k', 'Courchevel', null,
   false, now() - interval '4 days',   now() - interval '12 days'),
  ('11111111-0000-0000-0000-000000000008', 'Thomas',   '+33612000008', 'lost',       3, 'yacht',      null, 'EVG', 12, null, null, 'moins_5k', 'Saint-Tropez',
   'Budget incompatible avec la flotte disponible. Orienté ailleurs poliment.',
   false, now() - interval '15 days',  now() - interval '18 days'),
  ('11111111-0000-0000-0000-000000000009', 'Nadia',    '+33612000009', 'qualified',  8, 'bien_etre',  'Journée spa privatisé + coach', 'Cadeau', 2, current_date + 12, null, '5k_15k', 'Cap-Ferrat',
   E'Demande : journée bien-être en duo, spa privatisé, coach le matin.\nProchaine étape : proposer 2 établissements partenaires.',
   false, now() - interval '26 hours', now() - interval '4 days'),
  ('11111111-0000-0000-0000-000000000010', 'William',  '+44770000010', 'contacted',  4, 'evenement',  null, 'Séminaire entreprise', 30, null, null, 'non_communique', null, null,
   false, now() - interval '3 days',   now() - interval '6 days'),
  ('11111111-0000-0000-0000-000000000011', 'Camille',  '+33612000011', 'quote_sent', 7, 'yacht',      'Sunset cruise 3 h', 'Demande en mariage', 2, current_date + 9, null, '5k_15k', 'Monaco',
   E'Demande : croisière privée au coucher du soleil, demande en mariage.\nExigences : fleurs, champagne, photographe discret.\nDevis envoyé.',
   false, now() - interval '30 hours', now() - interval '7 days'),
  ('11111111-0000-0000-0000-000000000012', 'Olga',     '+7920000012',  'new',        5, 'villa',      null, null, 6, current_date + 60, current_date + 74, 'non_communique', 'Cannes', null,
   false, now() - interval '3 hours',  now() - interval '3 hours'),
  ('11111111-0000-0000-0000-000000000013', 'Pierre',   '+33612000013', 'booked',     8, 'gastronomie','Chef étoilé à la villa, 2 dîners', 'Séjour famille', 10, current_date + 15, null, '5k_15k', 'Saint-Jean-Cap-Ferrat',
   'Confirmé : chef partenaire réservé pour les 2 dîners.',
   false, now() - interval '6 days',   now() - interval '14 days'),
  ('11111111-0000-0000-0000-000000000014', 'Léa',      '+33612000014', 'contacted',  6, 'autre',      'Billets Grand Prix + hospitalité', 'Grand Prix de Monaco', 4, current_date + 90, null, '15k_50k', 'Monaco', null,
   false, now() - interval '2 days',   now() - interval '9 days'),
  ('11111111-0000-0000-0000-000000000015', 'Marc',     '+33612000015', 'new',        2, null, null, null, null, null, null, null, null, null,
   false, now() - interval '20 minutes', now() - interval '20 minutes');

-- ── Conversations WhatsApp (inbox) ───────────────────────────────────
insert into public.wa_conversations (id, customer_phone, customer_name, lead_id, is_paused, paused_until, unread_count, last_message_at)
values
  ('22222222-0000-0000-0000-000000000001', '+33612000001', 'Sophie',  '11111111-0000-0000-0000-000000000001', false, null, 0, now() - interval '2 hours'),
  ('22222222-0000-0000-0000-000000000004', '+33612000004', 'Karim',   '11111111-0000-0000-0000-000000000004', false, null, 1, now() - interval '35 minutes'),
  ('22222222-0000-0000-0000-000000000006', '+33612000006', 'Alexandre','11111111-0000-0000-0000-000000000006', true, now() + interval '20 hours', 2, now() - interval '4 hours'),
  ('22222222-0000-0000-0000-000000000011', '+33612000011', 'Camille', '11111111-0000-0000-0000-000000000011', false, null, 0, now() - interval '30 hours');

insert into public.wa_messages (conversation_id, from_me, is_from_human, body, created_at) values
  ('22222222-0000-0000-0000-000000000001', false, false, 'Bonjour, nous cherchons un yacht pour fêter notre anniversaire de mariage, une dizaine d''invités.', now() - interval '3 days'),
  ('22222222-0000-0000-0000-000000000001', true,  false, 'Bonsoir, avec grand plaisir — félicitations à vous deux. Vous imaginez plutôt une journée en mer ou une soirée au mouillage ?', now() - interval '3 days' + interval '2 minutes'),
  ('22222222-0000-0000-0000-000000000001', false, false, 'Une journée complète, au départ de Monaco idéalement.', now() - interval '3 days' + interval '10 minutes'),
  ('22222222-0000-0000-0000-000000000001', true,  false, 'C''est noté. Pour vous proposer les bons bateaux : à quelle date pensez-vous, et souhaitez-vous un chef à bord ?', now() - interval '3 days' + interval '12 minutes'),
  ('22222222-0000-0000-0000-000000000001', false, false, 'Dans 3 semaines environ, et oui pour le chef !', now() - interval '2 hours'),
  ('22222222-0000-0000-0000-000000000004', false, false, 'Bonjour, vous louez des yachts à Cannes ? On serait 6.', now() - interval '35 minutes'),
  ('22222222-0000-0000-0000-000000000006', false, false, 'Il me faudrait l''hélico assez tôt le matin en fait, 8h max à Courchevel.', now() - interval '4 hours'),
  ('22222222-0000-0000-0000-000000000006', true,  true,  'Bonjour Alexandre, je vérifie ça avec notre opérateur et je reviens vers vous d''ici midi.', now() - interval '3 hours'),
  ('22222222-0000-0000-0000-000000000011', true,  false, 'Votre devis pour la croisière au coucher du soleil vient de partir par email. Le photographe est disponible à la date souhaitée.', now() - interval '30 hours');

-- ── Historique cerveau (mémoire de l'agent) ──────────────────────────
insert into public.conversations (lead_id, channel, messages) values
  ('11111111-0000-0000-0000-000000000001', 'whatsapp',
   '[{"from":"client","text":"Bonjour, nous cherchons un yacht pour fêter notre anniversaire de mariage, une dizaine d''invités.","at":"seed"},
     {"from":"ai","text":"Bonsoir, avec grand plaisir — félicitations à vous deux. Vous imaginez plutôt une journée en mer ou une soirée au mouillage ?","at":"seed"},
     {"from":"client","text":"Une journée complète, au départ de Monaco idéalement.","at":"seed"},
     {"from":"ai","text":"C''est noté. Pour vous proposer les bons bateaux : à quelle date pensez-vous, et souhaitez-vous un chef à bord ?","at":"seed"}]'::jsonb);

-- ── Usage IA : ~200 appels répartis sur ~60 jours ────────────────────
-- Volumes réalistes : 2-6 appels/jour, prompts cachés (gros cache_read).
insert into public.ai_usage_events
  (occurred_at, source, model, customer_phone,
   input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, tool_turn)
select
  d.day
    + make_interval(hours => 8 + (h.n * 37) % 13, mins => (h.n * 17) % 60),
  case when (h.n + d.n) % 9 = 0 then 'followup' else 'agent' end,
  'claude-sonnet-4-6',
  '+3361200' || lpad(((h.n + d.n) % 15 + 1)::text, 4, '0'),
  350 + (h.n * 61 + d.n * 13) % 900,          -- input hors cache
  120 + (h.n * 43 + d.n * 7) % 380,           -- output
  case when h.n = 1 then 2800 else 0 end,     -- 1er appel du jour : écriture cache
  case when h.n = 1 then 0 else 2800 end,     -- suivants : lecture cache
  1 + (h.n % 3)
from (select generate_series(current_date - 59, current_date, interval '1 day') as day,
             extract(day from generate_series(current_date - 59, current_date, interval '1 day'))::int as n) d
cross join lateral (select generate_series(1, 2 + (d.n % 5)) as n) h;
