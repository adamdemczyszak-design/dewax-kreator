/* =============================================================================
 * Jednorazowe zamrozenie: stary silnik kreatora -> core/_odniesienie-stary.js
 * =============================================================================
 * Test zgodnosci porownuje nowy rdzen ze starym kodem. Stary kod za chwile
 * zniknie z index.html, bo zastapi go wywolanie rdzenia - a wtedy nie byloby
 * z czym porownywac.
 *
 * Ten skrypt wycina stary silnik z index.html w postaci, w jakiej dzialal
 * 02.09.2026, i zapisuje go jako plik odniesienia. Od tej chwili plik jest
 * ZAMROZONY: nie poprawiamy go, nie porzadkujemy, nie aktualizujemy cen.
 * Jego jedyna rola to odpowiadac na pytanie "czy nowy kod liczy tak samo,
 * jak liczyl kreator, ktorym wystawiono dotychczasowe oferty".
 *
 * Uruchamiany raz. Zostawiony w repozytorium, zeby bylo widac, skad wzielo
 * sie odniesienie.
 * ========================================================================== */

const fs = require("fs");
const path = require("path");

const HTML = path.join(__dirname, "..", "index.html");
const WYNIK = path.join(__dirname, "_odniesienie-stary.js");

const linie = fs.readFileSync(HTML, "utf8").split("\n");
function blok(od, do_, kotwica) {
  const t = linie.slice(od - 1, do_).join("\n");
  if (kotwica && t.indexOf(kotwica) < 0) throw new Error("Blok " + od + "-" + do_ + " bez kotwicy: " + kotwica);
  return t;
}

const bloki = [
  blok(1613, 1647, "const POBE"),
  blok(1669, 1861, "const catalog"),
  blok(2264, 2271, "const DZ_PRICES"),
  blok(2273, 2274, "dzOverride"),
  blok(2279, 2284, "DX_FLAT_FEE_DEFAULT"),
  blok(2309, 2333, "window.dxPointKw"),
  blok(2335, 2349, "window.dxSpecAt"),
  blok(2350, 2384, "window.dxSizingParams"),
  blok(2390, 2405, "window.dxSoilRates"),
  blok(2409, 2422, "const DZ_SIZING"),
  blok(2429, 2430, "COLLECTOR_SPACING"),
  blok(2456, 2466, "const DZ_TECH"),
  blok(2498, 2503, "window.dxPBase"),
  blok(2505, 2569, "window.dxDzSizing"),
  blok(2685, 2685, "function getPDesign"),
  blok(2692, 2760, "function dxWorkPoint"),
  blok(2977, 3009, "const extrasItems"),
].join("\n");

// Zdjecia base64 zajmuja tu 840 KB i nie maja zadnego wplywu na rachunek.
const bezZdjec = bloki.replace(/img:\s*"data:image\/[^"]*",?\s*/g, "");

const naglowek = `/* =============================================================================
 * ODNIESIENIE - stary silnik cenowy kreatora, stan z 02.09.2026
 * =============================================================================
 * PLIK ZAMROZONY. Nie poprawiac, nie porzadkowac, nie aktualizowac cen.
 *
 * To jest kod, ktorym wystawiono dotychczasowe oferty, wyciety z index.html
 * przez core/zamroz-odniesienie.js. Sluzy wylacznie testowi zgodnosci:
 * core/test-zgodnosc.mjs sprawdza, czy nowy rdzen liczy identycznie.
 *
 * Zdjecia urzadzen (base64) zostaly usuniete - nie wchodza do rachunku.
 *
 * Gdy ceny w cenniku sie zmienia, ten plik zostaje ze starymi. To celowe:
 * test zgodnosci uruchamia sie wtedy z cennikiem z tej samej daty
 * (core/cennik-odniesienie.json), a nie z biezacym.
 * ========================================================================== */

/* eslint-disable */
module.exports = function zbudujStarySilnik(window, document) {
  var building = null, selectedDz = 'pionowe', selectedModelObj = null;

`;

const stopka = `

  return {
    ustaw: function (s) {
      building = s.building;
      selectedDz = s.selectedDz;
      selectedModelObj = s.selectedModelObj;
      dzOverride = s.dzOverride;
    },
    getPDesign: getPDesign,
    DZ_PRICES: DZ_PRICES,
    extrasItems: extrasItems,
    catalog: catalog,
    dxSizingParams: window.dxSizingParams,
    dxDzSizing: window.dxDzSizing,
    dxFlatFee: window.dxFlatFee,
  };
};
`;

fs.writeFileSync(WYNIK, naglowek + bezZdjec + stopka, "utf8");

// Cennik odniesienia: kopia biezacego, zamrozona razem z kodem.
fs.copyFileSync(path.join(__dirname, "cennik.json"), path.join(__dirname, "cennik-odniesienie.json"));

console.log("Zapisano " + path.relative(process.cwd(), WYNIK)
  + " (" + Math.round(fs.statSync(WYNIK).size / 1024) + " KB)");
console.log("Zapisano core/cennik-odniesienie.json");
