/* =============================================================================
 * Jednorazowa operacja: snapshot wyceny w kreatorze
 * =============================================================================
 * Dokleja do index.html dwie funkcje i jedno wywolanie: po zapisaniu transakcji
 * w HubSpocie leci tam takze komplet danych, z ktorych wyszla kwota.
 *
 * Uruchamiany raz. Zostawiony w repozytorium jako zapis tego, co zostalo dodane.
 * ========================================================================== */

const fs = require("fs");
const path = require("path");

const HTML = path.join(__dirname, "..", "index.html");
let tekst = fs.readFileSync(HTML, "utf8");

/* --- 1. Funkcje pomocnicze, tuz przed syncDealToHubSpot ------------------- */

const KOTWICA_FUNKCJI = "        window.syncDealToHubSpot = syncDealToHubSpot;";
if (tekst.indexOf(KOTWICA_FUNKCJI) < 0) throw new Error("Brak kotwicy syncDealToHubSpot");

const FUNKCJE = `
        // ===================== SNAPSHOT WYCENY =====================
        // Kazda wycena zapisuje do HubSpota komplet: dane wejsciowe, wynik,
        // wersje cennika, date i identyfikator.
        //
        // Powod jest prosty i kosztowal juz kilka rozmow: do tej pory HubSpot
        // dostawal wylacznie nazwe transakcji i kwote koncowa. Po miesiacu nikt
        // - ani handlowiec, ani klient - nie potrafil odpowiedziec, skad wziela
        // sie ta kwota i po jakim cenniku byla liczona. Nie dalo sie tez
        // przeliczyc starej oferty po nowych cenach, bo nie bylo czego przeliczac.
        //
        // Notatka na kontakcie niesie pelna tresc, pola na transakcji pozwalaja
        // to potem odnalezc i przefiltrowac.

        function dxZbierzKonfig(){
            var R = window.dxSoilRates();
            var stan = {};
            (window.extrasStateRef || extrasState || {});
            extrasItems.forEach(function(poz){
                var s = extrasState[poz.id];
                if(s) stan[poz.id] = { checked: !!s.checked, price: Number(s.price) || 0 };
            });
            var vatSel = document.getElementById('vatRateStep4');
            return {
                budynek: {
                    powierzchnia: Number(building.area) || 0,
                    wskaznikStrat: Number(building.heatLoss) || 0,
                    ozc: (document.getElementById('dxOzc') || {}).value || ''
                },
                odbiorniki: building.heatingType || 'low',
                osoby: Number(building.persons) || null,
                lazienka: building.bathType || null,
                dolneZrodlo: selectedDz,
                grunt: { wm2: R.wm2, wm: R.wm, eff: R.eff },
                modelId: selectedModelObj ? selectedModelObj.id : null,
                nadpisaniaIlosci: {
                    koszowe: dzOverride.koszowe, pionowe: dzOverride.pionowe, poziome: dzOverride.poziome
                },
                ryczaltKolektorInw: (typeof window.dxFlatFee === 'function') ? window.dxFlatFee() : null,
                osprzet: stan,
                vat: vatSel ? parseInt(vatSel.value, 10) : 8
            };
        }
        window.dxZbierzKonfig = dxZbierzKonfig;

        async function dxZapiszSnapshot(contactId, dealId){
            if(!window.DEWAX_CORE || !contactId) return null;
            var konfig, wynik, snap;
            try {
                konfig = dxZbierzKonfig();
                wynik  = window.DEWAX_CORE.wycenaDokladna(konfig);
                snap   = window.DEWAX_CORE.snapshot('zespol', konfig, wynik);
            } catch(e){
                // Snapshot nie moze zablokowac zapisu transakcji. Transakcja
                // z brakiem snapshotu jest zla; brak transakcji jest gorszy.
                console.warn('DEWAX: nie udalo sie zlozyc snapshotu wyceny', e);
                return null;
            }

            var podpis = (typeof window.dxPodpisNazwa === 'function') ? window.dxPodpisNazwa() : '';
            var tresc = window.DEWAX_CORE.snapshotJakoNotatka(snap)
                      + (podpis ? '\\n\\nWystawil(a): ' + podpis : '');

            try {
                await dxApiFetch(LEADS.hubspotProxy + '/contact/' + contactId + '/note', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ body: tresc })
                });
            } catch(e){ console.warn('DEWAX: notatka ze snapshotem nie poszla', e); }

            if(dealId){
                try {
                    await dxApiFetch(LEADS.hubspotProxy + '/deal/' + dealId, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ properties: {
                            dewax_wersja_cennika: String(snap.wersjaCennika || ''),
                            dewax_wycena_id: snap.identyfikator,
                            dewax_data_wyceny: String(Date.now()),
                            dewax_zrodlo_leada: 'kreator zespolu'
                        } })
                    });
                } catch(e){ console.warn('DEWAX: pola snapshotu na transakcji nie poszly', e); }
            }

            // Rozjazd miedzy kwota na wydruku a kwota z rdzenia znaczy, ze ktos
            // policzyl cos poza rdzeniem. Lepiej dowiedziec sie o tym w konsoli
            // handlowca niz od klienta.
            window.dxOstatniSnapshot = snap;
            return snap;
        }
        window.dxZapiszSnapshot = dxZapiszSnapshot;

`;

tekst = tekst.replace(KOTWICA_FUNKCJI, FUNKCJE + KOTWICA_FUNKCJI);

/* --- 2. Wywolanie po utworzeniu transakcji -------------------------------- */

const KOTWICA_WYWOLANIA = "                dxHsStatus('HubSpot: transakcja zapisana — '";
if (tekst.indexOf(KOTWICA_WYWOLANIA) < 0) throw new Error("Brak kotwicy dxHsStatus po zapisie transakcji");

const WYWOLANIE = `                // Snapshot wyceny - komplet danych, z ktorych wyszla ta kwota.
                await dxZapiszSnapshot(contactId, window.dxLastDealId);
`;

tekst = tekst.replace(KOTWICA_WYWOLANIA, WYWOLANIE + KOTWICA_WYWOLANIA);

fs.writeFileSync(HTML, tekst, "utf8");
console.log("Snapshot wyceny wpiety w index.html");
