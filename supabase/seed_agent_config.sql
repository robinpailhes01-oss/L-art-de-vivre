-- Base de connaissances d'Apolline — source unique (pas de fichier JSON
-- parallèle : ce seed initialise, /reglages édite ensuite).
-- Idempotent : delete + insert.
--
-- ⚠️ Les valeurs TO_BE_PROVIDED sont à compléter AVEC LE CLIENT via la page
-- Réglages avant la mise en production. Apolline sait dire « je vérifie avec
-- l'équipe » quand une info manque, mais mieux vaut la renseigner.

delete from public.agent_config;

insert into public.agent_config (identity, services, faq, business_hours, auto_followup_enabled, max_followups)
values (
  '{
    "agent_name": "Apolline",
    "company": "L''art de vivre",
    "role": "concierge personnelle",
    "base_location": "Côte d''Azur",
    "languages": ["fr", "en"]
  }'::jsonb,
  '{
    "yacht": {
      "name": "Location & charter de yachts",
      "description": "À la journée ou en croisière, avec équipage. Sélection selon le nombre d''invités et le style recherché.",
      "from_price": "TO_BE_PROVIDED",
      "zones": ["Côte d''Azur", "Monaco", "Corse"]
    },
    "villa": {
      "name": "Villas & propriétés d''exception",
      "description": "Séjours courts et locations saisonnières. Staff (chef, majordome, ménage) sur demande.",
      "from_price": "TO_BE_PROVIDED",
      "zones": ["Saint-Tropez", "Cannes", "Courchevel", "TO_BE_PROVIDED"]
    },
    "evenement": {
      "name": "Événements privés",
      "description": "Anniversaires, mariages, soirées d''entreprise : lieu, traiteur, artistes, scénographie.",
      "from_price": "TO_BE_PROVIDED"
    },
    "transport": {
      "name": "Transferts premium",
      "description": "Jet privé, hélicoptère, voiture avec chauffeur.",
      "from_price": "TO_BE_PROVIDED"
    },
    "gastronomie": {
      "name": "Chef à domicile & tables privées",
      "description": "Chefs étoilés à domicile, réservations dans les tables les plus demandées.",
      "from_price": "TO_BE_PROVIDED"
    },
    "bien_etre": {
      "name": "Bien-être & expériences",
      "description": "Spa privé, coach personnel, expériences sur mesure.",
      "from_price": "TO_BE_PROVIDED"
    }
  }'::jsonb,
  '{
    "delai_reponse": "L''équipe confirme disponibilités et devis sous quelques heures en journée (9h-20h).",
    "acompte": "TO_BE_PROVIDED",
    "annulation": "TO_BE_PROVIDED",
    "zones_couvertes": "Côte d''Azur en priorité ; autres destinations étudiées sur demande.",
    "confidentialite": "Discrétion absolue : aucune information client n''est partagée."
  }'::jsonb,
  '{
    "equipe": "9h-20h, 7j/7",
    "agent": "24h/24, 7j/7"
  }'::jsonb,
  true,
  2
);
