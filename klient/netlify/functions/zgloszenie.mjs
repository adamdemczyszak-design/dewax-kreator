/* =============================================================================
 * POST /api/zgloszenie
 *
 * Przyjmuje konfigurację, pytania kwalifikacyjne i dane kontaktowe klienta.
 * Kolejność działań jest celowa:
 *   1. walidacja po sztywnej liście pól, honeypot, Turnstile (gdy skonfigurowany),
 *      limit zgłoszeń z jednego adresu,
 *   2. widełki (liczone tu, nie w przeglądarce - klient nie widzi cennika),
 *   3. HubSpot: kontakt + transakcja + notatka, tą samą drogą co kreator zespołu,
 *   4. link powrotny,
 *   5. mail do biura, SMS do handlowca, mail do klienta.
 * Błąd w kroku 3-5 nie zabiera klientowi wyniku: widełki wracają zawsze,
 * a braki trafiają do logu funkcji i do maila do biura.
 * ========================================================================== */
import { policzWidelki } from "../../lib/wycena.mjs";
import { sprawdzZgloszenie } from "../../lib/walidacja.mjs";
import { zaszyfruj, linkDostepny } from "../../lib/token.mjs";
import { podsumowanie, mailDoBiura, mailDoKlienta, smsPoZgloszeniu, widelkiTekst } from "../../lib/tresci.mjs";
import {
  hubspotSkonfigurowany, kontaktHubspot, transakcjaHubspot, notatkaHubspot,
  wyslijMail, wyslijSms, turnstileOk,
} from "../../lib/uslugi.mjs";
import { limitIp } from "../../lib/limit.mjs";

const NAGLOWKI = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

function json(dane, kod) {
  return new Response(JSON.stringify(dane), { status: kod || 200, headers: NAGLOWKI });
}

function log(obiekt) {
  console.log(JSON.stringify(Object.assign({ funkcja: "zgloszenie", czas: new Date().toISOString() }, obiekt)));
}

