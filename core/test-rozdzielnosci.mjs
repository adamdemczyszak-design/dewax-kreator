/* =============================================================================
 * TEST ROZDZIELNOSCI CENNIKOW
 * =============================================================================
 * Uruchomienie:  node core/test-rozdzielnosci.mjs
 *
 * Pilnuje jednej rzeczy: cennik publiczny nie moze zawierac stawek z cennika
 * zespolu. Nie dlatego, ze ktos je celowo przepisze - tylko dlatego, ze przy
 * kolejnej aktualizacji cen ktos "dla porzadku" wyrowna jedna liczbe do drugiej
 * i od tej chwili publiczna strona bedzie podawac cene zakupu pompy.
 *
 * Drugie sprawdzenie: `widelkiPubliczne` musi policzyc wynik bez zaladowanego
 * cennika zespolu. Gdyby kiedykolwiek siegnela do prawdziwego, ten test padnie.
 * ========================================================================== */

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const cennik = require("../core/cennik.json");
const pub = require("../core/cennik-publiczny.json");

let bledy = 0;
function sprawdz(opis, warunek, szczegol) {
  console.log((warunek ? "  OK   " : "  BLAD ") + opis + (szczegol ? " -> " + szczegol : ""));
  if (!warunek) bledy++;
}

/* --- 1. Zadna stawka jednostkowa z prawdziwego cennika ------------------- */
const stawkiPrawdziwe = new Set();
Object.values(cennik.dolneZrodlo.ceny).forEach((v) => stawkiPrawdziwe.add(v));
cennik.urzadzenia.forEach((u) => { if (u.price) stawkiPrawdziwe.add(u.price); });
cennik.zasobnikiCwu.forEach((z) => { if (z.price) stawkiPrawdziwe.add(z.price); });
cennik.osprzet.forEach((p) => {
  if (p.defaultPrice) stawkiPrawdziwe.add(p.defaultPrice);
  (p.variants || []).forEach((w) => { if (w.price) stawkiPrawdziwe.add(w.price); });
});
// Zero i drobne kwoty ponizej stu zlotych nie sa stawka - to opcje "brak".
[...stawkiPrawdziwe].forEach((v) => { if (v < 100) stawkiPrawdziwe.delete(v); });

const liczbyPubliczne = [];
(function zbierz(w, sciezka) {
  if (typeof w === "number") { liczbyPubliczne.push({ v: w, sciezka }); return; }
  if (w && typeof w === "object") {
    Object.keys(w).forEach((k) => zbierz(w[k], sciezka ? sciezka + "." + k : k));
  }
})(pub, "");

console.log("Rozdzielnosc cennikow\n");
console.log("Stawek w cenniku zespolu: " + stawkiPrawdziwe.size);
console.log("Liczb w cenniku publicznym: " + liczbyPubliczne.length + "\n");

// Porownujemy tylko pola pieniezne. doM2 i mocKw to metry i kilowaty -
// zbieznosc "140 m2" z "140 zl/mb" nie jest wyciekiem stawki.
const POLA_PIENIEZNE = /(brutto|maks|dopłata|cena|kwota)$/i;
const kolizje = liczbyPubliczne.filter((l) =>
  l.v >= 100 && POLA_PIENIEZNE.test(l.sciezka.split(".").pop()) && stawkiPrawdziwe.has(l.v));
sprawdz(
  "cennik publiczny nie zawiera zadnej stawki z cennika zespolu",
  kolizje.length === 0,
  kolizje.length ? kolizje.map((k) => k.sciezka + " = " + k.v).join(", ") : null,
);

/* --- 2. Stawka odwiertu rozni sie od prawdziwej, takze po VAT ------------ */
const odwiertNetto = cennik.dolneZrodlo.ceny.odwiertMb;
const odwiertBrutto8 = Math.round(odwiertNetto * 1.08 * 100) / 100;
const odwiertBrutto23 = Math.round(odwiertNetto * 1.23 * 100) / 100;
const stawkiPubliczne = Object.values(pub.strefyGruntu).map((s) => s.stawkaMbBrutto);
sprawdz(
  "zadna publiczna stawka odwiertu nie jest prawdziwa stawka (netto ani brutto)",
  !stawkiPubliczne.some((s) => s === odwiertNetto
    || Math.abs(s - odwiertBrutto8) < 1 || Math.abs(s - odwiertBrutto23) < 1),
  "publiczne: " + stawkiPubliczne.join(", "),
);

/* --- 3. Cennik publiczny nie ma nazw urzadzen ani modeli ------------------ */
const tekstPubliczny = JSON.stringify(pub).toLowerCase();
const nazwyModeli = cennik.urzadzenia.map((u) => u.id);
const znalezione = nazwyModeli.filter((n) => tekstPubliczny.indexOf(n) >= 0);
sprawdz(
  "cennik publiczny nie wymienia zadnego modelu urzadzenia",
  znalezione.length === 0,
  znalezione.join(", "),
);
sprawdz(
  "cennik publiczny nie wymienia marek",
  ["thermokrafft", "buderus", "swatt", "weber"].every((m) => tekstPubliczny.indexOf(m) < 0),
  null,
);

/* --- 4. Widelki licza sie BEZ prawdziwego cennika ------------------------- */
// Osobna instancja rdzenia, zaladowana wylacznie cennikiem publicznym.
delete require.cache[require.resolve("../core/dewax-core.js")];
const core = require("../core/dewax-core.js");
core.zaladuj(null, pub);
let policzone = null, wyjatek = null;
try {
  policzone = core.widelkiPubliczne({ metraz: 160, budynek: "istniejacy", osoby: 4 }, "B");
} catch (e) { wyjatek = e.message; }
sprawdz(
  "widelkiPubliczne dzialaja bez zaladowanego cennika zespolu",
  !!policzone, wyjatek,
);

/* --- 5. Wycena dokladna NIE dziala bez prawdziwego cennika ---------------- */
let padlo = false;
try { core.wycenaDokladna({ budynek: { powierzchnia: 160, wskaznikStrat: 60 } }); }
catch (e) { padlo = true; }
sprawdz("wycenaDokladna odmawia pracy bez cennika zespolu", padlo, null);

/* --- 6. Wynik publiczny nie niesie zadnej prawdziwej stawki --------------- */
if (policzone) {
  const tekstWyniku = JSON.stringify(policzone);
  const wyciek = [...stawkiPrawdziwe].filter((v) => new RegExp("\\b" + v + "\\b").test(tekstWyniku));
  sprawdz(
    "odpowiedz dla klienta nie zawiera zadnej stawki z cennika zespolu",
    wyciek.length === 0, wyciek.join(", "),
  );
}

console.log("\n" + (bledy ? "SA BLEDY: " + bledy : "ROZDZIELNOSC ZACHOWANA"));
process.exit(bledy ? 1 : 0);
