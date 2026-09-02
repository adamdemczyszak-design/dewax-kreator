/* =============================================================================
 * TEST ZGODNOSCI: stary kreator kontra nowy rdzen
 * =============================================================================
 * Uruchomienie:  node core/test-zgodnosc.mjs
 *
 * CO POROWNUJE
 *
 * Lewa strona to NIE jest przepisany rachunek. To sa dokladnie te funkcje,
 * ktore liczyly ceny w kreatorze przed refaktorem - zamrozone w pliku
 * core/_odniesienie-stary.js przez core/zamroz-odniesienie.js i wykonane
 * z atrapa DOM-u. Prawa strona to core/dewax-core.js.
 *
 * Jedyny fragment przepisany doslownie to trzydziesci linii z updateStep4Summary
 * liczacych sume i VAT - reszta tej funkcji to budowanie HTML-a, ktorego nie da
 * sie oddzielic od przegladarki. Te linie sa skopiowane znak w znak i oznaczone
 * ponizej.
 *
 * DLACZEGO KONFIGURACJE SA GENEROWANE, A NIE WZIETE Z HUBSPOTA
 *
 * Zadanie mowilo: dwadziescia zapisanych konfiguracji z HubSpota. Tych
 * konfiguracji tam nie ma. Kreator zapisuje do HubSpota `dealname` i `amount` -
 * czyli nazwe i kwote koncowa. Danych wejsciowych (metraz, grunt, model,
 * osprzet) nie zapisuje nigdy. Nie da sie wiec przeliczyc starym i nowym kodem
 * czegos, czego nikt nie zapisal.
 *
 * To jest dokladnie powod, dla ktorego w tym samym etapie powstaje snapshot
 * wyceny. Od jego wdrozenia ten test bedzie mogl czytac prawdziwe konfiguracje.
 * Do tego czasu porownanie idzie po macierzy pokrywajacej caly zakres, ktory
 * kreator potrafi wystawic - a to jest ostrzejsze niz dwadziescia przypadkow,
 * bo trafia takze w rogi, ktorych handlowiec nie wyklikal.
 * ========================================================================== */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/* ==========================================================================
   STARA STRONA - zamrozony silnik z core/_odniesienie-stary.js
   ========================================================================== */

/* --- Atrapa DOM. Kreator czyta z pol formularza; tu podstawiamy wartosci. -- */
const POLA = {};
const document = {
  getElementById(id) {
    if (!(id in POLA)) return null;
    const v = POLA[id];
    if (id === "dxSoil") {
      return { selectedOptions: [{ getAttribute: (a) => (v && v[a] !== undefined ? String(v[a]) : null) }] };
    }
    return { value: String(v) };
  },
};

const window = {};
const stary = require("../core/_odniesienie-stary.js")(window, document);

/**
 * Sume i VAT liczy w kreatorze updateStep4Summary. Ponizsze linie sa z niej
 * skopiowane znak w znak (index.html, linie 3167-3197) - reszta tej funkcji
 * buduje HTML i nie da sie jej uruchomic poza przegladarka.
 */
function staryRachunek(stan) {
  stary.ustaw(stan);
  const pDesign = stary.getPDesign();
  const p = window.dxSizingParams();
  const S = window.dxDzSizing(pDesign, p.cop, p.pumpKw, p.soilWm2, p.soilWm, p.copWater, p.pumpKwWater, p.soilEff);

  const DZ_PRICES = stary.DZ_PRICES;
  const selectedModelObj = stan.selectedModelObj;
  const selectedDz = stan.selectedDz;
  const vat = stan.vat;

  // ---- POCZATEK fragmentu skopiowanego z updateStep4Summary ----
  const pumpPrice = selectedModelObj ? selectedModelObj.price : 0;

  let dzCost = 0;
  if (selectedDz === "koszowe") {
    const k = S.kos;
    dzCost = k * DZ_PRICES.sondaSzt;
  } else if (selectedDz === "poziome") {
    const m = S.poz;
    dzCost = m * DZ_PRICES.kolektorMb;
  } else if (selectedDz === "kolektorinw") {
    dzCost = window.dxFlatFee();
  } else if (selectedDz === "wodawoda") {
    dzCost = DZ_PRICES.wodawoda;
  } else {
    const m = S.pio;
    dzCost = m * DZ_PRICES.odwiertMb;
  }

  const extrasBreakdown = [];
  stary.extrasItems.forEach((item) => {
    const s = stan.extrasState[item.id];
    if (s && s.checked) extrasBreakdown.push({ id: item.id, name: item.name, price: s.price });
  });

  const positions = [pumpPrice, dzCost].concat(extrasBreakdown.map((e) => e.price || 0));
  const totalNet = positions.reduce((a, b) => a + (b || 0), 0);
  const totalVat = positions.reduce((a, b) => a + Math.round((b || 0) * vat / 100), 0);
  const totalBrutto = totalNet + totalVat;
  // ---- KONIEC fragmentu skopiowanego ----

  return {
    pDesign, netto: totalNet, vat: totalVat, brutto: totalBrutto,
    dzCost, ilosc: S.pio, sondy: S.kos, kolektor: S.poz, cop: p.cop, pompaKw: p.pumpKw,
  };
}

/* ==========================================================================
   NOWA STRONA - rdzen
   ========================================================================== */

const core = require("../core/dewax-core.js");
const cennik = require("../core/cennik-odniesienie.json");
core.zaladuj(cennik);

/* ==========================================================================
   MACIERZ KONFIGURACJI
   ========================================================================== */

