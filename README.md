# L'art de vivre — Agent WhatsApp « Apolline » + Dashboard

Infrastructure IA de la conciergerie de luxe **L'art de vivre** (yachts, villas,
événements privés, transferts, gastronomie, bien-être) :

- **Apolline**, concierge IA sur WhatsApp : accueille, qualifie, rédige un brief
  de mission pour l'équipe, escalade dès qu'il faut confirmer une disponibilité
  ou un prix. Relances automatiques en douceur (max 2, délai adaptatif).
- **Dashboard** ultra-lisible : leads, messages traités, conversations, inbox
  WhatsApp en direct, réglages de la base de connaissances.
- **Facturation à l'usage** : chaque appel IA est mesuré (tokens réels),
  valorisé au prix du modèle, converti en € et multiplié par la marge convenue.
  Export CSV mensuel prêt à joindre à la facture.

## Architecture

```
Client WhatsApp
      │
      ▼
baileys-service (Railway) ── debounce 12s / QR / reprise humaine
      │  x-agent-secret
      ▼
agent-concierge (Supabase Edge Function) ── cerveau Anthropic + 5 outils
      │                                      └─ metering → ai_usage_events
      ▼
Postgres Supabase ◄── agent-followups (pg_cron horaire, x-cron-secret)
      ▲
      │  RLS authenticated
Dashboard Next.js (Vercel) ── /  /leads  /agent  /facturation  /reglages
```

Trois secrets partagés (générer avec `openssl rand -hex 24`), chacun entre
exactement 2 runtimes :

| Secret | Émetteur → Récepteur | Header |
|---|---|---|
| `AGENT_SHARED_SECRET` | Baileys → agent-concierge | `x-agent-secret` |
| `CRON_SECRET` | pg_cron + Vercel → agent-followups | `x-cron-secret` |
| `BAILEYS_SERVICE_SECRET` | Vercel + Edge Functions → Baileys | `x-baileys-secret` |

## Mode démo (zéro configuration)

Déployé **sans aucune variable d'environnement**, le dashboard démarre en
mode démonstration : pas de login, données fictives réalistes sur toutes les
pages (leads, inbox, facturation, export CSV), bandeau « Mode démonstration ».
Idéal pour montrer le produit au client avant de brancher quoi que ce soit.
Renseigner les variables Supabase sur Vercel fait basculer en mode réel
automatiquement.

## Développement local

```bash
npm install
cp .env.example .env.local     # renseigner les valeurs
npm run dev                    # dashboard sur :3000
npm run build && npm run lint  # doivent rester verts
```

Edge Functions : `deno check supabase/functions/agent-concierge/index.ts` (idem
`agent-followups`). Test local du cerveau (nécessite `ANTHROPIC_API_KEY` dans
`supabase/functions/.env`) :

```bash
supabase functions serve agent-concierge
curl -X POST http://localhost:54321/functions/v1/agent-concierge \
  -H 'content-type: application/json' -H "x-agent-secret: $AGENT_SHARED_SECRET" \
  -d '{"message":"Bonjour, je cherche un yacht pour 8 personnes en juillet","phone":"+33612345678"}'
# → reply non vide, lead stub créé, 1+ lignes dans ai_usage_events
```

Service Baileys : `cd baileys-service && npm install && npm run build`.

Base : `supabase/seed_demo.sql` remplit un jeu de démonstration complet
(15 leads, conversations, ~240 appels IA sur 60 jours) — idéal pour montrer le
dashboard avant la mise en production. **Ne pas exécuter une fois le client actif.**

## Déploiement — checklist

### 1. Supabase
1. Créer un projet (région `eu-west-3`), puis `supabase link --project-ref <REF>`.
2. Éditer `supabase/migrations/0002_followups_cron.sql` : remplacer `PROJECT_REF`.
3. `supabase db push` (schéma complet + cron).
4. SQL Editor : exécuter `supabase/seed_agent_config.sql`
   (et `seed_demo.sql` seulement pour une démo).
5. `alter database postgres set app.cron_secret = '<CRON_SECRET>';`
6. `supabase functions deploy agent-concierge agent-followups`
   (le `config.toml` désactive la vérification JWT — l'auth passe par les secrets).
7. Secrets Edge Functions (`supabase secrets set`) :
   `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL=claude-sonnet-4-6`,
   `AGENT_SHARED_SECRET`, `CRON_SECRET`, `BAILEYS_SERVICE_URL`,
   `BAILEYS_SERVICE_SECRET`, `OWNER_PHONE` (E.164, notifications d'escalade).
8. Auth → Users → inviter le compte du gérant.

### 2. Railway (pont WhatsApp)
1. Nouveau service depuis ce repo, **root directory `baileys-service/`**
   (Dockerfile auto-détecté).
2. Variables : voir `baileys-service/.env.example`.
3. Déployer, vérifier `GET /health` → `{"ok":true,...}`.

### 3. Vercel (dashboard)
1. Importer le repo (root `/`).
2. Variables : voir `.env.example`.
3. Déployer, vérifier le login.

### 4. Connexion WhatsApp
1. Ouvrir `/agent` sur le dashboard.
2. Sur le téléphone de la conciergerie : WhatsApp → Appareils connectés →
   scanner le QR affiché.
3. Envoyer un message test depuis un autre numéro → réponse d'Apolline,
   lead créé dans `/leads`, consommation visible dans `/facturation`.

### 5. Mise au point métier (avec le client)
1. `/reglages` : compléter tous les champs `TO_BE_PROVIDED`
   (prix indicatifs, acompte, annulation, zones).
2. `/facturation` : fixer `marge` et `taux USD→EUR` selon l'accord commercial.

### 6. Recette bout-en-bout
Qualification yacht → brief de mission sur la fiche → demande de confirmation →
escalade (pause 24 h + notification WhatsApp au gérant) → reprise depuis
`/agent` → export CSV du mois.

## Ce que le dashboard mesure (et pourquoi)

- **Leads / messages traités / conversations / escalades** : la preuve de
  valeur, en face du client.
- **`ai_usage_events`** : 1 ligne par appel API Anthropic (chaque tour d'outil,
  retries compris) — fidèle à la facturation réelle du fournisseur.
- **`model_pricing`** : prix versionnés par date d'effet ; un changement de
  modèle ou de tarif n'altère jamais l'historique.
- **`billing_settings`** : marge et taux éditables depuis `/facturation`.
  Les champs `plan_type` / `included_amount_eur` / `overage_multiplier` sont
  prêts pour une bascule future en **forfait + usage inclus** sans refonte
  (seul `lib/billing.ts` changera).
