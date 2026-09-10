/* =============================================================================
 * Link powrotny: stan konfiguracji zaszyfrowany (AES-256-GCM) kluczem
 * z LINK_SECRET. W adresie nie ma czytelnych danych osobowych ani
 * identyfikatorów z HubSpota; przeglądarka odzyskuje stan przez
 * POST /api/wycena, a serwer odszyfrowuje i zwraca tylko to, co klient
 * sam podał. Podrobienie tokenu bez klucza nie jest możliwe (GCM uwierzytelnia).
 * ========================================================================== */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function klucz() {
  const s = process.env.LINK_SECRET || "";
  if (s.length < 16) return null;   // brak konfiguracji zamyka, nie otwiera
  return createHash("sha256").update(s).digest();
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function odB64url(s) {
  const t = String(s).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(t + "=".repeat((4 - (t.length % 4)) % 4), "base64");
}

export function linkDostepny() { return !!klucz(); }

export function zaszyfruj(obj) {
  const k = klucz();
  if (!k) return null;
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const dane = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return "1." + b64url(iv) + "." + b64url(Buffer.concat([dane, tag]));
}

export function odszyfruj(token) {
  const k = klucz();
  if (!k || typeof token !== "string") return null;
  const cz = token.split(".");
  if (cz.length !== 3 || cz[0] !== "1") return null;
  try {
    const iv = odB64url(cz[1]);
    const calosc = odB64url(cz[2]);
    if (iv.length !== 12 || calosc.length < 17) return null;
    const dane = calosc.subarray(0, calosc.length - 16);
    const tag = calosc.subarray(calosc.length - 16);
    const d = createDecipheriv("aes-256-gcm", k, iv);
    d.setAuthTag(tag);
    const jawne = Buffer.concat([d.update(dane), d.final()]).toString("utf8");
    return JSON.parse(jawne);
  } catch (e) {
    return null;
  }
}
