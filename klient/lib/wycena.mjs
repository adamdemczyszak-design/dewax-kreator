/* =============================================================================
 * DEWAX - konfigurator kliencki: widełki cenowe
 * =============================================================================
 * Liczby i logika są przeniesione z kreatora zespołowego (index.html w katalogu
 * głównym repozytorium), żeby widełki pokazywane klientowi zgadzały się z tym,
 * co potem policzy handlowiec:
 *
 *   - katalog pomp Thermokrafft TK R290: `catalog` (moc i COP w punkcie B0/W35,
 *     cena netto),
 *   - wskaźniki zapotrzebowania W/m2: lista `#insulation`,
 *   - dobór dolnego źródła: `dxDzSizing`, `DZ_SIZING`, `DZ_TECH`, `DZ_PRICES`,
 *     `COLLECTOR_SPACING`, wskaźniki gruntu `dxSoilRates` (wariant „ryczałt"),
 *   - pozycje domyślne kosztorysu: `extrasItems` z `auto:true`
 *     (zasobnik CWU SWATT 200L i montaż kotłowni),
 *   - VAT 8% liczony od każdej pozycji osobno, jak w `renderCostTable`.
 *
 * Ten plik działa wyłącznie po stronie serwera (funkcja Netlify). Ceny
 * jednostkowe nie trafiają do przeglądarki klienta; klient dostaje tylko
 * gotowe widełki.
 *
 * Widełki „od-do": „od" to dobór dla gruntu ryczałtowego (to samo, co domyślnie
 * liczy kreator zespołowy), „do" to ten sam dobór dla gruntu słabszego
 * (ZALOZENIA.gruntSlabszy). Górna granica jest założeniem tego konfiguratora,
 * nie danymi z pomiaru - patrz raport wdrożenia.
 * ========================================================================== */

export const WERSJA_CENNIKA = "kreator 2026-09-10";

export const POMPY = [
  { id: "r290_g2s", nazwa: "Thermokrafft TK-G2S", zakres: "2-11 kW", moc: 7.74,  cop: 4.57, cenaNetto: 23977.61 },
  { id: "r290_g3s", nazwa: "Thermokrafft TK-G3S", zakres: "4-13 kW", moc: 9.15,  cop: 4.80, cenaNetto: 26157.46 },
  { id: "r290_g5s", nazwa: "Thermokrafft TK-G5S", zakres: "6-18 kW", moc: 12.67, cop: 4.75, cenaNetto: 27974.93 },
  { id: "r290_g6s", nazwa: "Thermokrafft TK-G6S", zakres: "10-23 kW", moc: 16.21, cop: 4.67, cenaNetto: 30759.16 },
];

/* Stan budynku -> wskaźnik zapotrzebowania W/m2 (lista `#insulation` kreatora). */
export const STAN_BUDYNKU = {
  nowy:      { wm2: 38,  opis: "Nowy dom albo w budowie (WT 2021)" },
  ocieplony: { wm2: 51,  opis: "Dom z lat 2010-2020, ocieplony" },
  starszy:   { wm2: 65,  opis: "Starszy dom po ociepleniu" },
  bez:       { wm2: 137, opis: "Dom bez ocieplenia" },
};

export const OGRZEWANIE = {
  podlogowe: "ogrzewanie podłogowe",
  grzejniki: "grzejniki",
  mieszane:  "podłogówka i grzejniki",
};

/* Dolne źródło: trzy warianty, które klient sam wybiera. */
export const DOLNE_ZRODLO = {
  pionowe: { nazwa: "Odwierty pionowe", tech: "odwiert" },
  koszowe: { nazwa: "Sondy spiralne HELIX", tech: "spirale" },
  poziome: { nazwa: "Kolektor poziomy", tech: "poziomy" },
};

const DZ_TECH = {
  odwiert: { copFactor: 1.00 },
  spirale: { copFactor: 0.92 },
  poziomy: { copFactor: 0.90 },
};

const DZ_SIZING = { pumpShare: 0.90, PUMP_FOLLOW_CAP: 1.15, GROUND_UNCERTAINTY: 1.15 };
const COLLECTOR_SPACING = 0.8;
const MAX_OTWOR = 100;   // m na jeden otwór (limit wiertnicy, jak w kalkulatorze publicznym)

export const CENY = {
  odwiertMb: 140,   // zł netto / mb odwiertu pionowego
  sondaSzt: 2500,   // zł netto / szt. sondy HELIX
  kolektorMb: 40,   // zł netto / mb rury kolektora
  montaz: 6000,     // zł netto, montaż kotłowni (pozycja domyślna kreatora)
  zasobnikCwu: 2600,// zł netto, zasobnik CWU SWATT 200L (pozycja domyślna kreatora)
  vat: 8,           // osoba fizyczna
};

export const ZALOZENIA = {
  // Grunt ryczałtowy: to, co kreator zespołowy liczy domyślnie.
  gruntRyczalt: { wm: 43.3, wm2: 20, eff: 0.70 },
  // Grunt słabszy: górna granica widełek. Założenie konfiguratora.
  gruntSlabszy: { wm: 30, wm2: 14, eff: 0.50 },
};

function brutto(netto) {
  const n = Math.round(Number(netto) || 0);
  return n + Math.round(n * CENY.vat / 100);
}

