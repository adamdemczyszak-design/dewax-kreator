/* =============================================================================
 * Treści: notatka do HubSpota, mail do biura, mail do klienta, SMS.
 * Jeden plik, żeby handlowiec i klient czytali te same liczby.
 * ========================================================================== */
import { STAN_BUDYNKU, OGRZEWANIE, formatujZl } from "./wycena.mjs";
import { ETYKIETY } from "./walidacja.mjs";

export function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[m]);
}

const FIRMA = "DEWAX Sp. z o.o., ul. Ostrowska 1, 63-330 Dobrzyca, NIP 6080071501, KRS 0000298299";

export function opisDolnegoZrodla(w) {
  const od = w.dz.od, doo = w.dz.do;
  if (w.dz.id === "pionowe") {
    return od.otwory === doo.otwory
      ? od.otwory + " odwiert" + (od.otwory > 1 ? "y" : "") + ", razem " + od.ilosc + "-" + doo.ilosc + " m"
      : od.otwory + "-" + doo.otwory + " odwierty, razem " + od.ilosc + "-" + doo.ilosc + " m";
  }
  if (w.dz.id === "koszowe") return od.ilosc + "-" + doo.ilosc + " sond HELIX";
  return od.ilosc + "-" + doo.ilosc + " m rury kolektora (ok. " + od.powierzchnia + "-" + doo.powierzchnia + " m2 działki)";
}

export function widelkiTekst(w) {
  return formatujZl(w.od).replace(" zł", "") + " - " + formatujZl(w.do);
}

/** Odpowiedzi klienta słowo w słowo. Wspólne dla notatki i maila do biura. */
export function podsumowanie(z, w, dodatki) {
  const k = z.konfiguracja, q = z.kwalifikacja, c = z.kontakt, p = z.pomiar || {};
  const l = [];
  l.push("ZGLOSZENIE Z KONFIGURATORA KLIENTA (pompy.dewax.pl)");
  l.push("Identyfikator: " + (dodatki && dodatki.id || "-"));
  l.push("Czas: " + new Date().toISOString());
  l.push("");
  l.push("DOM");
  l.push("  Powierzchnia ogrzewana: " + k.m2 + " m2");
  l.push("  Stan budynku: " + STAN_BUDYNKU[k.stan].opis + " (" + STAN_BUDYNKU[k.stan].wm2 + " W/m2)");
  l.push("  Ogrzewanie: " + OGRZEWANIE[k.ogrzewanie]);
  l.push("  Moc projektowa: " + String(w.pDesign).replace(".", ",") + " kW");
  l.push("");
  l.push("WYBOR KLIENTA");
  l.push("  Pompa: " + w.pompa.nazwa + " (" + w.pompa.zakres + ")" + (w.polecana === w.pompa.id ? " - zgodna z doborem" : w.kaskada ? " - UWAGA: zapotrzebowanie ponad zakres jednej pompy, kaskada" : w.zaMala ? " - UWAGA: klient wybral slabsza niz dobor" : w.przewymiarowana ? " - uwaga: przewymiarowana" : " - inna niz polecana (" + w.polecana + ")"));
  l.push("  Dolne zrodlo: " + w.dz.nazwa + ", " + opisDolnegoZrodla(w));
  l.push("");
  l.push("PYTANIA KWALIFIKACYJNE");
  l.push("  Miejsce na odwiert na dzialce: " + ETYKIETY.odwiert[q.odwiert]);
  l.push("  Termin realizacji: " + ETYKIETY.termin[q.termin]);
  l.push("  Kto decyduje o zakupie: " + ETYKIETY.decyzja[q.decyzja]);
  l.push("  Etap budowy: " + ETYKIETY.etap[q.etap]);
  l.push("");
  l.push("KONTAKT");
  l.push("  Imie i nazwisko: " + c.imie);
  l.push("  Telefon: " + c.telefon);
  l.push("  E-mail: " + c.email);
  l.push("  Adres inwestycji: " + c.adres);
  l.push("  Zgoda na kontakt: TAK, " + new Date().toISOString() + (dodatki && dodatki.ip ? ", IP " + dodatki.ip : ""));
  l.push("");
  l.push("WIDELKI POKAZANE KLIENTOWI (brutto, VAT " + w.vat + "%)");
  l.push("  Razem: " + widelkiTekst(w));
  l.push("  Czesc stala (pompa, montaz kotlowni, zasobnik CWU 200 l): " + formatujZl(w.czescStala.brutto));
  l.push("  Dolne zrodlo: " + formatujZl(w.dolneZrodlo.od) + " - " + formatujZl(w.dolneZrodlo.do));
  l.push("  Wersja cennika: " + w.wersjaCennika);
  l.push("");
  l.push("ZRODLO RUCHU");
  l.push("  utm_source: " + (p.utm_source || "-") + " | utm_medium: " + (p.utm_medium || "-") + " | utm_campaign: " + (p.utm_campaign || "-"));
  l.push("  utm_content: " + (p.utm_content || "-") + " | utm_term: " + (p.utm_term || "-") + " | fbclid: " + (p.fbclid ? "tak" : "-"));
  if (dodatki && dodatki.link) { l.push(""); l.push("Link powrotny klienta: " + dodatki.link); }
  return l.join("\n");
}

