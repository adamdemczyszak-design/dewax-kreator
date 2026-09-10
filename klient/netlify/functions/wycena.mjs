/* =============================================================================
 * POST /api/wycena
 *
 * Link powrotny z maila: przeglądarka przysyła token, dostaje z powrotem
 * wyłącznie to, co klient sam podał, plus zapamiętane widełki. Identyfikatory
 * HubSpota zostają po stronie serwera.
 * ========================================================================== */
import { odszyfruj } from "../../lib/token.mjs";

const NAGLOWKI = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
function json(d, kod) { return new Response(JSON.stringify(d), { status: kod || 200, headers: NAGLOWKI }); }

export default async (req) => {
  if (req.method !== "POST") return json({ blad: "Ten adres przyjmuje wyłącznie POST." }, 405);
  let body = null;
  try { body = await req.json(); } catch (e) { body = null; }
  const stan = odszyfruj(body && body.token);
  if (!stan || !stan.kontakt) return json({ blad: "Nie znaleźliśmy tej konfiguracji. Otwórz link z maila jeszcze raz." }, 404);
  return json({
    ok: true,
    id: stan.id,
    konfiguracja: stan.konfiguracja,
    kwalifikacja: stan.kwalifikacja,
    kontakt: stan.kontakt,
    wycena: stan.wycena,
    utworzono: new Date(stan.t).toISOString(),
  }, 200);
};

export const config = { path: "/api/wycena" };
