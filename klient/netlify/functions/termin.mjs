/* =============================================================================
 * POST /api/termin
 *
 * Klient kliknął „Chcę dokładną wycenę" i wybrał godzinę telefonu. Wejście to
 * token linku powrotnego (uwierzytelniony, z identyfikatorami HubSpota) plus
 * data i okno godzinowe. Zapis: notatka na transakcji i następny krok na
 * kontakcie, mail do biura, SMS do handlowca.
 * ========================================================================== */
import { odszyfruj } from "../../lib/token.mjs";
import { sprawdzTermin } from "../../lib/walidacja.mjs";
import { notatkaHubspot, zmienKontakt, wyslijMail, wyslijSms, hubspotSkonfigurowany } from "../../lib/uslugi.mjs";
import { mailTermin, smsPoTerminie } from "../../lib/tresci.mjs";
import { formatujZl } from "../../lib/wycena.mjs";

const NAGLOWKI = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
function json(d, kod) { return new Response(JSON.stringify(d), { status: kod || 200, headers: NAGLOWKI }); }

export default async (req) => {
  if (req.method !== "POST") return json({ blad: "Ten adres przyjmuje wyłącznie POST." }, 405);
  let body = null;
  try { body = await req.json(); } catch (e) { body = null; }
  if (!body || typeof body !== "object") return json({ blad: "Puste żądanie." }, 400);

  const stan = odszyfruj(body.token);
  if (!stan || !stan.kontakt || !stan.wycena) return json({ blad: "Nie znaleźliśmy tej konfiguracji. Otwórz link z maila jeszcze raz." }, 404);

  const t = sprawdzTermin(body.termin);
  if (!t.ok) return json({ blad: t.blad }, 400);

  const braki = [];
  if (hubspotSkonfigurowany() && stan.hs) {
    const notatka = "KLIENT PROSI O DOKLADNA WYCENE I TELEFON\n  Termin: " + t.opis + "\n  Konfiguracja: " + stan.id
      + "\n  Widelki: " + formatujZl(stan.wycena.od) + " - " + formatujZl(stan.wycena.do) + "\n  Telefon: " + stan.kontakt.telefon;
    if (stan.hs.d) { if (!(await notatkaHubspot("deal", stan.hs.d, notatka))) braki.push("notatka na transakcji"); }
    else if (stan.hs.c) { if (!(await notatkaHubspot("contact", stan.hs.c, notatka))) braki.push("notatka na kontakcie"); }
    if (stan.hs.c) {
      if (!(await zmienKontakt(stan.hs.c, { dewax_nastepny_krok: "Telefon do klienta: " + t.opis, dewax_data_nastepnego_kontaktu: t.data }))) {
        braki.push("następny krok na kontakcie");
      }
    }
  } else {
    braki.push("HubSpot nieskonfigurowany albo brak identyfikatorów");
  }

  const m = mailTermin(stan, t.opis);
  if (braki.length) m.html += "<p><b>Braki przy zapisie:</b> " + braki.join(", ") + "</p>";
  const r1 = await wyslijMail(m);
  if (!r1.ok) braki.push("mail do biura: " + r1.blad);

  const r2 = await wyslijSms({
    tresc: smsPoTerminie(stan, t.opis), imie: stan.kontakt.imie, telefon: stan.kontakt.telefon,
    godzina: t.opis, widelki: formatujZl(stan.wycena.od) + " - " + formatujZl(stan.wycena.do), dealId: (stan.hs && stan.hs.d) || "",
  });
  if (!r2.ok) braki.push("SMS: " + r2.blad);

  console.log(JSON.stringify({ funkcja: "termin", czas: new Date().toISOString(), id: stan.id, dealId: stan.hs && stan.hs.d, termin: t.opis, braki }));
  return json({ ok: true, termin: t.opis }, 200);
};

export const config = { path: "/api/termin" };
