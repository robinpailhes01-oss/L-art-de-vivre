// Notification WhatsApp au gérant via le service Baileys (Railway).
// Best-effort : une notification perdue ne doit pas faire échouer l'appel.

const BAILEYS_SERVICE_URL = Deno.env.get("BAILEYS_SERVICE_URL") ?? "";
const BAILEYS_SERVICE_SECRET = Deno.env.get("BAILEYS_SERVICE_SECRET") ?? "";
const OWNER_PHONE = Deno.env.get("OWNER_PHONE") ?? "";

export async function notifyOwner(message: string): Promise<void> {
  if (!BAILEYS_SERVICE_URL || !OWNER_PHONE) return;
  try {
    await fetch(`${BAILEYS_SERVICE_URL}/notify`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-baileys-secret": BAILEYS_SERVICE_SECRET,
      },
      body: JSON.stringify({ phone: OWNER_PHONE, message }),
    });
  } catch (e) {
    console.warn("[notify] notifyOwner failed:", e);
  }
}

// Envoi d'un message client via Baileys (utilisé par les relances).
export async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  if (!BAILEYS_SERVICE_URL) return false;
  try {
    const res = await fetch(`${BAILEYS_SERVICE_URL}/send-agent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-baileys-secret": BAILEYS_SERVICE_SECRET,
      },
      body: JSON.stringify({ phone, message }),
    });
    return res.ok;
  } catch (e) {
    console.warn("[notify] sendWhatsApp failed:", e);
    return false;
  }
}
