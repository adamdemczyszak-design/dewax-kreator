/* =============================================================================
 * Połączenia z usługami DEWAX. Wszystkie kody dostępu pochodzą ze zmiennych
 * środowiskowych Netlify; ten kod działa wyłącznie w funkcji serwerowej.
 *
 *   HubSpot   -> worker dewax-hubspot (ta sama ścieżka, którą zapisuje kreator
 *                zespołowy: POST /search, POST /contact, PATCH /contact/{id},
 *                POST /deal, PATCH /deal/{id}, POST /deal/{id}/note,
 *                POST /contact/{id}/note), nagłówek X-Dewax-Auth
 *   Maile     -> worker dewax-send (Resend), nagłówek X-Dewax-Auth
 *   SMS       -> webhook Make (scenariusz z modułem SMSAPI)
 * ========================================================================== */

const HUBSPOT_URL = (process.env.HUBSPOT_PROXY || "https://dewax-hubspot.adam-demczyszak.workers.dev").replace(/\/+$/, "");
const SEND_URL = (process.env.SEND_PROXY || "https://dewax-send.adam-demczyszak.workers.dev").replace(/\/+$/, "");

function czas(ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, koniec: () => clearTimeout(t) };
}

async function zapytanie(url, opcje, ms) {
  const t = czas(ms || 12000);
  try {
    const r = await fetch(url, Object.assign({}, opcje, { signal: t.signal }));
    const tekst = await r.text();
    let json = null;
    try { json = JSON.parse(tekst); } catch (e) { json = null; }
    return { ok: r.ok, status: r.status, json, tekst: tekst.slice(0, 300) };
  } catch (e) {
    return { ok: false, status: 0, json: null, tekst: String(e && e.message || e).slice(0, 200) };
  } finally {
    t.koniec();
  }
}

/* ------------------------------------------------------------------------- */
/* HubSpot przez worker dewax-hubspot                                         */
/* ------------------------------------------------------------------------- */

export function hubspotSkonfigurowany() { return !!process.env.DEWAX_AUTH_TOKEN; }

