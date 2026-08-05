// Normalisation téléphone (E.164, biais France).
// Évite les doublons quand un même client est saisi en "06xx xx", "+33…", "33…".
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = String(input).trim().replace(/[\s\-().]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("+")) return /^\+\d{6,15}$/.test(s) ? s : null;
  if (/^0\d{9}$/.test(s)) return "+33" + s.slice(1); // 0XXXXXXXXX → +33XXXXXXXXX
  if (/^33\d{9}$/.test(s)) return "+" + s;            // 33XXXXXXXXX → +33XXXXXXXXX
  if (/^\d{6,15}$/.test(s)) return "+" + s;
  return null;
}