function zaokraglWDol(x)  { return Math.floor(x / 1000) * 1000; }
function zaokraglWGore(x) { return Math.ceil(x / 1000) * 1000; }

export function mocProjektowa(m2, stan) {
  const s = STAN_BUDYNKU[stan];
  if (!s) throw new Error("Nieznany stan budynku: " + stan);
  return (Number(m2) * s.wm2) / 1000;
}

/* Pompa polecana: najmniejsza, której moc B0/W35 pokrywa zapotrzebowanie
   (dokładnie tak filtruje `renderDevices` w kreatorze). Powyżej największej
   pompy dobór wymaga kaskady i oględzin. */
export function pompaPolecana(pDesign) {
  for (const p of POMPY) if (p.moc >= pDesign) return p;
  return null;
}

/* Port `dxDzSizing` dla jednej technologii i jednego gruntu. */
function dolneZrodlo(pDesign, pompa, dz, grunt) {
  const T = DZ_TECH[DOLNE_ZRODLO[dz].tech];
  const pk = pompa.moc;
  const pHeatBase = Math.max(pDesign, Math.min(pk * DZ_SIZING.pumpShare, pDesign * DZ_SIZING.PUMP_FOLLOW_CAP));
  const copT = Math.max(pompa.cop * T.copFactor, 1.5);
  const reqZ = pHeatBase * (copT - 1) / copT * DZ_SIZING.GROUND_UNCERTAINTY;   // kW z gruntu

  if (dz === "pionowe") {
    const mb = Math.ceil(((reqZ * 1000) / grunt.wm) / 10) * 10;
    const otwory = Math.max(1, Math.ceil(mb / MAX_OTWOR));
    return { ilosc: mb, jednostka: "m odwiertu", otwory, netto: mb * CENY.odwiertMb };
  }
  if (dz === "koszowe") {
    let szt = Math.ceil(reqZ / grunt.eff);
    if (szt % 2 !== 0) szt++;
    return { ilosc: szt, jednostka: "sond HELIX", netto: szt * CENY.sondaSzt };
  }
  const m2 = Math.ceil((reqZ * 1000) / grunt.wm2);
  const mb = Math.ceil((m2 / COLLECTOR_SPACING) / 10) * 10;
  return { ilosc: mb, jednostka: "m rury kolektora", powierzchnia: m2, netto: mb * CENY.kolektorMb };
}

/**
 * Główna funkcja. Wejście: { m2, stan, ogrzewanie, pompa, dz }.
 * Wyjście: widełki brutto od-do oraz rozbicie potrzebne do maila i notatki.
 */
export function policzWidelki(k) {
  const m2 = Number(k.m2);
  if (!isFinite(m2) || m2 < 30 || m2 > 1000) throw new Error("Powierzchnia poza zakresem.");
  if (!OGRZEWANIE[k.ogrzewanie]) throw new Error("Nieznany rodzaj ogrzewania.");
  if (!DOLNE_ZRODLO[k.dz]) throw new Error("Nieznany wariant dolnego źródła.");

  const pDesign = mocProjektowa(m2, k.stan);
  const polecana = pompaPolecana(pDesign);
  const pompa = POMPY.find((p) => p.id === k.pompa);
  if (!pompa) throw new Error("Nieznany model pompy.");

  const kaskada = !polecana;                       // ponad zakres jednej pompy
  const zaMala = !kaskada && pompa.moc < pDesign;  // klient wybrał słabszą niż zalecana
  const przewymiarowana = polecana && pompa.moc > polecana.moc * 1.35;

  const dzOd = dolneZrodlo(pDesign, pompa, k.dz, ZALOZENIA.gruntRyczalt);
  const dzDo = dolneZrodlo(pDesign, pompa, k.dz, ZALOZENIA.gruntSlabszy);

  const staleNetto = pompa.cenaNetto + CENY.montaz + CENY.zasobnikCwu;
  const staleBrutto = brutto(pompa.cenaNetto) + brutto(CENY.montaz) + brutto(CENY.zasobnikCwu);

  const odSurowe = staleBrutto + brutto(dzOd.netto);
  const doSurowe = staleBrutto + brutto(dzDo.netto);

  return {
    wersjaCennika: WERSJA_CENNIKA,
    pDesign: Math.round(pDesign * 10) / 10,
    pompa: { id: pompa.id, nazwa: pompa.nazwa, zakres: pompa.zakres, moc: pompa.moc },
    polecana: polecana ? polecana.id : null,
    kaskada, zaMala, przewymiarowana,
    dz: { id: k.dz, nazwa: DOLNE_ZRODLO[k.dz].nazwa, od: dzOd, do: dzDo },
    czescStala: { netto: Math.round(staleNetto), brutto: staleBrutto,
      pozycje: ["pompa ciepła " + pompa.nazwa, "montaż kotłowni", "zasobnik ciepłej wody 200 l"] },
    dolneZrodlo: { od: brutto(dzOd.netto), do: brutto(dzDo.netto) },
    od: zaokraglWDol(odSurowe),
    do: zaokraglWGore(doSurowe),
    odSurowe, doSurowe,
    vat: CENY.vat,
  };
}

export function formatujZl(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " zł";
}
