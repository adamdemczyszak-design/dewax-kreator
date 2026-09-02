/* =============================================================================
 * Jednorazowy ekstraktor: index.html -> core/cennik.json
 * =============================================================================
 * Nie przepisuje liczb recznie. Bierze dokladnie te bloki, ktore dzis liczy
 * kreator, wykonuje je i zapisuje wynik jako dane. Dzieki temu cennik.json
 * jest z definicji identyczny z tym, co bylo w kodzie - a nie "przepisany
 * uwaznie".
 *
 * Zdjecia urzadzen (pole img, base64, ~840 KB) zostaja w index.html.
 * Cennik ma byc plikiem danych, nie albumem.
 *
 * Uruchomienie:  node core/wyciagnij-cennik.js
 * ========================================================================== */

const fs = require("fs");
const path = require("path");

const HTML = path.join(__dirname, "..", "index.html");
const WYNIK = path.join(__dirname, "cennik.json");

const linie = fs.readFileSync(HTML, "utf8").split("\n");

/** Wycina zakres linii (numeracja jak w edytorze, od 1, oba konce wlacznie). */
function blok(od, do_, kotwica) {
  const tekst = linie.slice(od - 1, do_).join("\n");
  if (kotwica && tekst.indexOf(kotwica) < 0) {
    throw new Error("Blok " + od + "-" + do_ + " nie zawiera kotwicy: " + kotwica);
  }
  return tekst;
}

const zrodlo = [
  blok(1613, 1647, "const POBE"),          // POBE + buildScopTable
  blok(1669, 1861, "const catalog"),
  blok(1862, 1867, "const cwuCatalog"),
  blok(2264, 2270, "const DZ_PRICES"),
  blok(2409, 2421, "const DZ_SIZING"),
  blok(2429, 2429, "COLLECTOR_SPACING"),
  blok(2456, 2461, "const DZ_TECH"),
  blok(2464, 2465, "const DZ_TECH_OF"),
  blok(2977, 3009, "const extrasItems"),
  "return { POBE, catalog, cwuCatalog, DZ_PRICES, DZ_SIZING, COLLECTOR_SPACING, DZ_TECH, DZ_TECH_OF, extrasItems };",
].join("\n");

// window jest w tych blokach uzywane tylko do eksportu na globalny obiekt.
const window = {};
const dane = new Function("window", zrodlo)(window);

/* --- Zdjecia zostaja w index.html ---------------------------------------- */
const urzadzenia = dane.catalog.map(function (u) {
  const kopia = Object.assign({}, u);
  delete kopia.img;
  return kopia;
});

const cennik = {
  wersja: "2026.09.1",
  data: "2026-09-02",
  zrodlo: "wyciagniete z dewax-kreator/index.html, katalog marzec 2026, ceny netto PLN",
  uwaga: "Prawdziwy cennik. Nigdy nie trafia na strone publiczna - tam idzie cennik-publiczny.json.",

  urzadzenia: urzadzenia,
  zasobnikiCwu: dane.cwuCatalog,
  osprzet: dane.extrasItems,

  dolneZrodlo: {
    ceny: dane.DZ_PRICES,
    sizing: dane.DZ_SIZING,
    rozstawKolektora: dane.COLLECTOR_SPACING,
    technologie: dane.DZ_TECH,
    technologiaDla: dane.DZ_TECH_OF,
    // Ryczalt DEWAX, gdy handlowiec nie wybral klasy gruntu.
    gruntDomyslny: { wm2: 20, wm: 43.3, eff: 0.70 },
  },

  energia: dane.POBE,

  vat: { osobaFizyczna: 8, firma: 23 },
};

fs.writeFileSync(WYNIK, JSON.stringify(cennik, null, 2), "utf8");

/* --- Ta sama tresc jako skrypt dla przegladarki --------------------------
   Kreator to jeden plik bez budowania, wiec nie moze poczekac na fetch
   JSON-a - inline'owy kod ponizej rusza natychmiast. Ten sam generator
   wypuszcza obie postaci, wiec nie ma mowy o rozjezdzie miedzy nimi. */
fs.writeFileSync(
  path.join(__dirname, "cennik.js"),
  "/* PLIK GENEROWANY przez core/wyciagnij-cennik.js. Nie edytowac recznie.\n"
  + "   Zrodlem prawdy jest cennik.json; ten plik to ta sama tresc dla przegladarki. */\n"
  + "window.DEWAX_CENNIK = " + JSON.stringify(cennik, null, 2) + ";\n",
  "utf8",
);

/* --- Zdjecia osobno ------------------------------------------------------
   840 KB base64 w jednym pliku z logika sprawialo, ze kazda zmiana wzoru
   ciagnela za soba megabajt diffu. Zdjecia zmieniaja sie raz na rok. */
const zdjecia = {};
dane.catalog.forEach(function (u) { if (u.img) zdjecia[u.id] = u.img; });
fs.writeFileSync(
  path.join(__dirname, "zdjecia-urzadzen.js"),
  "/* PLIK GENEROWANY przez core/wyciagnij-cennik.js. Nie edytowac recznie.\n"
  + "   Zdjecia urzadzen, wyniesione z index.html. Nie maja wplywu na rachunek. */\n"
  + "window.DEWAX_ZDJECIA = " + JSON.stringify(zdjecia) + ";\n",
  "utf8",
);

console.log("Zapisano " + path.relative(process.cwd(), WYNIK));
console.log("Zapisano core/cennik.js i core/zdjecia-urzadzen.js");
console.log("  zdjec: " + Object.keys(zdjecia).length);
console.log("  urzadzen:      " + cennik.urzadzenia.length);
console.log("  zasobnikow:    " + cennik.zasobnikiCwu.length);
console.log("  pozycji osprzetu: " + cennik.osprzet.length);
console.log("  rozmiar:       " + Math.round(fs.statSync(WYNIK).size / 1024) + " KB");
