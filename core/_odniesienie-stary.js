/* =============================================================================
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

        const POBE = {
            priceElec: 0.8901,  // zł/kWh brutto G12w (Średnia PL, II kw. 2026)
            priceGas: 0.3575,   // zł/kWh (gaz GZ kond.)
            pricePellet: 0.3652, // zł/kWh (pelet)
            priceCoal: 0.2179,  // zł/kWh (ekogroszek)
            effGas: 0.9122, effPellet: 0.84, effCoal: 0.64,
            effCO: 0.85,        // sprawność systemu CO (dystrybucja, bufor) wg POBE
            // CWU: l/os/dzień × ΔT(40K) × 1.163 Wh/(l·K) × 365 / 1000
            // prysznic: 35 l/os → 594.3 kWh/os/rok
            // wanna:    50 l/os → 849.0 kWh/os/rok
            cwuLitersPerPerson: { prysznic: 35, wanna: 50 },
            cwuKwhFactor: 0.04652,  // = ΔT 40 K × 1,163 Wh/(l·K) / 1000 → kWh na 1 litr/dobę (×365 dni = kWh/rok)
            cwuLossFactor: 1.15, // straty postoju zasobnika + dystrybucji CWU wg PN-EN 15316-3 (dom jednorodzinny, bez cyrkulacji)
            effCwuHP: 1.00,     // straty zasobnika ujete juz w cwuLossFactor i SCOP CWU — bez podwojnego dzielenia
            effCwuGas: 0.83,    // η_wh CWU kocioł gaz
            effCwuPellet: 0.78, // η_wh CWU kocioł pelet
            effCwuCoal: 0.60,   // η_wh CWU kocioł węgiel
            scopCwu: 3.70,      // SCOP CWU sezonowy solanka/woda (W50, sezonowa temp. solanki) — metodyka producencka
            // Baza SCOP wg POBE (solanka/woda) + korekta na typ dolnego źródła.
            // Im wyższa i stabilniejsza temperatura źródła, tym wyższy SCOP:
            // woda-woda > odwierty pionowe > sondy spiralne (kosze) > kolektor poziomy.
            scopBase: { low: 5.30, high: 4.15, mixed: 4.70, other: 4.15 },
            dzScopFactor: { 'pionowe': 1.00, 'koszowe': 0.98, 'poziome': 0.95, 'kolektorinw': 0.95, 'wodawoda': 1.10 },
            scop: {}
        };
        // Tabela SCOP budowana raz, z bazy POBE i współczynnika dolnego źródła
        (function buildScopTable(){
            Object.keys(POBE.dzScopFactor).forEach(function(dz){
                var f = POBE.dzScopFactor[dz];
                POBE.scop[dz] = {};
                Object.keys(POBE.scopBase).forEach(function(k){
                    POBE.scop[dz][k] = Math.round(POBE.scopBase[k] * f * 100) / 100;
                });
            });
        })();
        const catalog = [
            // ═══════════════════════════════════════════════════════
            // THERMOKRAFFT TK R290 — DC Inverter, R290, Panasonic, WiFi
            // Katalog Marzec 2026 · Ceny netto PLN
            // ═══════════════════════════════════════════════════════
            // pionowe_low  = W10 → W35 (ciepły grunt + podłogówka)
            // pionowe_high = W10 → W45 (ciepły grunt + grzejniki)
            // poziome_low  = B0 → W35 (zimny grunt + podłogówka)
            // poziome_high = B0 → W45 (zimny grunt + grzejniki)
            { id:'r290_g2s', brand:'dewax', name:"Thermokrafft TK-G2S (R290)", power:7.74, powerRange:"2–11", price:23977.61, nl:"NL-G2S/R290", voltage:"230 V",
              desc:"DC Inverter R290, WiFi · Sprężarka Panasonic R290 · 230 V · odpowiednik NL-G2S/R290",
              specs: {
                  W10W35: { kw:10.6, cop:5.72, pin:1.85 },
                  W10W45: { kw:9.04, cop:5.02, pin:1.8 },
                  B0W35:  { kw:7.74, cop:4.57, pin:1.69 },
                  cooling:{ kw:10.5, eer:5.76, pin:1.82 }
              }
            },
            { id:'r290_g3s', brand:'dewax', name:"Thermokrafft TK-G3S (R290)", power:9.15, powerRange:"4–13", price:26157.46, nl:"NL-G3S/R290", voltage:"230 V",
              desc:"DC Inverter R290, WiFi · Sprężarka Panasonic R290 · 230 V · odpowiednik NL-G3S/R290",
              specs: {
                  W10W35: { kw:12.5, cop:5.86, pin:2.13 },
                  W10W45: { kw:10.8, cop:4.69, pin:2.3 },
                  B0W35:  { kw:9.15, cop:4.8, pin:1.91 },
                  cooling:{ kw:12.4, eer:5.54, pin:2.34 }
              }
            },
            { id:'r290_g5s', brand:'dewax', name:"Thermokrafft TK-G5S (R290)", power:12.67, powerRange:"6–18", price:27974.93, nl:"NL-G5S/R290", voltage:"230 V / 400 V",
              desc:"DC Inverter R290, WiFi · Sprężarka Panasonic R290 · 230 V / 400 V · odpowiednik NL-G5S/R290",
              specs: {
                  W10W35: { kw:17.6, cop:6.08, pin:2.89 },
                  W10W45: { kw:15.2, cop:5.35, pin:2.84 },
                  B0W35:  { kw:12.67, cop:4.75, pin:2.67 },
                  cooling:{ kw:16.8, eer:5.93, pin:2.83 }
              }
            },
            { id:'r290_g6s', brand:'dewax', name:"Thermokrafft TK-G6S (R290)", power:16.21, powerRange:"10–23", price:30759.16, nl:"NL-G6S/R290", voltage:"230 V / 400 V",
              desc:"DC Inverter R290, WiFi · Sprężarka Panasonic R290 · 230 V / 400 V · odpowiednik NL-G6S/R290",
              specs: {
                  W10W35: { kw:22.7, cop:6.02, pin:3.77 },
                  W10W45: { kw:19.45, cop:5.19, pin:3.75 },
                  B0W35:  { kw:16.21, cop:4.67, pin:3.47 },
                  cooling:{ kw:21.5, eer:5.78, pin:3.72 }
              }
            },
            // ═══════════════════════════════════════════════════════
            // THERMOKRAFFT TKWD — DC Inverter, R32, Mitsubishi
            // Katalog Marzec 2026
            // ═══════════════════════════════════════════════════════
            
            { id:'tkwd_03dc', brand:'dewax_old', name:"Thermokrafft TKWD-03DC", power:11.0, price:21899,
              desc:"DC Inverter, R32, 220V · Mitsubishi · wbud. pompa + przepływomierz",
              specs: {
                  pionowe_low:  { kw:11.0, cop:5.21 },
                  pionowe_high: { kw:11.0, cop:5.21 },
                  poziome_low:  { kw:8.70, cop:4.55 },
                  cooling:      { kw:8.60, eer:4.22 }
              }
            },
            { id:'tkwd_04dc', brand:'dewax_old', name:"Thermokrafft TKWD-04DC", power:14.0, price:24891,
              desc:"DC Inverter, R32, 220V · Mitsubishi · wbud. pompa + przepływomierz",
              specs: {
                  pionowe_low:  { kw:14.0, cop:5.30 },
                  pionowe_high: { kw:14.0, cop:5.30 },
                  poziome_low:  { kw:11.40, cop:4.47 },
                  cooling:      { kw:11.90, eer:4.33 }
              }
            },
            { id:'tkwd_05dc', brand:'dewax_old', name:"Thermokrafft TKWD-05DC", power:18.0, price:29341,
              desc:"DC Inverter, R32, 380V · Mitsubishi · wbud. pompa + przepływomierz",
              specs: {
                  pionowe_low:  { kw:18.0, cop:5.30 },
                  pionowe_high: { kw:18.0, cop:5.30 },
                  poziome_low:  { kw:14.10, cop:4.34 },
                  cooling:      { kw:15.30, eer:4.40 }
              }
            },
            { id:'tkwd_06dc', brand:'dewax_old', name:"Thermokrafft TKWD-06DC", power:21.0, price:32738,
              desc:"DC Inverter, R32, 380V · Mitsubishi · wbud. pompa + przepływomierz",
              specs: {
                  pionowe_low:  { kw:21.0, cop:5.44 },
                  pionowe_high: { kw:21.0, cop:5.44 },
                  poziome_low:  { kw:16.20, cop:4.31 },
                  cooling:      { kw:17.00, eer:4.20 }
              }
            },
            // ═══════════════════════════════════════════════════════
            // THERMOKRAFFT TKW — ON/OFF, R32/R410A, Panasonic
            // Katalog Marzec 2026 · COP wg EN 14511 (15°C→55°C)
            // ═══════════════════════════════════════════════════════
            { id:'tkw_02_230', brand:'dewax_old', name:"Thermokrafft TKW-02 (230V)", power:7.0, price:10857,
              desc:"ON/OFF, R32, 230V · Panasonic · 38 dB",
              specs: {
                  pionowe_low:  { kw:7.0, cop:4.83 },
                  pionowe_high: { kw:7.0, cop:4.83 },
                  poziome_low:  { kw:5.6, cop:3.86 },
                  cooling:      { kw:6.0, eer:5.0 }
              }
            },
            { id:'tkw_03_230', brand:'dewax_old', name:"Thermokrafft TKW-03 (230V)", power:11.0, price:17505,
              desc:"ON/OFF, R32, 230V · Panasonic · 39 dB",
              specs: {
                  pionowe_low:  { kw:11.0, cop:4.88 },
                  pionowe_high: { kw:11.0, cop:4.88 },
                  poziome_low:  { kw:8.8, cop:3.90 },
                  cooling:      { kw:9.4, eer:4.94 }
              }
            },
            { id:'tkw_03_380', brand:'dewax_old', name:"Thermokrafft TKW-03 (380V)", power:11.0, price:19185,
              desc:"ON/OFF, R32, 400V/3~ · Panasonic · 39 dB",
              specs: {
                  pionowe_low:  { kw:11.0, cop:4.88 },
                  pionowe_high: { kw:11.0, cop:4.88 },
                  poziome_low:  { kw:8.8, cop:3.90 },
                  cooling:      { kw:9.4, eer:4.94 }
              }
            },
            { id:'tkw_04', brand:'dewax_old', name:"Thermokrafft TKW-04", power:15.0, price:20275,
              desc:"ON/OFF, R32, 400V/3~ · Panasonic · 40 dB",
              specs: {
                  pionowe_low:  { kw:15.0, cop:5.0 },
                  pionowe_high: { kw:15.0, cop:5.0 },
                  poziome_low:  { kw:12.0, cop:4.0 },
                  cooling:      { kw:12.0, eer:5.0 }
              }
            },
            { id:'tkw_05', brand:'dewax_old', name:"Thermokrafft TKW-05", power:18.0, price:22121,
              desc:"ON/OFF, R32, 400V/3~ · Panasonic · 41 dB",
              specs: {
                  pionowe_low:  { kw:18.0, cop:4.86 },
                  pionowe_high: { kw:18.0, cop:4.86 },
                  poziome_low:  { kw:14.4, cop:3.89 },
                  cooling:      { kw:15.0, eer:5.0 }
              }
            },
            { id:'tkw_06', brand:'dewax_old', name:"Thermokrafft TKW-06", power:23.0, price:23247,
              desc:"ON/OFF, R32, 400V/3~ · Panasonic · 42 dB",
              specs: {
                  pionowe_low:  { kw:23.0, cop:5.0 },
                  pionowe_high: { kw:23.0, cop:5.0 },
                  poziome_low:  { kw:18.4, cop:4.0 },
                  cooling:      { kw:18.0, eer:4.87 }
              }
            },
            { id:'tkw_08', brand:'dewax_old', name:"Thermokrafft TKW-08", power:29.0, price:33385,
              desc:"ON/OFF, R32, 400V/3~ · Panasonic · 42 dB",
              specs: {
                  pionowe_low:  { kw:29.0, cop:4.83 },
                  pionowe_high: { kw:29.0, cop:4.83 },
                  poziome_low:  { kw:23.2, cop:3.86 },
                  cooling:      { kw:24.0, eer:5.0 }
              }
            },
            { id:'tkw_10', brand:'dewax_old', name:"Thermokrafft TKW-10", power:38.0, price:36893,
              desc:"ON/OFF, R32, 400V/3~ · Panasonic · 42 dB",
              specs: {
                  pionowe_low:  { kw:38.0, cop:4.84 },
                  pionowe_high: { kw:38.0, cop:4.84 },
                  poziome_low:  { kw:30.4, cop:3.87 },
                  cooling:      { kw:30.0, eer:5.17 }
              }
            },
            { id:'tkw_12', brand:'dewax_old', name:"Thermokrafft TKW-12", power:45.0, price:37909,
              desc:"ON/OFF, R32, 400V/3~ · Panasonic · 42 dB",
              specs: {
                  pionowe_low:  { kw:45.0, cop:4.97 },
                  pionowe_high: { kw:45.0, cop:4.97 },
                  poziome_low:  { kw:36.0, cop:3.98 },
                  cooling:      { kw:36.0, eer:5.1 }
              }
            },
            // === BUDERUS Logatherm WSW196i.2 (Inverter, Titanium Design) z CWU 180L ===
            { id:'wsw196_6t',  brand:'buderus', name:"Buderus WSW196i.2-6 T180", power:5.8, price:56388, desc:"Inverter A+++, 28 dB(A), CWU 180L, szklany front" },
            { id:'wsw196_8t',  brand:'buderus', name:"Buderus WSW196i.2-8 T180", power:7.8, price:59892, desc:"Inverter A+++, 28 dB(A), CWU 180L, szklany front" },
            { id:'wsw196_12t', brand:'buderus', name:"Buderus WSW196i.2-12 T180", power:12.3, price:62017, desc:"Inverter A+++, 28 dB(A), CWU 180L, szklany front" },
            { id:'wsw196_16t', brand:'buderus', name:"Buderus WSW196i.2-16 T180", power:15.3, price:67113, desc:"Inverter A+++, 28 dB(A), CWU 180L, szklany front" },
            // === BUDERUS Logatherm WSW186 (Inverter, metalowy front) z CWU 180L ===
            { id:'wsw186_6t',  brand:'buderus', name:"Buderus WSW186-6 T180", power:5.8, price:54296, desc:"Inverter A+++, 28 dB(A), CWU 180L, metalowy front" },
            { id:'wsw186_16t', brand:'buderus', name:"Buderus WSW186-16 T180", power:15.3, price:64788, desc:"Inverter A+++, 28 dB(A), CWU 180L, metalowy front" },
            // === BUDERUS Logatherm WPS K-1 (z zasobnikiem CWU 185L inox) ===
            { id:'wpsk6',  brand:'buderus', name:"Buderus WPS 6K-1",  power:5.7,  price:42968, desc:"CWU 185L inox, grzałka 3/6/9 kW, 32 dB" },
            { id:'wpsk8',  brand:'buderus', name:"Buderus WPS 8K-1",  power:7.5,  price:44678, desc:"CWU 185L inox, grzałka 3/6/9 kW, 32 dB" },
            { id:'wpsk10', brand:'buderus', name:"Buderus WPS 10K-1", power:9.9,  price:46874, desc:"CWU 185L inox, grzałka 3/6/9 kW, 32 dB" },
            // === BUDERUS Logatherm WPS -1 (bez zasobnika) ===
            { id:'wps6',   brand:'buderus', name:"Buderus WPS 6-1",   power:5.7,  price:37273, desc:"Jednofunkcyjna, bez CWU" },
            { id:'wps10',  brand:'buderus', name:"Buderus WPS 10-1",  power:10.2, price:42546, desc:"Jednofunkcyjna, bez CWU" },
            { id:'wps17',  brand:'buderus', name:"Buderus WPS 17-1",  power:17.0, price:48664, desc:"Jednofunkcyjna, bez CWU" },
            // === BUDERUS Logatherm WPS HT (wysokotemperaturowe, tandem, kaskada do 5 szt.) ===
            { id:'wpsht22', brand:'buderus', name:"Buderus WPS22.2 HT", power:22.9, price:86877, desc:"Wysokotemp. do 68°C, tandem, kaskada do 5 szt." },
            { id:'wpsht48', brand:'buderus', name:"Buderus WPS48.2 HT", power:47.3, price:118956, desc:"Wysokotemp. do 68°C, tandem, kaskada do 5 szt." },
            { id:'wpsht54', brand:'buderus', name:"Buderus WPS54.2 HT", power:59.9, price:121362, desc:"Wysokotemp. do 68°C, tandem, kaskada do 5 szt." },
            { id:'wpsht80', brand:'buderus', name:"Buderus WPS80.2 HT", power:78.1, price:129382, desc:"Wysokotemp. do 68°C, tandem, kaskada do 5 szt." }
        ];
        const DZ_PRICES = {
            sondaSzt:    2500,   // zł netto / szt. sondy spiralnej HELIX
            odwiertMb:    140,   // zł netto / mb odwiertu pionowego
            kolektorMb:    40,   // zł netto / mb rury kolektora płaskiego
            wodawoda:    3800,   // zł netto — wymiennik pośredni, ryczałt
            kolektorInw: 5000    // zł netto — ryczałt, wykop po stronie Inwestora
        };
        window.DZ_PRICES = DZ_PRICES;
        // Ręczne nadpisania ilości dolnego źródła (null = auto)
        let dzOverride = { koszowe: null, pionowe: null, poziome: null };
        const DX_FLAT_FEE_DEFAULT = DZ_PRICES.kolektorInw;
        window.dxFlatFee = function(){
            var el = document.getElementById('dz-kolektorinw-input');
            var v = el ? parseFloat(String(el.value).replace(',', '.')) : NaN;
            return (v > 0) ? Math.round(v) : DX_FLAT_FEE_DEFAULT;
        };
        window.dxPointKw = function(m){
            try{
                if(!m) return 0;
                if(m._cascade && !(m._units && m._units.length) && m.specs && window.getDeviceSpecs){
                    var sp0 = window.getDeviceSpecs(m);
                    var nU = String(m.name||'').split('+').length;
                    if(sp0 && sp0.kw && nU > 1) return sp0.kw * nU;
                }
                if(m._cascade && m._units && m._units.length){
                    var sum = 0;
                    m._units.forEach(function(u){
                        var sp = (u.specs && window.getDeviceSpecs) ? window.getDeviceSpecs(u) : null;
                        sum += (sp && sp.kw) ? sp.kw : (Number(u.power) || 0);
                    });
                    return (sum > 0) ? sum : (Number(m.power) || 0);
                }
                var sp2 = (m.specs && window.getDeviceSpecs) ? window.getDeviceSpecs(m) : null;
                if(sp2 && sp2.kw) return sp2.kw;
                return Number(m.power) || 0;
            }catch(e){ return Number(m && m.power) || 0; }
        };
        // Odczyt danych producenta z KONKRETNEGO punktu pracy, niezależnie od tego,
        // która karta jest zaznaczona. getDeviceSpecs() zwraca punkt zależny od
        // selectedDz — dobre do opisu pompy, złe do doboru źródła, bo wtedy kliknięcie
        // innej karty przestawiałoby ilości na wszystkich pozostałych.
        window.dxSpecAt = function(m, point){
            if(!m || !point) return null;
            try{
                var units = (m._cascade && m._units && m._units.length) ? m._units : [m];
                var totKw = 0, wCop = 0;
                for(var i = 0; i < units.length; i++){
                    var s = units[i] && units[i].specs && units[i].specs[point];
                    if(!s || !(s.kw > 0)) return null;   // brak danych choćby dla jednej jednostki
                    totKw += s.kw;
                    wCop  += s.kw * (Number(s.cop) || 0);
                }
                if(!(totKw > 0)) return null;
                return { kw: totKw, cop: wCop / totKw };
            }catch(e){ return null; }
        };
        window.dxSizingParams = function(){
            var m = null;
            try{ m = (typeof selectedModelObj !== 'undefined' ? selectedModelObj : null); }catch(e){}
            var emit = 'low';
            try{ emit = (building && building.heatingType) || 'low'; }catch(e){}

            // KOTWICA doboru: opublikowany punkt solankowy B0/W35. Od niego DZ_TECH
            // liczy pozostałe technologie. Bez danych producenta — baza POBE bez
            // dzScopFactor, bo korektę na technologię robi już copFactor (inaczej
            // technologia byłaby korygowana dwa razy).
            var brine = window.dxSpecAt(m, 'B0W35');
            var cop = brine ? brine.cop : 5.30;
            if(!brine){
                try{ cop = (POBE.scopBase[emit] || 5.30); }catch(e){ cop = 5.30; }
            }
            // Woda-woda ma własny opublikowany punkt — nie przeliczamy go z solanki.
            var wp = (emit === 'low') ? 'W10W35' : 'W10W45';
            var water = window.dxSpecAt(m, wp);

            var pumpKw = brine ? brine.kw : 0;
            var pumpKwWater = water ? water.kw : 0;
            if(!pumpKw){
                try{
                    if(m && m.specs && typeof window.getDeviceSpecs === 'function'){
                        var sp = window.getDeviceSpecs(m);
                        pumpKw = (typeof window.dxPointKw === 'function') ? window.dxPointKw(m) : ((sp && sp.kw) ? sp.kw : 0);
                    } else if(m && m.power){ pumpKw = m.power; }
                }catch(e){}
            }
            var R = (typeof window.dxSoilRates === 'function') ? window.dxSoilRates() : { wm2:20, wm:43.3, eff:0.70 };
            return { cop: Math.max(cop, 1.5), pumpKw: pumpKw, soilEff: R.eff,
                     soilWm2: R.wm2, soilWm: R.wm,
                     copWater: water ? water.cop : 0, pumpKwWater: pumpKwWater,
                     copFromCatalog: !!brine };
        };
        window.dxSoilRates = function(){
            var w2 = 20, wm = 43.3, ef = 0.70;
            try{
                var sel = document.getElementById('dxSoil');
                var o = (sel && sel.selectedOptions && sel.selectedOptions[0]) ? sel.selectedOptions[0] : null;
                if(o){
                    var a = parseFloat(o.getAttribute('data-wm2'));
                    var b = parseFloat(o.getAttribute('data-wm'));
                    var e = parseFloat(o.getAttribute('data-eff'));
                    if(a > 0) w2 = a;
                    if(b > 0) wm = b;
                    if(e > 0) ef = e;
                }
            }catch(e){}
            return { wm2: w2, wm: wm, eff: ef };
        };
        const DZ_SIZING = {
            // Ile mocy pompy bierzemy do doboru źródła.
            pumpShare: 0.90,
            // JAK BARDZO ŹRÓDŁO PODĄŻA ZA POMPĄ. Sufit członu pompy: źródło nie
            // urośnie ponad 115% mocy chłodniczej budynku, nawet jeśli pompa jest
            // większa. Pompa dobrana z zapasem (m.in. na szczyt ładowania CWU) nie
            // pracuje mocą szczytową w sezonie — nie ma powodu pod nią wiercić.
            PUMP_FOLLOW_CAP: 1.15,
            // NIEPEWNOŚĆ GRUNTU. Zapas na to, że rzeczywista wydajność gruntu okaże
            // się niższa od tabelarycznej (VDI 4640 podaje widełki, nie gwarancję).
            // Założenie własne DEWAX — normy nie podają wskaźnika procentowego.
            GROUND_UNCERTAINTY: 1.15
        };
        window.DZ_SIZING = DZ_SIZING;
        const COLLECTOR_SPACING = 0.8;
        window.COLLECTOR_SPACING = COLLECTOR_SPACING;
        const DZ_TECH = {
            odwiert:  { copFactor: 1.00, label: 'B0/W35',  dz: 'pionowe' },
            spirale:  { copFactor: 0.92, label: 'B-2/W35', dz: 'koszowe' },
            poziomy:  { copFactor: 0.90, label: 'B-3/W35', dz: 'poziome' },
            wodawoda: { copFactor: 1.15, label: 'W10/W35', dz: 'wodawoda' }
        };
        window.DZ_TECH = DZ_TECH;
        // Kolektor w wykopie Inwestora to ta sama technologia co kolektor poziomy.
        const DZ_TECH_OF = { pionowe:'odwiert', koszowe:'spirale', poziome:'poziomy',
                             kolektorinw:'poziomy', wodawoda:'wodawoda' };
        window.dxTechOf = function(dz){ return DZ_TECH_OF[dz] || 'odwiert'; };
        window.dxPBase = function(pDesign, pumpKw){
            var kw = (pumpKw > 0) ? pumpKw : pDesign;
            return Math.max(pDesign,
                Math.min(kw * DZ_SIZING.pumpShare,
                         pDesign * DZ_SIZING.PUMP_FOLLOW_CAP));
        };
        window.dxDzSizing = function(pDesign, cop, pumpKw, soilWm2, soilWm, copWater, pumpKwWater, soilEff){
            var c  = Math.max(cop || 4, 1.5);       // kotwica: COP B0/W35 z cennika
            var pk = (pumpKw > 0) ? pumpKw : pDesign;
            var cPB  = pDesign * (c - 1) / c;      // moc chłodnicza wymagana przez budynek
            var cPP  = pk * (c - 1) / c;           // moc chłodnicza przy pełnej mocy pompy
            // Ogranicznik nadmiaru pompy — patrz dxPBase() wyżej, tam pomiar
            // pokazujący, który człon wiąże przy której pompie.
            var pHeatBase = window.dxPBase(pDesign, pk);
            // Woda-woda: pompa oddaje w W10/W35 inną moc niż w B0/W35, więc sufit
            // liczymy od jej własnej wydajności.
            var pkWater = (pumpKwWater > 0) ? pumpKwWater : pk;
            // reqZ osobno dla każdej technologii. Uwaga na kierunek: wyższy COP to
            // mniej prądu, czyli WIĘCEJ ciepła pobranego z gruntu — copFactor < 1
            // zmniejsza wymaganą moc źródła, a nie zwiększa.
            var R = window.dxSoilRates();
            var qA = (soilWm2 > 0) ? soilWm2 : R.wm2;   // W/m2 kolektora poziomego
            var qL = (soilWm  > 0) ? soilWm  : R.wm;    // W/mb odwiertu pionowego
            var se = (soilEff > 0) ? soilEff : (R.eff || 0.70);   // kW na sondę spiralną
            var tech = {};
            Object.keys(DZ_TECH).forEach(function(k){
                var T = DZ_TECH[k];
                // Woda-woda ma własny opublikowany punkt pracy — nie przeliczamy go z B0/W35.
                var copT = (k === 'wodawoda' && copWater > 0) ? copWater : c * T.copFactor;
                copT = Math.max(copT, 1.5);
                var hb = (k === 'wodawoda') ? window.dxPBase(pDesign, pkWater) : pHeatBase;
                var reqT  = hb * (copT - 1) / copT;
                var reqZT = reqT * DZ_SIZING.GROUND_UNCERTAINTY;
                tech[k] = { copT: copT, label: T.label,
                            fromCatalog: (k === 'odwiert') || (k === 'wodawoda' && copWater > 0),
                            req: reqT, reqZ: reqZT };
            });
            // Każda ilość liczona ze SWOJEGO reqZ — szt. sond ze spiral, mb odwiertu
            // z odwiertu, mb rur z kolektora.
            // Sondy montuje się parami (dwa obiegi na rozdzielaczu), stąd parzystość.
            var kos = Math.ceil(tech.spirale.reqZ / se); if(kos % 2 !== 0) kos++;
            var pio = Math.ceil(((tech.odwiert.reqZ * 1000) / qL) / 10) * 10;
            var pozArea = Math.ceil((tech.poziomy.reqZ * 1000) / qA);
            // Wynikiem jest DŁUGOŚĆ RURY w mb; powierzchnia to wielkość pośrednia.
            // Równoważnie: q_mb = q_A × COLLECTOR_SPACING (przy 20 W/m² → 16 W/mb),
            // czyli poz = reqZ × 1000 / q_mb. Sprawdzone arytmetyką dokładną dla
            // wszystkich q_A, jakie kreator może wystawić (10 / 20 / 24 / 32 W/m²):
            // oba zapisy dają identyczny wynik, więc wzór zostaje w tej postaci —
            // pośredni ceil na m² zaokrągla powierzchnię do pełnego metra, co jest
            // tym, co handlowiec podaje klientowi.
            var poz = Math.ceil((pozArea / COLLECTOR_SPACING) / 10) * 10;
            // req/reqZ na najwyższym poziomie dotyczą AKTUALNIE wybranej technologii —
            // czytają je opis doboru, kontrola i oferta.
            var selTech = window.dxTechOf(typeof selectedDz !== 'undefined' ? selectedDz : 'pionowe');
            var req  = tech[selTech].req;
            var reqZ = tech[selTech].reqZ;
            // Ręczne nadpisania z kroku 2 obowiązują WSZĘDZIE — także na stronie
            // technicznej oferty. Wcześniej kosztorys brał wartość ręczną, a tabela
            // wariantów wyliczoną, więc jedna oferta miała dwie różne ilości i ceny.
            var ov = (typeof dzOverride !== 'undefined' && dzOverride) ? dzOverride : {};
            var kosE = (ov.koszowe > 0) ? parseInt(ov.koszowe, 10) : kos;
            if(kosE % 2 !== 0) kosE++;
            var pioE = (ov.pionowe > 0) ? parseInt(ov.pionowe, 10) : pio;
            var pozE = (ov.poziome > 0) ? parseInt(ov.poziome, 10) : poz;
            var pozAreaE = (ov.poziome > 0) ? Math.round(pozE * COLLECTOR_SPACING) : pozArea;
            return { cPB: cPB, cPP: cPP, req: req, reqZ: reqZ, qA: qA, qL: qL, soilEff: se,
                     tech: tech, selTech: selTech, pHeatBase: pHeatBase,
                     kos: kosE, kosP: kosE * se, pio: pioE, pozArea: pozAreaE, poz: pozE,
                     kosAuto: kos, pioAuto: pio, pozAuto: poz, pozAreaAuto: pozArea,
                     manual: !!(ov.koszowe > 0 || ov.pionowe > 0 || ov.poziome > 0) };
        };
        function getPDesign(){ const ozc=parseFloat(document.getElementById('dxOzc')?.value); if(ozc>0) return ozc; return (building.area*building.heatLoss)/1000; }
        const DX_POINT_LABEL = {
            B0W35:  'B0/W35 (glikol-woda, zasilanie 35°C)',
            W10W35: 'W10/W35 (woda-woda, zasilanie 35°C)',
            W10W45: 'W10/W45 (woda-woda, zasilanie 45°C)'
        };
        const DX_NODATA_MSG = 'Brak danych producenta dla tego punktu pracy. Dobór wymaga potwierdzenia technicznego.';
        function dxWorkPoint(){
            const src = (typeof selectedDz!=='undefined'?selectedDz:'pionowe');
            const emit = (typeof building!=='undefined' && building.heatingType) || 'low';
            if(src==='wodawoda'){
                if(emit==='low') return 'W10W35';
                if(emit==='high' || emit==='mixed') return 'W10W45';
                return null; // indywidualne / 55°C — brak danych
            }
            // gruntowe glikol-woda (odwierty / kolektor)
            if(emit==='low') return 'B0W35';
            return null; // B0/W45, B0/W55 — brak danych producenta
        }
        // Kaskada może łączyć różne modele. Moc = suma jednostek, COP = średnia
        // ważona mocą — wcześniej brany był COP pierwszej pompy, co przy kaskadzie
        // mieszanej dawało zły punkt pracy i zły dobór dolnego źródła.
        function dxCascadeSpecs(units){
            var totKw = 0, wCop = 0, pin = 0, point = null, label = '', noData = false;
            (units || []).forEach(function(u){
                var sp = (u && u.specs && typeof getDeviceSpecs === 'function') ? getDeviceSpecs(u) : null;
                if(!sp || sp.noData){ noData = true; return; }
                var kw = Number(sp.kw) || 0;
                totKw += kw;
                wCop  += kw * (Number(sp.cop) || 0);
                pin   += Number(sp.pin) || 0;
                if(!point) point = sp.point;
                if(!label) label = sp.label;
            });
            if(noData || totKw <= 0) return { noData:true, label:'BRAK DANYCH', message:DX_NODATA_MSG };
            return {
                kw:  Math.round(totKw * 100) / 100,
                cop: Math.round((wCop / totKw) * 100) / 100,
                pin: Math.round(pin * 100) / 100,
                point: point,
                label: (label || '') + ' · kaskada ' + (units.length) + '× (COP średnia ważona mocą)'
            };
        }
        window.dxCascadeSpecs = dxCascadeSpecs;

        function getDeviceSpecs(model) {
            if(!model) return null;
            if(model._cascade && model._units && model._units.length) return dxCascadeSpecs(model._units);
            if(!model.specs) return null;
            if(model.specs.B0W35){ // seria TK-G R290 — wyłącznie dane producenta
                const p = dxWorkPoint();
                if(!p || !model.specs[p]) return { noData:true, point:p, label:'BRAK DANYCH', message:DX_NODATA_MSG };
                const s = model.specs[p];
                return { kw:s.kw, cop:s.cop, pin:s.pin, point:p, label:DX_POINT_LABEL[p] };
            }
            // starsze serie (odseparowane z oferty) — dane katalogowe legacy, bez interpolacji
            const s = model.specs;
            const emit = (typeof building!=='undefined' && building.heatingType) || 'low';
            const src = (typeof selectedDz!=='undefined'?selectedDz:'pionowe');
            if(src==='wodawoda'){
                if(emit==='low' && s.pionowe_low)  return { kw:s.pionowe_low.kw,  cop:s.pionowe_low.cop,  label:'W10/W35 (woda-woda)' };
                if((emit==='high'||emit==='mixed') && s.pionowe_high) return { kw:s.pionowe_high.kw, cop:s.pionowe_high.cop, label:'W10/W45 (woda-woda)' };
                return { noData:true, label:'BRAK DANYCH', message:DX_NODATA_MSG };
            }
            if(emit==='low' && s.poziome_low) return { kw:s.poziome_low.kw, cop:s.poziome_low.cop, label:'B0/W35 (glikol-woda)' };
            return { noData:true, label:'BRAK DANYCH', message:DX_NODATA_MSG };
        }
        window.getDeviceSpecs = getDeviceSpecs;
        window.dxWorkPoint = dxWorkPoint;
        window.DX_NODATA_MSG = DX_NODATA_MSG;
        const extrasItems = [
            { id:'buforCO', name:'Bufor CO (akumulacyjny)', desc:'Stabilizacja pracy PC, ochrona sprężarki', defaultPrice: 1800, auto: false, category:'zbiorniki', icon:'🛢️',
              variants: [
                { label: 'WEBER W4 100L (do 8 kW)', price: 1200 },
                { label: 'WEBER W4 200L (8–12 kW)', price: 1900 },
                { label: 'WEBER W4 300L (12+ kW)', price: 2500 },
              ]
            },
            { id:'zasobnikCWU', name:'Zasobnik CWU (dodatkowy/zamiennik)', desc:'Z powiększoną wężownicą do PC', defaultPrice: 2600, auto: true, category:'zbiorniki', icon:'🚿',
              variants: [
                { label: 'Brak / nie potrzebny', price: 0 },
                { label: 'SWATT 200L — wariant podstawowy (2-3 os.; dla 4+ os. zalecane 300L — do potwierdzenia)', price: 2600 },
                { label: 'SWATT 300L (4-5 os.)', price: 3400 },
                { label: 'SWATT 400L (6+ os.)', price: 4500 },
                { label: 'WEBER 200L z podwójną wężownicą', price: 3200 },
                { label: 'WEBER 300L z podwójną wężownicą', price: 4100 },
              ],
              defaultVariant: 1,
              note:'Dodatkowy zasobnik CWU jeśli potrzebny'
            },
            { id:'naczynieWzbiorCWU', name:'Naczynie wzbiorcze CWU', desc:'Przeponowe 8-12L do instalacji CWU', defaultPrice: 300, auto: false, category:'zbiorniki', icon:'🛢️' },
            { id:'grupaBezp', name:'Grupa bezpieczeństwa CO', desc:'Zawór bezp. 3 bar + manometr + odpowietrznik', defaultPrice: 350, auto: false, category:'armatura', icon:'🔧' },
            { id:'sprzeglo', name:'Sprzęgło hydrauliczne', desc:'Rozdzielenie obiegu PC od inst. CO', defaultPrice: 1200, auto: false, category:'armatura', icon:'🔧' },
            { id:'pompaObieg', name:'Pompa obiegowa CO', desc:'Np. Grundfos/Wilo do obiegu grzewczego', defaultPrice: 1500, auto: false, category:'armatura', icon:'⚡' },
            { id:'zaworyFiltr', name:'Zawory + filtry + odpowietrzniki', desc:'Zawory zwrotne, kulowe, filtr siatkowy, separator', defaultPrice: 800, auto: false, category:'armatura', icon:'🔧' },
            { id:'naczynieWzbior', name:'Naczynie wzbiorcze CO', desc:'Przeponowe, do instalacji zamkniętej', defaultPrice: 400, auto: false, category:'armatura', icon:'🛢️' },
            { id:'glikol', name:'Glikol (solanka)', desc:'Napełnienie instalacji dolnego źródła 25-33%', defaultPrice: 1200, auto: false, category:'dolne', icon:'💧' },
            { id:'studzienka', name:'Studzienka rozdzielaczowa', desc:'Rozdzielacz + obudowa do dolnego źródła', defaultPrice: 1500, auto: false, category:'dolne', icon:'🕳️' },
            { id:'materialHydr', name:'Materiał hydrauliczny', desc:'Orurowanie kotłowni: rury, złączki, kształtki, zawory odcinające, izolacje, uchwyty i drobny osprzęt montażowy', defaultPrice: 2500, auto: false, category:'montaz', icon:'🔩' },
            { id:'materialElektr', name:'Materiał elektryczny', desc:'Kable, zabezpieczenia, rozdzielnica, czujniki', defaultPrice: 1500, auto: false, category:'montaz', icon:'⚡' },
            { id:'montaz', name:'Montaż kotłowni', desc:'Montaż pompy i osprzętu, podłączenie hydrauliczne i elektryczne w kotłowni, napełnienie i odpowietrzenie układu, uruchomienie z konfiguracją automatyki', defaultPrice: 6000, auto: true, category:'montaz', icon:'👷' },
            { id:'transport', name:'Transport', desc:'Dostawa urządzeń na miejsce inwestycji', defaultPrice: 800, auto: false, category:'montaz', icon:'🚚' },
        ];

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
