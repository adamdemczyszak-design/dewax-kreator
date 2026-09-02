/* =============================================================================
 * Jednorazowa operacja: index.html przestaje trzymac ceny, zaczyna czytac rdzen
 * =============================================================================
 * Wymienia w index.html osiem blokow danych na odwolania do window.DEWAX_CENNIK
 * i dokleja w naglowku trzy skrypty. Zdjecia urzadzen wedruja do osobnego pliku
 * i wracaja do katalogu przy starcie.
 *
 * Zamiany ida OD DOLU, zeby numery linii wyzej sie nie przesunely.
 *
 * Uruchamiany raz. Zostawiony w repozytorium, zeby bylo widac, co dokladnie
 * zostalo wymienione i na co.
 * ========================================================================== */

const fs = require("fs");
const path = require("path");

const HTML = path.join(__dirname, "..", "index.html");
let linie = fs.readFileSync(HTML, "utf8").split("\n");

function wymien(od, do_, kotwica, nowe) {
  const stare = linie.slice(od - 1, do_).join("\n");
  if (stare.indexOf(kotwica) < 0) {
    throw new Error("Blok " + od + "-" + do_ + " nie zawiera kotwicy: " + kotwica);
  }
  linie.splice(od - 1, do_ - od + 1, ...nowe);
}

const W = "        "; // wciecie jak w otaczajacym kodzie

/* --- Od dolu do gory ------------------------------------------------------ */

// extrasItems
wymien(2977, 3009, "const extrasItems", [
  W + "// Osprzet z cennika. Wczesniej 14 pozycji z cenami siedzialo tutaj -",
  W + "// druga kopia tych samych liczb, ktora trzeba bylo pamietac przy kazdej",
  W + "// aktualizacji cennika.",
  W + "const extrasItems = DEWAX_CENNIK.osprzet;",
]);

// DZ_TECH + DZ_TECH_OF (2456-2466, razem z window.dxTechOf w 2466)
wymien(2456, 2466, "const DZ_TECH", [
  W + "// Parametry technologii dolnego zrodla - z cennika. Opis, skad wziely sie",
  W + "// wspolczynniki copFactor i czego NIE wolno w nich ruszac bez danych",
  W + "// producenta, jest w core/cennik.json przy tych wartosciach.",
  W + "const DZ_TECH = DEWAX_CENNIK.dolneZrodlo.technologie;",
  W + "window.DZ_TECH = DZ_TECH;",
  W + "const DZ_TECH_OF = DEWAX_CENNIK.dolneZrodlo.technologiaDla;",
  W + "window.dxTechOf = function(dz){ return DZ_TECH_OF[dz] || 'odwiert'; };",
]);

// COLLECTOR_SPACING
wymien(2429, 2429, "COLLECTOR_SPACING", [
  W + "const COLLECTOR_SPACING = DEWAX_CENNIK.dolneZrodlo.rozstawKolektora;",
]);

// DZ_SIZING
wymien(2409, 2421, "const DZ_SIZING", [
  W + "// Parametry doboru mocy - z cennika. pumpShare, PUMP_FOLLOW_CAP",
  W + "// i GROUND_UNCERTAINTY razem z uzasadnieniem sa w core/cennik.json.",
  W + "const DZ_SIZING = DEWAX_CENNIK.dolneZrodlo.sizing;",
]);

// DZ_PRICES (2264-2270; linia 2271 to window.DZ_PRICES = DZ_PRICES - zostaje)
wymien(2264, 2270, "const DZ_PRICES", [
  W + "// Ceny jednostkowe dolnego zrodla - z cennika. To nadal jedyne miejsce",
  W + "// z tymi liczbami, tylko przenieslo sie o jeden plik dalej: teraz dzieli",
  W + "// je z konfiguratorem klienta i z kokpitem.",
  W + "const DZ_PRICES = DEWAX_CENNIK.dolneZrodlo.ceny;",
]);

// cwuCatalog
wymien(1862, 1867, "const cwuCatalog", [
  W + "const cwuCatalog = DEWAX_CENNIK.zasobnikiCwu;",
]);

// catalog
wymien(1669, 1861, "const catalog", [
  W + "// Katalog urzadzen z cennika, ze zdjeciami doklejonymi z osobnego pliku.",
  W + "// Zdjecia (840 KB base64) wyprowadzono z index.html: zmieniaja sie raz na",
  W + "// rok, a lezac tutaj sprawialy, ze kazda poprawka wzoru ciagnela za soba",
  W + "// megabajt roznicy nie do przeczytania.",
  W + "const catalog = DEWAX_CENNIK.urzadzenia.map(function(u){",
  W + "    var zdjecie = (window.DEWAX_ZDJECIA || {})[u.id];",
  W + "    return zdjecie ? Object.assign({}, u, { img: zdjecie }) : u;",
  W + "});",
]);

// POBE (+ buildScopTable)
wymien(1613, 1647, "const POBE", [
  W + "// Stale energetyczne i tablica SCOP - z cennika. Tablica jest tam juz",
  W + "// zbudowana (scopBase x dzScopFactor), wiec nie ma tu drugiego liczenia.",
  W + "const POBE = DEWAX_CENNIK.energia;",
]);

/* --- Skrypty w naglowku --------------------------------------------------- */
const iZnacznik = linie.findIndex(function (l) { return l.indexOf("<!-- DEWAX-KONFIG -->") >= 0; });
if (iZnacznik < 0) throw new Error("Brak znacznika DEWAX-KONFIG w naglowku");

linie.splice(iZnacznik + 1, 0,
  "    <!-- Wspolny rdzen cenowy. Katalog i ceny sa w cennik.js, zdjecia osobno,",
  "         logika w dewax-core.js. Ten sam rdzen liczy konfigurator klienta,",
  "         zeby klient nie zobaczyl innej kwoty niz handlowiec. -->",
  '    <script src="core/cennik.js"></script>',
  '    <script src="core/zdjecia-urzadzen.js"></script>',
  '    <script src="core/dewax-core.js"></script>',
  "    <script>",
  "      // Bez cennika kreator nie ma prawa ruszyc. Pusty katalog wygladalby",
  "      // jak awaria HubSpota, a jest awaria wdrozenia.",
  "      if (!window.DEWAX_CENNIK) {",
  "        document.addEventListener('DOMContentLoaded', function(){",
  "          document.body.innerHTML = '<div style=\"font:600 15px/1.6 system-ui;padding:40px;max-width:640px;margin:0 auto;color:#0f1a3e;\">'",
  "            + '<h1 style=\"font-size:20px;margin:0 0 10px;\">Kreator nie wczytal cennika</h1>'",
  "            + '<p>Plik <b>core/cennik.js</b> nie zostal wydany razem ze strona. '",
  "            + 'Bez niego katalog urzadzen i ceny sa puste, wiec kreator zatrzymuje sie tutaj '",
  "            + 'zamiast pokazywac oferte na zero zlotych.</p></div>';",
  "        });",
  "      } else {",
  "        window.DEWAX_CORE.zaladuj(window.DEWAX_CENNIK);",
  "      }",
  "    </script>",
);

fs.writeFileSync(HTML, linie.join("\n"), "utf8");
console.log("index.html podpiety pod rdzen. Linii: " + linie.length
  + ", rozmiar: " + Math.round(fs.statSync(HTML).size / 1024) + " KB");
