/**
 * Appels serveur → service Baileys (Railway). Le secret partagé part dans
 * le header x-baileys-secret et ne transite jamais côté navigateur.
 */
export async function baileysFetch(path: string, init?: RequestInit) {
  const serviceUrl = process.env.BAILEYS_SERVICE_URL;
  if (!serviceUrl) throw new Error("BAILEYS_SERVICE_URL non configuré");

  return fetch(`${serviceUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-baileys-secret": process.env.BAILEYS_SERVICE_SECRET ?? "",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}
