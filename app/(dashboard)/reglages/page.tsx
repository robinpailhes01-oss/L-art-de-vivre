import { AlertTriangle } from "lucide-react";

import { demoAgentConfig, isDemo } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SERVICE_LABEL } from "@/lib/leads";
import {
  updateFaq,
  updateFollowups,
  updateHours,
  updateIdentity,
  updateService,
} from "./actions";

export const dynamic = "force-dynamic";

type Dict = Record<string, unknown>;

const FAQ_FIELDS: Array<[string, string]> = [
  ["delai_reponse", "Délai de réponse de l'équipe"],
  ["acompte", "Acompte"],
  ["annulation", "Conditions d'annulation"],
  ["zones_couvertes", "Zones couvertes"],
  ["confidentialite", "Confidentialité"],
];

function countPlaceholders(value: unknown): number {
  return (JSON.stringify(value ?? {}).match(/TO_BE_PROVIDED/g) ?? []).length;
}

export default async function ReglagesPage() {
  let config;
  if (isDemo()) {
    config = demoAgentConfig;
  } else {
    const supabase = await createClient();
    config = (await supabase.from("agent_config").select("*").limit(1).single()).data;
  }

  if (!config) {
    return (
      <p className="text-sm text-muted-foreground">
        agent_config introuvable — exécuter supabase/seed_agent_config.sql.
      </p>
    );
  }

  const identity = (config.identity ?? {}) as Dict;
  const services = (config.services ?? {}) as Record<string, Dict>;
  const faq = (config.faq ?? {}) as Dict;
  const hours = (config.business_hours ?? {}) as Dict;
  const placeholders = countPlaceholders(config.services) + countPlaceholders(config.faq);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">Réglages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          La base de connaissances d&apos;Apolline. Chaque modification est prise en compte au
          message suivant, sans redéploiement.
        </p>
      </div>

      {placeholders > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/8 px-4 py-3 text-sm text-warning">
          <AlertTriangle className="size-4 shrink-0" />
          {placeholders} information{placeholders > 1 ? "s" : ""} encore à compléter avec le client
          (champs « TO_BE_PROVIDED ») — Apolline dira « je vérifie avec l&apos;équipe » en attendant.
        </div>
      )}

      {/* Identité */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg font-semibold">Identité</CardTitle>
          <CardDescription>Le nom de l&apos;agent et de la maison, utilisés dans chaque conversation.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateIdentity} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Prénom de l'agent" name="agent_name" defaultValue={String(identity.agent_name ?? "Apolline")} />
            <Field label="Nom de la maison" name="company" defaultValue={String(identity.company ?? "L'art de vivre")} />
            <Field label="Port d'attache" name="base_location" defaultValue={String(identity.base_location ?? "")} />
            <Field
              label="Langues (séparées par des virgules)"
              name="languages"
              defaultValue={Array.isArray(identity.languages) ? (identity.languages as string[]).join(", ") : "fr, en"}
            />
            <div className="sm:col-span-2">
              <Button type="submit" size="sm">Enregistrer l&apos;identité</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Catalogue */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg font-semibold">Catalogue des prestations</CardTitle>
          <CardDescription>
            Ce qu&apos;Apolline sait proposer. « À partir de » est le seul ordre de prix qu&apos;elle
            est autorisée à citer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(services).map(([key, svc]) => (
            <form
              key={key}
              action={updateService.bind(null, key)}
              className="space-y-3 rounded-xl border border-border p-4"
            >
              <p className="font-display text-base font-semibold text-primary">
                {SERVICE_LABEL[key] ?? key}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Nom affiché" name="name" defaultValue={String(svc.name ?? "")} />
                <Field
                  label="À partir de (prix indicatif)"
                  name="from_price"
                  defaultValue={String(svc.from_price ?? "")}
                  warn={svc.from_price === "TO_BE_PROVIDED"}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${key}-description`}>Description</Label>
                <Textarea
                  id={`${key}-description`}
                  name="description"
                  defaultValue={String(svc.description ?? "")}
                  rows={2}
                />
              </div>
              {Array.isArray(svc.zones) && (
                <Field
                  label="Zones (séparées par des virgules)"
                  name="zones"
                  defaultValue={(svc.zones as string[]).join(", ")}
                />
              )}
              <Button type="submit" size="sm" variant="outline">Enregistrer</Button>
            </form>
          ))}
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg font-semibold">Process & FAQ</CardTitle>
          <CardDescription>Les réponses de la maison aux questions récurrentes.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateFaq} className="space-y-4">
            {FAQ_FIELDS.map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`faq-${key}`}>
                  {label}
                  {faq[key] === "TO_BE_PROVIDED" && (
                    <span className="ml-2 text-xs font-normal text-warning">à compléter</span>
                  )}
                </Label>
                <Textarea id={`faq-${key}`} name={key} defaultValue={String(faq[key] ?? "")} rows={2} />
              </div>
            ))}
            <Button type="submit" size="sm">Enregistrer la FAQ</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Horaires */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg font-semibold">Horaires</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateHours} className="space-y-4">
              <Field label="Équipe humaine" name="equipe" defaultValue={String(hours.equipe ?? "")} />
              <Field label="Agent (Apolline)" name="agent" defaultValue={String(hours.agent ?? "24h/24, 7j/7")} />
              <Button type="submit" size="sm">Enregistrer</Button>
            </form>
          </CardContent>
        </Card>

        {/* Relances */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg font-semibold">Relances automatiques</CardTitle>
            <CardDescription>Apolline relance en douceur les clients restés sans réponse.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateFollowups} className="space-y-4">
              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  name="auto_followup_enabled"
                  defaultChecked={config.auto_followup_enabled}
                  className="size-4 accent-[var(--primary)]"
                />
                Relances automatiques activées
              </label>
              <div className="space-y-1.5">
                <Label htmlFor="max_followups">Nombre maximum de relances</Label>
                <Input
                  id="max_followups"
                  name="max_followups"
                  type="number"
                  min={0}
                  max={5}
                  defaultValue={config.max_followups}
                  className="h-9 w-24"
                />
              </div>
              <Button type="submit" size="sm">Enregistrer</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  warn,
}: {
  label: string;
  name: string;
  defaultValue: string;
  warn?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label}
        {warn && <span className="ml-2 text-xs font-normal text-warning">à compléter</span>}
      </Label>
      <Input id={name} name={name} defaultValue={defaultValue} className="h-9" />
    </div>
  );
}