const modele = cennik.urzadzenia.filter((m) => m.brand === "dewax");
const grunty = [
  null,
  { "data-wm2": 10, "data-wm": 30.0, "data-eff": 0.50 },
  { "data-wm2": 24, "data-wm": 50.0, "data-eff": 0.85 },
  { "data-wm2": 32, "data-wm": 60.0, "data-eff": 1.00 },
];
const zrodla = ["pionowe", "koszowe", "poziome", "kolektorinw", "wodawoda"];
const odbiorniki = ["low", "high", "mixed"];

function osprzetLosowy(nasienie) {
  const stan = {};
  cennik.osprzet.forEach((poz, i) => {
    // Deterministycznie: co trzecia pozycja odznaczona, co piata z cena reczna.
    const wlaczona = ((i + nasienie) % 3) !== 0;
    const cena = ((i + nasienie) % 5 === 0)
      ? Math.round(poz.defaultPrice * 1.37) + 13
      : poz.defaultPrice;
    stan[poz.id] = { checked: wlaczona, price: cena };
  });
  return stan;
}

const przypadki = [];
let nasienie = 0;
for (const metraz of [80, 120, 160, 200, 240]) {
  for (const dz of zrodla) {
    for (const emit of odbiorniki) {
      for (const g of grunty) {
        nasienie++;
        const model = modele[nasienie % modele.length];
        przypadki.push({
          nazwa: metraz + " m2 / " + dz + " / " + emit + " / grunt " + (g ? g["data-wm2"] : "ryczalt") + " / " + model.id,
          metraz, dz, emit, grunt: g, model,
          ozc: (nasienie % 7 === 0) ? 11.5 : "",
          vat: (nasienie % 4 === 0) ? 23 : 8,
          nadpisania: (nasienie % 11 === 0) ? { koszowe: null, pionowe: 220, poziome: null } : { koszowe: null, pionowe: null, poziome: null },
          ryczalt: (nasienie % 9 === 0) ? 6400 : null,
          osprzet: osprzetLosowy(nasienie),
        });
      }
    }
  }
}

/* ==========================================================================
   POROWNANIE
   ========================================================================== */

let zgodne = 0;
const rozbieznosci = [];

for (const t of przypadki) {
  // --- stara strona ---
  POLA.dxOzc = t.ozc;
  POLA.dxSoil = t.grunt;
  if (!t.grunt) delete POLA.dxSoil;
  if (t.ryczalt) POLA["dz-kolektorinw-input"] = t.ryczalt; else delete POLA["dz-kolektorinw-input"];

  const staryWynik = staryRachunek({
    building: { area: t.metraz, heatLoss: 60, heatingType: t.emit },
    selectedDz: t.dz,
    selectedModelObj: t.model,
    dzOverride: t.nadpisania,
    extrasState: t.osprzet,
    vat: t.vat,
  });

  // --- nowa strona ---
  const nowyWynik = core.wycenaDokladna({
    budynek: { powierzchnia: t.metraz, wskaznikStrat: 60, ozc: t.ozc },
    odbiorniki: t.emit,
    dolneZrodlo: t.dz,
    grunt: t.grunt ? { wm2: t.grunt["data-wm2"], wm: t.grunt["data-wm"], eff: t.grunt["data-eff"] } : null,
    modelId: t.model.id,
    nadpisaniaIlosci: t.nadpisania,
    ryczaltKolektorInw: t.ryczalt,
    osprzet: t.osprzet,
    vat: t.vat,
  });

  const roznice = [];
  if (Math.abs(staryWynik.netto - nowyWynik.netto) > 0.0001) roznice.push("netto " + staryWynik.netto + " vs " + nowyWynik.netto);
  if (staryWynik.vat !== nowyWynik.vat) roznice.push("vat " + staryWynik.vat + " vs " + nowyWynik.vat);
  if (Math.abs(staryWynik.brutto - nowyWynik.brutto) > 0.0001) roznice.push("brutto " + staryWynik.brutto + " vs " + nowyWynik.brutto);
  if (Math.abs(staryWynik.pDesign - nowyWynik.dobor.pDesign) > 1e-9) roznice.push("pDesign " + staryWynik.pDesign + " vs " + nowyWynik.dobor.pDesign);
  if (staryWynik.ilosc !== nowyWynik.dobor.wymiary.odwiert) roznice.push("mb odwiertu " + staryWynik.ilosc + " vs " + nowyWynik.dobor.wymiary.odwiert);
  if (staryWynik.sondy !== nowyWynik.dobor.wymiary.sondy) roznice.push("sond " + staryWynik.sondy + " vs " + nowyWynik.dobor.wymiary.sondy);
  if (staryWynik.kolektor !== nowyWynik.dobor.wymiary.kolektor) roznice.push("mb kolektora " + staryWynik.kolektor + " vs " + nowyWynik.dobor.wymiary.kolektor);

  if (roznice.length) rozbieznosci.push({ przypadek: t.nazwa, roznice });
  else zgodne++;
}

console.log("Porownanie starego kreatora z rdzeniem\n");
console.log("Konfiguracji: " + przypadki.length);
console.log("Zgodnych co do zlotowki: " + zgodne);
console.log("Rozbieznych: " + rozbieznosci.length);

if (rozbieznosci.length) {
  console.log("");
  rozbieznosci.slice(0, 15).forEach((r) => {
    console.log("  " + r.przypadek);
    r.roznice.forEach((d) => console.log("      " + d));
  });
  if (rozbieznosci.length > 15) console.log("  ... i " + (rozbieznosci.length - 15) + " wiecej");
  process.exit(1);
}

console.log("\nWSZYSTKO ZGODNE - rdzen liczy identycznie jak kreator.");
