/* =============================================================================
 * Przygotowanie publicznego konfiguratora do wydania
 * =============================================================================
 * Kopiuje do publiczny/core/ dokladnie dwa pliki: rdzen cenowy i cennik
 * PUBLICZNY. Prawdziwego cennika nie kopiuje i nie moze skopiowac - lista
 * jest zamknieta, a nie "wszystko z core poza...".
 *
 * Netlify: build command `node publiczny/przygotuj.js`, publish `publiczny`.
 *
 * Skrypt sprawdza tez na koniec, czy w katalogu wydania nie ma niczego
 * z prawdziwego cennika. Wyciek cen zakupu przez pomylke przy wdrozeniu
 * jest dokladnie tym rodzajem bledu, ktorego nikt nie zauwazy.
 * ========================================================================== */

const fs = require("fs");
const path = require("path");

const KORZEN = path.join(__dirname, "..");
const ZRODLO = path.join(KORZEN, "core");
const CEL = path.join(__dirname, "core");

const DO_SKOPIOWANIA = ["dewax-core.js", "cennik-publiczny.json"];

fs.mkdirSync(CEL, { recursive: true });

DO_SKOPIOWANIA.forEach(function (plik) {
  fs.copyFileSync(path.join(ZRODLO, plik), path.join(CEL, plik));
  console.log("skopiowano core/" + plik);
});

/* --- Kontrola: nic z prawdziwego cennika w katalogu wydania ---------------
   Szukamy wylacznie liczb, ktore NIE MOGA znalezc sie na stronie przypadkiem:
   cen urzadzen (piecio- i szesciocyfrowe, czesto z groszami) oraz nazw marek.
   Malych okraglych kwot - 300, 800, 1200 - nie sprawdzamy tutaj, bo te same
   liczby to metry, piksele i milisekundy; ich pilnuje core/test-rozdzielnosci.mjs,
   ktory porownuje pola po nazwach, a nie po samej wartosci. */
const prawdziwy = JSON.parse(fs.readFileSync(path.join(ZRODLO, "cennik.json"), "utf8"));
const stawki = new Set();
function dodajJesliCharakterystyczna(v) {
  if (typeof v !== "number" || !isFinite(v)) return;
  if (v >= 10000 || Math.round(v) !== v) stawki.add(v);
}
Object.values(prawdziwy.dolneZrodlo.ceny).forEach(dodajJesliCharakterystyczna);
prawdziwy.urzadzenia.forEach(function (u) {
  dodajJesliCharakterystyczna(u.price);
  dodajJesliCharakterystyczna(Math.round(u.price));
});
prawdziwy.osprzet.forEach(function (p) {
  dodajJesliCharakterystyczna(p.defaultPrice);
  (p.variants || []).forEach(function (w) { dodajJesliCharakterystyczna(w.price); });
});

function pliki(katalog) {
  return fs.readdirSync(katalog, { withFileTypes: true }).flatMap(function (e) {
    const p = path.join(katalog, e.name);
    return e.isDirectory() ? pliki(p) : [p];
  });
}

const podejrzane = [];
pliki(__dirname).forEach(function (p) {
  if (!/\.(html|js|json|css)$/i.test(p)) return;
  if (path.basename(p) === "przygotuj.js") return;
  const tresc = fs.readFileSync(p, "utf8");
  stawki.forEach(function (v) {
    if (new RegExp("\\b" + v + "\\b").test(tresc)) {
      podejrzane.push(path.relative(KORZEN, p) + " zawiera " + v);
    }
  });
  if (/thermokrafft|buderus/i.test(tresc)) {
    podejrzane.push(path.relative(KORZEN, p) + " wymienia marke urzadzenia");
  }
});

if (podejrzane.length) {
  console.error("\nWYDANIE ZATRZYMANE. W katalogu publicznym znalazly sie dane z cennika zespolu:");
  podejrzane.forEach(function (s) { console.error("  " + s); });
  process.exit(1);
}

console.log("Kontrola przeszla: w katalogu publicznym nie ma stawek ani marek z cennika zespolu.");