async function hs(sciezka, metoda, body) {
  return zapytanie(HUBSPOT_URL + sciezka, {
    method: metoda,
    headers: { "Content-Type": "application/json", "X-Dewax-Auth": process.env.DEWAX_AUTH_TOKEN || "" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function szukajKontaktu(prop, value, operator) {
  const r = await hs("/search", "POST", {
    limit: 5,
    properties: ["email", "phone", "firstname", "lastname"],
    filterGroups: [{ filters: [{ propertyName: prop, operator: operator || "EQ", value: String(value) }] }],
  });
  if (!r.ok || !r.json) return null;
  const arr = r.json.results || r.json.contacts || r.json.data || [];
  return arr.length && arr[0] && arr[0].id ? String(arr[0].id) : null;
}

/** Kontakt: e-mail -> telefon -> 9 ostatnich cyfr -> nowy. Jak `hsResolveContactId` w kreatorze. */
export async function kontaktHubspot(kontakt, wlasciwosci) {
  let id = await szukajKontaktu("email", kontakt.email);
  if (!id) id = await szukajKontaktu("phone", kontakt.telefon);
  if (!id) id = await szukajKontaktu("phone", kontakt.telefon.replace(/\D/g, "").slice(-9), "CONTAINS_TOKEN");

  const imie = String(kontakt.imie).trim().split(/\s+/).filter(Boolean);
  const podstawowe = {
    firstname: imie[0] || "Klient",
    lastname: imie.slice(1).join(" ") || "(konfigurator pompy.dewax.pl)",
    email: kontakt.email,
    phone: kontakt.telefon,
    lifecyclestage: "lead",
  };

  let nowy = false;
  if (!id) {
    const r = await hs("/contact", "POST", { properties: podstawowe });
    if (!r.ok) return { ok: false, blad: "kontakt: HTTP " + r.status + " " + r.tekst };
    id = r.json && (r.json.id || (r.json.contact && r.json.contact.id));
    if (!id) return { ok: false, blad: "kontakt: brak id w odpowiedzi" };
    id = String(id);
    nowy = true;
  }

  // Pola istniejące w portalu: jedno żądanie. Pola, które zakłada dopiero
  // /setup workera (utm, źródło leada): osobne żądanie, żeby ich ewentualny
  // brak nie przewrócił zapisu podstawowego.
  const ostrzezenia = [];
  const r1 = await hs("/contact/" + id, "PATCH", { properties: wlasciwosci.istniejace });
  if (!r1.ok) ostrzezenia.push("pola kontaktu: HTTP " + r1.status + " " + r1.tekst);
  if (wlasciwosci.opcjonalne && Object.keys(wlasciwosci.opcjonalne).length) {
    const r2 = await hs("/contact/" + id, "PATCH", { properties: wlasciwosci.opcjonalne });
    if (!r2.ok) ostrzezenia.push("pola UTM/źródło (wymagają /setup workera): HTTP " + r2.status);
  }
  return { ok: true, id, nowy, ostrzezenia };
}

export async function transakcjaHubspot(dane) {
  const props = {
    dealname: dane.nazwa,
    amount: String(dane.kwota),
    deal_currency_code: "PLN",
    dealstage: process.env.HUBSPOT_ETAP || "appointmentscheduled",   // „Nowy lead"
    description: dane.opis,
  };
  const owner = process.env.HUBSPOT_OWNER_ID || "76509862";   // konto Adama, jak w kreatorze zespołowym
  props.hubspot_owner_id = owner;
  const r = await hs("/deal", "POST", {
    contactId: dane.kontaktId, dealname: dane.nazwa, amount: String(dane.kwota),
    deal_currency_code: "PLN", hubspot_owner_id: owner, properties: props,
  });
  if (!r.ok) return { ok: false, blad: "transakcja: HTTP " + r.status + " " + r.tekst };
  const id = r.json && (r.json.id || (r.json.deal && r.json.deal.id));
  return { ok: true, id: id ? String(id) : null };
}

export async function notatkaHubspot(typ, id, tresc) {
  const r = await hs("/" + (typ === "deal" ? "deal" : "contact") + "/" + id + "/note", "POST", { body: tresc });
  return r.ok;
}

export async function zmienTransakcje(id, properties) {
  const r = await hs("/deal/" + id, "PATCH", { properties });
  return r.ok;
}

export async function zmienKontakt(id, properties) {
  const r = await hs("/contact/" + id, "PATCH", { properties });
  return r.ok;
}

/* ------------------------------------------------------------------------- */
/* Maile przez worker dewax-send                                              */
/* ------------------------------------------------------------------------- */

export function wysylkaSkonfigurowana() { return !!process.env.DEWAX_SEND_TOKEN; }

export async function wyslijMail(w) {
  if (!wysylkaSkonfigurowana()) return { ok: false, blad: "brak DEWAX_SEND_TOKEN" };
  const r = await zapytanie(SEND_URL + "/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Dewax-Auth": process.env.DEWAX_SEND_TOKEN,
      // Worker sprawdza listę ALLOWED_ORIGIN po nagłówku Origin; podajemy adres
      // tej strony, żeby wpis na liście workera był jednoznaczny.
      "Origin": process.env.URL || "https://dewax-pompy.netlify.app",
    },
    body: JSON.stringify({
      to: w.to, subject: w.subject, html: w.html,
      replyTo: w.replyTo || "biuro@dewax.pl",
    }),
  }, 20000);
  if (!(r.ok && r.json && r.json.ok)) return { ok: false, blad: "wysyłka: HTTP " + r.status + " " + r.tekst };
  return { ok: true, id: r.json.id || "" };
}

/* ------------------------------------------------------------------------- */
/* SMS przez Make                                                             */
/* ------------------------------------------------------------------------- */

export function smsSkonfigurowany() { return !!(process.env.MAKE_WEBHOOK && process.env.SMS_DO); }

export async function wyslijSms(dane) {
  if (!process.env.MAKE_WEBHOOK) return { ok: false, blad: "brak MAKE_WEBHOOK" };
  if (!process.env.SMS_DO) return { ok: false, blad: "brak numeru SMS_DO" };
  const r = await zapytanie(process.env.MAKE_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({ do: process.env.SMS_DO }, dane)),
  }, 10000);
  return r.ok ? { ok: true } : { ok: false, blad: "Make: HTTP " + r.status + " " + r.tekst };
}

/* ------------------------------------------------------------------------- */
/* Cloudflare Turnstile (opcjonalnie: gdy TURNSTILE_SECRET jest ustawiony)    */
/* ------------------------------------------------------------------------- */

export async function turnstileOk(token, ip) {
  if (!process.env.TURNSTILE_SECRET) return true;   // nie skonfigurowano: nie blokujemy
  if (!token) return false;
  const r = await zapytanie("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: process.env.TURNSTILE_SECRET, response: token, remoteip: ip }),
  }, 8000);
  return !!(r.ok && r.json && r.json.success);
}