export function mailDoBiura(z, w, dodatki) {
  const c = z.kontakt;
  const tresc = podsumowanie(z, w, dodatki);
  return {
    to: process.env.ALERT_EMAIL || "biuro@dewax.pl",
    subject: "Konfigurator: " + c.imie + ", " + z.konfiguracja.m2 + " m2, " + widelkiTekst(w),
    html: '<pre style="font:13px/1.5 monospace;white-space:pre-wrap">' + esc(tresc) + "</pre>"
      + '<p>Telefon: <a href="tel:' + esc(c.telefon) + '">' + esc(c.telefon) + "</a></p>"
      + (dodatki && dodatki.hubspot ? "<p>HubSpot: " + esc(dodatki.hubspot) + "</p>" : ""),
    replyTo: c.email,
  };
}

export function mailDoKlienta(z, w, link) {
  const c = z.kontakt, k = z.konfiguracja;
  const imie = String(c.imie).trim().split(/\s+/)[0] || "";
  const html = [
    '<div style="font:15px/1.65 -apple-system,Segoe UI,Roboto,sans-serif;color:#1b2437;max-width:560px">',
    "<p>Dzień dobry" + (imie ? ", " + esc(imie) : "") + ",</p>",
    "<p>dla domu " + k.m2 + " m2 z pompą " + esc(w.pompa.nazwa) + " i dolnym źródłem „" + esc(w.dz.nazwa) + "” wyszło nam <b>" + esc(widelkiTekst(w)) + " brutto</b>.</p>",
    "<p>To są widełki, nie cena. Część za pompę, montaż kotłowni i zasobnik ciepłej wody jest przewidywalna: " + esc(formatujZl(w.czescStala.brutto)) + ". Dolne źródło zależy od gruntu pod działką: " + esc(formatujZl(w.dolneZrodlo.od)) + " - " + esc(formatujZl(w.dolneZrodlo.do)) + " (" + esc(opisDolnegoZrodla(w)) + "). Dokładną kwotę podajemy po rozmowie i sprawdzeniu geologii.</p>",
    link ? '<p><a href="' + esc(link) + '" style="display:inline-block;background:#2a2e78;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">Otwórz swoją konfigurację</a></p>'
         + '<p style="font-size:13px;color:#5b6577">Link otwiera zapisaną konfigurację bez ponownego wypełniania. Możesz z niego wybrać godzinę rozmowy, jeśli jeszcze tego nie zrobiłeś.</p>' : "",
    "<p>Zadzwonimy pod numer " + esc(c.telefon) + ". Jeśli wolisz wybrać godzinę, zrób to w konfiguratorze. Nasz numer: <a href=\"tel:+48627413227\">62 741 32 27</a>, e-mail <a href=\"mailto:biuro@dewax.pl\">biuro@dewax.pl</a>.</p>",
    '<p style="font-size:12px;color:#7a8395;margin-top:28px;border-top:1px solid #e3e7ef;padding-top:14px">Kalkulacja orientacyjna, ważna 30 dni. Nie stanowi oferty w rozumieniu art. 66 Kodeksu cywilnego. ' + FIRMA + ".</p>",
    "</div>",
  ].join("");
  return {
    to: c.email,
    subject: "Twoja konfiguracja: dom " + k.m2 + " m2, " + w.pompa.nazwa + ", " + widelkiTekst(w),
    html,
    replyTo: "biuro@dewax.pl",
  };
}

export function smsPoZgloszeniu(z, w) {
  const c = z.kontakt;
  return "Nowy lead z konfiguratora: " + c.imie + ", tel. " + c.telefon + ", " + z.konfiguracja.m2 + " m2, widelki " + widelkiTekst(w) + ". Godzina telefonu: jeszcze nie wybrana.";
}

export function smsPoTerminie(stan, terminOpis) {
  const c = stan.kontakt;
  return "Klient prosi o telefon: " + c.imie + ", tel. " + c.telefon + ", " + terminOpis + ". Widelki " + formatujZl(stan.wycena.od).replace(" zł", "") + " - " + formatujZl(stan.wycena.do) + ".";
}

export function mailTermin(stan, terminOpis) {
  const c = stan.kontakt;
  return {
    to: process.env.ALERT_EMAIL || "biuro@dewax.pl",
    subject: "Prosba o telefon: " + c.imie + ", " + terminOpis,
    html: "<p>" + esc(c.imie) + " (" + esc(c.telefon) + ", " + esc(c.email) + ") prosi o dokładną wycenę i telefon: <b>" + esc(terminOpis) + "</b>.</p>"
      + "<p>Adres inwestycji: " + esc(c.adres) + "<br>Widełki pokazane klientowi: " + esc(formatujZl(stan.wycena.od) + " - " + formatujZl(stan.wycena.do)) + "</p>"
      + (stan.hs && stan.hs.d ? "<p>Transakcja HubSpot: " + esc(stan.hs.d) + "</p>" : ""),
    replyTo: c.email,
  };
}
