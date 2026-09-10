/* =============================================================================
 * Sztywna lista przyjmowanych pól. Pole spoza listy kończy zgłoszenie błędem,
 * a nie jest po cichu ignorowane: nieznane pole to zmieniony front albo próba
 * wciśnięcia czegoś do CRM.
 * ========================================================================== */
import { STAN_BUDYNKU, OGRZEWANIE, DOLNE_ZRODLO, POMPY } from "./wycena.mjs";

export const ETYKIETY = {
  odwiert: { tak: "tak, jest miejsce", nie: "nie ma miejsca", nie_wiem: "nie wiem" },
  termin: { teraz: "jak najszybciej", kwartal: "w ciągu 3 miesięcy", polroku: "w ciągu pół roku", rok: "w ciągu roku", nie_wiem: "jeszcze nie wiem" },
  decyzja: { ja: "sam(a)", wspolnie: "wspólnie z partnerem lub rodziną", ktos_inny: "ktoś inny" },
  etap: { projekt: "projekt, przed budową", budowa: "w budowie, stan surowy", wykonczenie: "wykończenie", zamieszkany: "dom zamieszkany" },
  godzina: { "8-10": "8:00-10:00", "10-12": "10:00-12:00", "12-14": "12:00-14:00", "14-16": "14:00-16:00" },
};

const POLA_KONFIGURACJI = {
  m2:         { typ: "liczba", min: 30, max: 1000 },
  stan:       { typ: "lista", wartosci: Object.keys(STAN_BUDYNKU) },
  ogrzewanie: { typ: "lista", wartosci: Object.keys(OGRZEWANIE) },
  pompa:      { typ: "lista", wartosci: POMPY.map((p) => p.id) },
  dz:         { typ: "lista", wartosci: Object.keys(DOLNE_ZRODLO) },
};

const POLA_KWALIFIKACJI = {
  odwiert: { typ: "lista", wartosci: Object.keys(ETYKIETY.odwiert) },
  termin:  { typ: "lista", wartosci: Object.keys(ETYKIETY.termin) },
  decyzja: { typ: "lista", wartosci: Object.keys(ETYKIETY.decyzja) },
  etap:    { typ: "lista", wartosci: Object.keys(ETYKIETY.etap) },
};

const POLA_KONTAKTU = {
  imie:    { typ: "tekst", max: 80 },
  telefon: { typ: "telefon" },
  email:   { typ: "email" },
  adres:   { typ: "tekst", max: 200 },
  zgoda:   { typ: "zgoda" },
};

const POLA_POMIARU = {
  utm_source:   { typ: "tekst", max: 120, opcjonalne: true },
  utm_medium:   { typ: "tekst", max: 120, opcjonalne: true },
  utm_campaign: { typ: "tekst", max: 200, opcjonalne: true },
  utm_content:  { typ: "tekst", max: 200, opcjonalne: true },
  utm_term:     { typ: "tekst", max: 200, opcjonalne: true },
  fbclid:       { typ: "tekst", max: 300, opcjonalne: true },
  wejscie:      { typ: "tekst", max: 40, opcjonalne: true },
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/** Telefon polski: 9 cyfr, opcjonalnie z +48. */
export function normalizujTelefon(v) {
  const cyfry = String(v || "").replace(/[^\d+]/g, "").replace(/^\+?48/, "").replace(/\D/g, "");
  if (cyfry.length !== 9) return null;
  if (!/^[45678]/.test(cyfry)) return null;
  return "+48" + cyfry;
}

function sprawdzPole(nazwa, def, wartosc) {
  const pusto = wartosc === undefined || wartosc === null || wartosc === "";
  if (pusto) return def.opcjonalne ? { ok: true, wartosc: null } : { ok: false, blad: "Brak pola: " + nazwa };
  switch (def.typ) {
    case "liczba": {
      const n = Number(wartosc);
      if (!isFinite(n) || n < def.min || n > def.max) return { ok: false, blad: "Niepoprawna wartość: " + nazwa };
      return { ok: true, wartosc: n };
    }
    case "lista":
      if (def.wartosci.indexOf(String(wartosc)) < 0) return { ok: false, blad: "Niepoprawna wartość: " + nazwa };
      return { ok: true, wartosc: String(wartosc) };
    case "tekst":
      return { ok: true, wartosc: String(wartosc).replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, def.max) };
    case "email": {
      const e = String(wartosc).trim().toLowerCase();
      if (!EMAIL.test(e) || e.length > 150) return { ok: false, blad: "Niepoprawny adres e-mail." };
      return { ok: true, wartosc: e };
    }
    case "telefon": {
      const t = normalizujTelefon(wartosc);
      if (!t) return { ok: false, blad: "Niepoprawny numer telefonu. Podaj dziewięć cyfr." };
      return { ok: true, wartosc: t };
    }
    case "zgoda":
      if (wartosc !== true) return { ok: false, blad: "Bez zgody na kontakt nie możemy przyjąć zgłoszenia." };
      return { ok: true, wartosc: true };
    default:
      return { ok: false, blad: "Nieznany typ pola: " + nazwa };
  }
}

function sprawdzGrupe(schemat, dane, nazwaGrupy) {
  const wynik = {};
  for (const k of Object.keys(dane || {})) {
    if (!schemat[k]) return { ok: false, blad: "Nieznane pole w sekcji " + nazwaGrupy + ": " + k };
  }
  for (const n of Object.keys(schemat)) {
    const s = sprawdzPole(n, schemat[n], (dane || {})[n]);
    if (!s.ok) return s;
    wynik[n] = s.wartosc;
  }
  return { ok: true, dane: wynik };
}

export function sprawdzZgloszenie(body) {
  if (!body || typeof body !== "object") return { ok: false, blad: "Puste zgłoszenie." };
  const k = sprawdzGrupe(POLA_KONFIGURACJI, body.konfiguracja, "konfiguracja");
  if (!k.ok) return k;
  const q = sprawdzGrupe(POLA_KWALIFIKACJI, body.kwalifikacja, "kwalifikacja");
  if (!q.ok) return q;
  const c = sprawdzGrupe(POLA_KONTAKTU, body.kontakt, "kontakt");
  if (!c.ok) return c;
  const p = sprawdzGrupe(POLA_POMIARU, body.pomiar || {}, "pomiar");
  if (!p.ok) return p;
  return { ok: true, konfiguracja: k.dane, kwalifikacja: q.dane, kontakt: c.dane, pomiar: p.dane };
}

/** Termin telefonu: data YYYY-MM-DD w najbliższych 14 dniach + jedno z okien. */
export function sprawdzTermin(t) {
  if (!t || typeof t !== "object") return { ok: false, blad: "Brak terminu." };
  const data = String(t.data || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { ok: false, blad: "Niepoprawna data." };
  const d = Date.parse(data + "T12:00:00Z");
  const dzis = Date.now() - 24 * 3600 * 1000;
  if (!isFinite(d) || d < dzis || d > Date.now() + 15 * 24 * 3600 * 1000) return { ok: false, blad: "Data poza zakresem." };
  const okno = String(t.okno || "");
  if (!ETYKIETY.godzina[okno]) return { ok: false, blad: "Niepoprawna godzina." };
  return { ok: true, data, okno, opis: data.split("-").reverse().join(".") + ", " + ETYKIETY.godzina[okno] };
}