function ipZ(req, context) {
  return (context && context.ip) || req.headers.get("x-nf-client-connection-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "0.0.0.0";
}

function nowyId() {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const losowe = Math.random().toString(36).slice(2, 8).toUpperCase();
  return "K-" + d + "-" + losowe;
}

export default async (req, context) => {
  if (req.method !== "POST") return json({ blad: "Ten adres przyjmuje wyłącznie POST." }, 405);

  let body = null;
  try { body = await req.json(); } catch (e) { body = null; }
  if (!body || typeof body !== "object") return json({ blad: "Puste zgłoszenie." }, 400);

  const ip = ipZ(req, context);

  // Honeypot: pole niewidoczne dla człowieka. Odpowiadamy 200, żeby bot nie
  // wiedział, że został rozpoznany.
  if (body.firma) { log({ zdarzenie: "honeypot", ip }); return json({ ok: true, wycena: null }, 200); }

  if (!(await turnstileOk(body.turnstile, ip))) {
    return json({ blad: "Nie udało się potwierdzić, że zgłoszenie wysyła człowiek. Odśwież stronę i spróbuj ponownie." }, 403);
  }

  const limit = await limitIp(ip);
  if (!limit.wolno) {
    log({ zdarzenie: "limit_ip", ip });
    return json({ blad: "Za dużo zgłoszeń z tego urządzenia. Spróbuj za godzinę albo zadzwoń: 62 741 32 27." }, 429);
  }

  const s = sprawdzZgloszenie({ konfiguracja: body.konfiguracja, kwalifikacja: body.kwalifikacja, kontakt: body.kontakt, pomiar: body.pomiar });
  if (!s.ok) return json({ blad: s.blad }, 400);

  let w;
  try { w = policzWidelki(s.konfiguracja); }
  catch (e) { return json({ blad: "Nie udało się policzyć widełek: " + e.message }, 400); }

  const id = nowyId();
  const braki = [];
  const hs = { c: null, d: null };

  /* --- HubSpot ---------------------------------------------------------- */
  if (!hubspotSkonfigurowany()) {
    braki.push("HubSpot: brak DEWAX_AUTH_TOKEN w zmiennych Netlify");
  } else {
    try {
      const kontakt = await kontaktHubspot(s.kontakt, {
        istniejace: {
          dewax_adres_inwestycji: s.kontakt.adres,
          dewax_powierzchnia_grzewcza: String(s.konfiguracja.m2),
          dewax_handlowiec: process.env.HANDLOWIEC || "Daria",
          hs_lead_status: "NEW",
        },
        opcjonalne: Object.assign(
          { dewax_zrodlo_leada: "konfigurator klienta", dewax_wycena_id: id, dewax_wersja_cennika: w.wersjaCennika },
          s.pomiar.utm_source ? { dewax_utm_source: s.pomiar.utm_source } : {},
          s.pomiar.utm_medium ? { dewax_utm_medium: s.pomiar.utm_medium } : {},
          s.pomiar.utm_campaign ? { dewax_utm_campaign: s.pomiar.utm_campaign } : {},
          s.pomiar.utm_content ? { dewax_utm_content: s.pomiar.utm_content } : {},
          s.pomiar.fbclid ? { dewax_fbclid: s.pomiar.fbclid } : {},
        ),
      });
      if (!kontakt.ok) {
        braki.push("HubSpot " + kontakt.blad);
      } else {
        hs.c = kontakt.id;
        braki.push(...(kontakt.ostrzezenia || []).map((o) => "HubSpot " + o));
        const srodek = Math.round((w.od + w.do) / 2);
        const deal = await transakcjaHubspot({
          kontaktId: kontakt.id,
          nazwa: s.kontakt.imie + " - konfigurator, " + s.konfiguracja.m2 + " m2, " + w.pompa.nazwa,
          kwota: srodek,
          opis: "Konfigurator klienta " + id + ". Widełki " + widelkiTekst(w) + " brutto. "
            + "Termin: " + s.kwalifikacja.termin + ", decyduje: " + s.kwalifikacja.decyzja + ", etap: " + s.kwalifikacja.etap
            + ", miejsce na odwiert: " + s.kwalifikacja.odwiert + ". Źródło: " + (s.pomiar.utm_source || "-") + " / " + (s.pomiar.utm_medium || "-") + " / " + (s.pomiar.utm_campaign || "-") + ".",
        });
        if (!deal.ok) braki.push("HubSpot " + deal.blad);
        else hs.d = deal.id;
      }
    } catch (e) {
      braki.push("HubSpot: " + String(e && e.message || e).slice(0, 200));
    }
  }

  /* --- Link powrotny ----------------------------------------------------- */
  const stan = {
    v: 1, id, t: Date.now(),
    konfiguracja: s.konfiguracja, kwalifikacja: s.kwalifikacja, kontakt: s.kontakt,
    wycena: { od: w.od, do: w.do, pompa: w.pompa.nazwa, dz: w.dz.nazwa },
    hs,
  };
  const token = linkDostepny() ? zaszyfruj(stan) : null;
  if (!token) braki.push("Link powrotny: brak LINK_SECRET w zmiennych Netlify");
  const adres = (process.env.URL || "https://dewax-pompy.netlify.app").replace(/\/+$/, "");
  const link = token ? adres + "/?k=" + token : null;

  /* --- Notatka w HubSpocie (pełne odpowiedzi słowo w słowo) ------------- */
  const tresc = podsumowanie({ konfiguracja: s.konfiguracja, kwalifikacja: s.kwalifikacja, kontakt: s.kontakt, pomiar: s.pomiar }, w, { id, ip, link });
  if (hs.d) { if (!(await notatkaHubspot("deal", hs.d, tresc))) braki.push("HubSpot: notatka na transakcji nie zapisana"); }
  else if (hs.c) { if (!(await notatkaHubspot("contact", hs.c, tresc))) braki.push("HubSpot: notatka na kontakcie nie zapisana"); }

  /* --- Powiadomienia ----------------------------------------------------- */
  const z = { konfiguracja: s.konfiguracja, kwalifikacja: s.kwalifikacja, kontakt: s.kontakt, pomiar: s.pomiar };
  const mBiuro = mailDoBiura(z, w, {
    id, ip, link,
    hubspot: hs.d ? "transakcja " + hs.d + ", kontakt " + hs.c : (hs.c ? "kontakt " + hs.c + ", transakcja NIE utworzona" : "NIE zapisano"),
  });
  if (braki.length) mBiuro.html += "<p><b>Braki przy zapisie:</b><br>" + braki.map((b) => String(b).replace(/</g, "&lt;")).join("<br>") + "</p>";
  const r1 = await wyslijMail(mBiuro);
  if (!r1.ok) braki.push("Mail do biura: " + r1.blad);

  const r2 = await wyslijSms({
    tresc: smsPoZgloszeniu(z, w), imie: s.kontakt.imie, telefon: s.kontakt.telefon,
    godzina: "nie wybrana", widelki: widelkiTekst(w), dealId: hs.d || "",
  });
  if (!r2.ok) braki.push("SMS: " + r2.blad);

  const r3 = await wyslijMail(mailDoKlienta(z, w, link));
  if (!r3.ok) braki.push("Mail do klienta: " + r3.blad);

  log({ zdarzenie: "zgloszenie", id, dealId: hs.d, kontaktId: hs.c, od: w.od, do: w.do, utm: s.pomiar.utm_source || "-", braki });

  // Do przeglądarki wracają tylko widełki i to, co klient sam podał.
  return json({
    ok: true,
    id,
    token,
    wycena: {
      od: w.od, do: w.do, vat: w.vat,
      pompa: w.pompa, polecana: w.polecana, kaskada: w.kaskada, zaMala: w.zaMala, przewymiarowana: w.przewymiarowana,
      czescStala: w.czescStala.brutto,
      dolneZrodlo: { od: w.dolneZrodlo.od, do: w.dolneZrodlo.do, nazwa: w.dz.nazwa,
        od_ilosc: w.dz.od.ilosc, do_ilosc: w.dz.do.ilosc, jednostka: w.dz.od.jednostka, otwory: w.dz.od.otwory || null },
      pDesign: w.pDesign,
    },
    mailDoKlienta: r3.ok,
  }, 200);
};

export const config = { path: "/api/zgloszenie" };
