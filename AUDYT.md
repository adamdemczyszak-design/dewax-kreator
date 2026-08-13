# AUDYT KREATORA DEWAX

Data: 13.08.2026 · plik: `index.html` (7 025 linii, 1,30 MB)

---

## 0. Czym to jest, w liczbach

| | |
|---|---|
| Cały kreator | jeden plik `index.html` |
| Rozmiar | 1,30 MB, z czego ~840 KB to obrazki wklejone jako base64 |
| CSS | 9 osobnych bloków `<style>`, razem ~1 870 linii |
| JS | 7 osobnych bloków `<script>`, razem ~4 430 linii |
| Funkcje JS | 166 |
| Biblioteki z zewnątrz | Tailwind CDN, html2canvas, **jsPDF wczytany dwa razy** (unpkg + cdnjs) |
| Backend | 2 Cloudflare Workery: `dewax-hubspot`, `dewax-send` (→ Resend) + `dewax-geo` na Netlify |

**To nie jest jedna aplikacja. To sześć warstw poklejonych na sobie**, gdzie każda kolejna
nadpisuje funkcje poprzedniej. Najważniejsza konsekwencja jest opisana niżej i bez jej
zrozumienia połowa pliku wygląda na działającą, a nie działa.

---

## 1. Najważniejsza rzecz w całym pliku: krok 5 jest budowany dwa razy

W HTML-u, w liniach **1355–1592**, siedzi kompletna, ręcznie napisana oferta:
dane klienta, granatowy blok „Kluczowe dane", tabela wydajności, tabela projektu,
kosztorys, ważność oferty, stopka z podpisami, przyciski „Wyślij ofertę / Drukuj /
Generuj Umowę DOCX". Ładnie zrobione. **I wyrzucane do śmieci przy każdym wejściu w krok 5.**

Bo moduł „CLEAN OFFER REFACTOR" (linia 4514) robi:

```js
root.innerHTML = buildHtml(d);   // #step5 — cała treść zastąpiona
```

Łańcuch nadpisań `generateReport` wygląda tak:

1. `function generateReport()` (linia 3015) — stara wersja
2. `polishOfferLayoutV3` owija ją (4337)
3. `polishOfferLayoutV5` owija to (4385)
4. **`window.generateReport = ...` (4982) — wyrzuca punkty 1–3 w całości**
5. `dx-app-js` dokleja `updateDxSummary()` (6129)
6. moduł geo dokleja załącznik geologiczny (6808)

Działa punkt 4 + 5 + 6. Punkty 1, 2, 3 to ~350 linii JS, które nigdy się nie wykonują.
I razem z nimi umiera wszystko, co było podpięte pod stary HTML kroku 5 — w tym
**przycisk generowania umowy**.

---

## 2. Inwentaryzacja — funkcja po funkcji

Legenda kolumny „Stan": **DZIAŁA** / **MARTWE** (kod jest, nic go nie wywołuje) / **KALEKIE** (wykonuje się, ale efekt jest zerowy albo zły).

### A. Dostęp do kreatora

| Funkcja | Co robi | Stan | Sprzedawca użyje? |
|---|---|---|---|
| `DX_AUTH` + ekran kodu (1893, 3869) | Zasłania kreator ekranem na kod dostępu; kodu nie ma w pliku, sprawdza go Worker | DZIAŁA | Tak — codziennie, przy wejściu |
| `dxApiFetch` (1946) | Dokłada kod dostępu do każdego zapytania do Workerów, a 401 wywala z powrotem na logowanie | DZIAŁA | Tak, niewidocznie |
| `escLead` (1965) | Escape'uje dane leada z Facebooka, żeby nazwisko typu `<img onerror=...>` się nie wykonało | DZIAŁA | Tak, niewidocznie |

To jedyna warstwa w pliku napisana z myślą o bezpieczeństwie i jest zrobiona sensownie.

### B. Leady i CRM (wejście)

| Funkcja | Co robi | Stan | Sprzedawca użyje? |
|---|---|---|---|
| `loadLeads` (2038) | Ściąga do 1 000 kontaktów z HubSpota przez Workera | DZIAŁA | Tak — to pierwszy klik dnia |
| `renderLeadList` (2081) | Rysuje listę leadów z przyciskami „zadzwoń", „SMS", „obdzwoniony" | DZIAŁA | Tak, to jest codzienne narzędzie |
| `fillLead` (2123) | Wstawia dane wybranego leada do formularza | DZIAŁA | Tak |
| `setHandled` (1996) | Chowa leada z listy i zapisuje `hs_lead_status: OBDZWONIONY` w HubSpocie | DZIAŁA | Tak |
| auto-odświeżanie co 60 s (2143) | Sam dociąga nowe leady w tle | DZIAŁA | Tak, niewidocznie |
| `smsText` (2017) | Buduje treść SMS-a ocieplającego po nieodebranym | **KALEKIE** | Tak, ale wyśle błąd językowy |
| `autoFillFromLead` (1874) | Wypełnia formularz z parametrów URL (`?imie=…&tel=…`) | DZIAŁA | Tylko jeśli ktoś podeśle link z CRM-a |
| `cleanPhone` (2036) | Miał czyścić numer telefonu | MARTWE | Nie |

**`smsText` — konkret:** linia 2024 wywołuje `vocativeFirstName(first)`, a takiej funkcji
w pliku **nie ma**. Zabezpieczenie `typeof === 'function'` łapie to cicho i podstawia imię
w mianowniku. Efekt w SMS-ie do klienta: **„Dzień dobry Panie Wojciech,"** zamiast
„Panie Wojciechu". Wysyłane na produkcji, do prawdziwych ludzi.

**`loadLeads` — konkret:** adres inwestycji jest pobierany jako
`p.state || p.city || p.zip` (linia 2062). W HubSpocie `state` to **województwo**.
Czyli „Adres inwestycji" wypełnia się nazwą województwa, a właściwa właściwość
`address` nie jest w ogóle czytana. Pole `area` jest ustawiane na pusty string na sztywno,
więc gałąź w `fillLead`, która miała wczytywać metraż z HubSpota, nigdy się nie odpala.

### C. Krok 1 — budynek i zapotrzebowanie

| Funkcja | Co robi | Stan | Sprzedawca użyje? |
|---|---|---|---|
| `recalcLive` (2184) | Przelicza na żywo moc P-design, ciepło CO, CWU, SCOP i zużycie prądu | DZIAŁA | Tak — to serce rozmowy z klientem |
| `getCwuKwh` (1643) | Liczy roczne ciepło na CWU z liczby osób i wanna/prysznic | DZIAŁA | Tak, niewidocznie |
| `getRecommendedTank` (1656) | Podpowiada 200/300/400 L | DZIAŁA | Tak, jako podpowiedź |
| `getPDesign` (2461) | Zwraca moc z pola OZC, a jeśli puste — z powierzchni × W/m² | DZIAŁA | Tak, niewidocznie |
| `dxInjectInputs` (6019) | Dokleja z JS pole „Moc projektowa z OZC" i listę „Warunki gruntowe" | DZIAŁA | Tak — pole OZC to najważniejszy input dla dobrego doboru |
| `selectHeating` / `selectBath` (2179) | Wybór odbiorników i typu łazienki | DZIAŁA | Tak |
| `getCwuPowerAllowance` (1651) | Liczy naddatek mocy na ładowanie CWU (0,25 kW/os.) | DZIAŁA, ale tylko jako ostrzeżenie | Nie bezpośrednio — nie wchodzi do P-design, wyświetla się tylko w „Kontroli doboru" |
| `updateInsulationDesc` (3861) | Miała odświeżać opis izolacji | MARTWE | Nie |

Kalkulator na żywo to najlepsza część kreatora. Liczy przejrzyście, pokazuje wzór,
podaje źródła (POBE II kw. 2026). To można pokazać klientowi na ekranie.

### D. Krok 2 — dolne źródło

| Funkcja | Co robi | Stan | Sprzedawca użyje? |
|---|---|---|---|
| `dxDzSizing` (2344) | Jeden silnik liczący wymaganą moc chłodniczą i ilość sond / metrów / m² | DZIAŁA | Tak, niewidocznie — i słusznie, że jest jeden |
| `dxSoilRates` (2330) | Bierze W/m² i W/mb z wybranego gruntu (VDI 4640) | DZIAŁA | Tak, niewidocznie |
| `updateDzCards` (2376) | Wpisuje wyliczone ilości i ceny na 5 kart dolnego źródła | DZIAŁA | Tak — to główny ekran negocjacji ceny |
| `selectDz` (2235) | Wybór wariantu + natychmiastowe przeliczenie wszystkiego | DZIAŁA | Tak |
| `onDzQtyChange` (2431) | Pozwala nadpisać ilość ręcznie | DZIAŁA | Tak — sprzedawca prawie zawsze coś dokręci |
| `dxResetDzOverride` (2269) | Kasuje ręczne nadpisania | DZIAŁA | Tak, gdy zobaczy żółty przycisk |
| `dxFlatFee` / `onDzFeeChange` (2256) | Ryczałt za kolektor płaski z koparką Inwestora + ostrzeżenie, gdy ryczałt nie pokrywa materiału | DZIAŁA | Tak — to realny model sprzedaży |
| `ceilTo` (2278) | Zaokrąglanie w górę | MARTWE | Nie |

**Realny problem:** `dzOverride` i `extrasState` **nie są czyszczone przy wczytaniu
nowego leada**. Wpiszesz ręcznie 240 mb dla Kowalskiego, wczytasz Nowaka — Nowak
dostaje 240 mb i cenę Kowalskiego. Jest na to żółty przycisk „Ilość wpisana ręcznie —
przywróć automatyczną", ale trzeba go zauważyć i kliknąć. To nie zabezpieczenie,
to notatka na kartce.

Tak samo `window.__dxCwuAuto` — automatyczny dobór zasobnika CWU odpala się
**raz na całą sesję przeglądarki**. Drugi klient go już nie dostanie.

### E. Krok 2b — geologia z PIG-PIB (`dewax-geo`)

| Funkcja | Co robi | Stan | Sprzedawca użyje? |
|---|---|---|---|
| `injectPanel` / `panelHtml` (6411) | Dokleja w kroku 2 panel „Dane geologiczne dla działki" | DZIAŁA | Tak, jeśli zna adres |
| `parseAddress` / `prefillAddress` (6459) | Rozbija adres z karty klienta na miasto / ulicę / numer | DZIAŁA | Tak, niewidocznie |
| `fetchGeo` (6541) | Woła `dewax-geo`, dostaje qᵥ z Mapy Potencjału Geotermii i ryzyka z otworów CBDG | DZIAŁA | Tak — to jedyny twardy argument techniczny w ofercie |
| `applyToSoilSelect` (6604) | Dorzuca do listy gruntów opcję „Dane PIG-PIB dla tej działki" i ją zaznacza | DZIAŁA | Tak, automatycznie |
| `render` (6648) | Pokazuje wiarygodność, pokrycie profilu, ryzyka wiertnicze, link do raportu | DZIAŁA | Tak |
| `annexSection` (6728) | Dokleja do oferty osobną stronę „Podstawa geologiczna doboru" | DZIAŁA | Tak — mocna, konkretna strona |
| `renumber` (6798) | Poprawia numerację stron, bo doszła strona z geologią | DZIAŁA | Tak, niewidocznie |

To jest **najmocniejsza i najlepiej napisana część kreatora**. Jedyna, która pracuje
na danych z zewnątrz zamiast na założeniach, jedyna z sensownymi komentarzami
i jedyna, w której ktoś pomyślał, że ryzyka z 40 m nie mają nic do rzeczy przy
kolektorze na 2 m (`TECH_DEPTH`, linia 6407).

### F. Krok 3 — urządzenie

| Funkcja | Co robi | Stan | Sprzedawca użyje? |
|---|---|---|---|
| `renderDevices` (2538) | Pokazuje po 1 rekomendacji z każdej serii, o mocy ≥ P-design | DZIAŁA | Tak |
| `getDeviceSpecs` (2512) | Zwraca moc i COP w punkcie pracy — wyłącznie z danych producenta, bez interpolacji | DZIAŁA | Tak, niewidocznie |
| `dxWorkPoint` (2474) | Ustala punkt pracy (B0/W35, W10/W35, W10/W45) | DZIAŁA — i tu jest największa dziura, patrz niżej |
| kaskady (2570) | Gdy żadna pompa solo nie wystarcza, składa 2× lub 3× | DZIAŁA | Rzadko — tylko duże obiekty |
| `dxCascadeSpecs` (2489) | Moc = suma, COP = średnia ważona mocą | DZIAŁA | Niewidocznie |
| `dxRenderManual` / `dxPickModel` (6077) | Rozwijana lista wszystkich urządzeń, także starych TKW/TKWD | DZIAŁA | Tak, gdy automat nie trafi |
| `selectBrand` (2455) | Przełącznik Thermokrafft / Buderus WPS | **KALEKIE** | Raczej nie — patrz niżej |
| `getSeriesLabel` (2649) | Kolorowe plakietki serii | DZIAŁA | Kosmetyka |

**Dziura nr 1 — dom z grzejnikami nie ma punktu pracy.** `dxWorkPoint` (2474):
dla dolnego źródła gruntowego zwraca `'B0W35'` **tylko dla podłogówki**, a dla
grzejników / mieszanego / „inne" zwraca `null`. W katalogu R290 nie ma B0/W45 i kod
świadomie nie interpoluje. Skutek: przy grzejnikach na sondach pojawia się żółty pas
„Brak danych producenta dla tego punktu pracy", karty pomp tracą COP, a w ofercie na
stronie 2 status doboru to „BRAK DANYCH — wymaga potwierdzenia technicznego".
Oferta i tak się wygeneruje, tylko połowa liczb wyparuje. To dotyczy praktycznie
każdej modernizacji, więc dziura nie jest brzegowa — jest w środku rynku.
Uczciwe, że kreator o tym mówi. Bezużyteczne przy kliencie.

**Buderus jest półmartwy.** Przełącznik działa, 16 modeli Buderusa się pokaże,
ale te wpisy w katalogu nie mają pola `specs` — więc żadnego COP, żadnego punktu pracy.
Dalej: tabela na stronie 2 oferty nazywa się „Porównanie modeli **Thermokrafft**"
i filtruje `brand === 'dewax'` (linia 4737), czyli po wybraniu Buderusa pokazuje
Thermokraffty **bez żadnego zaznaczonego wiersza**. Plakietki produktu wpisują
„R290 / DC Inverter / WiFi" na podstawie regexpa po nazwie. Stopka oferty mówi
„Gruntowa pompa ciepła Thermokrafft". Sprzedaż Buderusa z tego kreatora to
wystawienie oferty Thermokraffta z podmienioną nazwą urządzenia.

**Serie TKW i TKWD (13 pozycji) są ukryte.** Mają `brand: 'dewax_old'`, a krok 3
filtruje po `'dewax'` / `'buderus'`. Wchodzą tylko przez wybór ręczny. Zamierzone
(„odseparowane"), ale w efekcie 13 z 33 pozycji katalogu leży w pliku bez ruchu.

### G. Krok 4 — osprzęt i kosztorys

| Funkcja | Co robi | Stan | Sprzedawca użyje? |
|---|---|---|---|
| `renderExtras` (2801) | 14 pozycji osprzętu z checkboxami, wariantami i cenami do edycji | DZIAŁA | Tak — to drugi najważniejszy ekran |
| `toggleExtra` / `updateExtraPrice` / `selectVariant` | Odznaczanie i ręczna zmiana ceny | DZIAŁA | Tak, przy każdym kliencie |
| `updateStep4Summary` (2933) | Podsumowanie netto / VAT / brutto, VAT liczony pozycja po pozycji | DZIAŁA | Tak — to liczba, którą podaje klientowi |
| auto-dobór bufora CO po mocy (2806) | Sam ustawia 100/200/300 L | DZIAŁA | Tak, jako podpowiedź |
| auto-dobór zasobnika CWU po osobach (6057) | Sam ustawia 200/300/400 L | DZIAŁA raz na sesję | Tak, przy pierwszym kliencie |
| `getExtrasBreakdown` (2923) | Lista zaznaczonych pozycji do kosztorysu | DZIAŁA | Niewidocznie |

Ten krok jest solidny. VAT liczony pozycja po pozycji zgadza się z kosztorysem
na wydruku — ktoś to celowo naprawił i zostawił komentarz dlaczego (2966).

### H. Krok 5 — oferta (warstwa `tk-clean`)

| Funkcja | Co robi | Stan | Sprzedawca użyje? |
|---|---|---|---|
| `getOfferData` (4566) | Zbiera wszystko w jeden obiekt oferty | DZIAŁA | Niewidocznie |
| `buildHtml` (4930) | Buduje 4 strony A4: rekomendacja, wydajność, dolne źródło, kosztorys | DZIAŁA | Tak — to jest produkt |
| `renderCostTable` (4620) | Tabela kosztorysu + sumy netto/VAT/brutto | DZIAŁA | Tak |
| `dxControl` (4791) | „Kontrola poprawności doboru": rezerwa mocy, zapas dolnego źródła, VDI 4640 cz.1, ostrzeżenia | DZIAŁA | Tak — to najbardziej wartościowa tabela w ofercie |
| `dzVariantsRows` (4845) | Tabela 5 wariantów dolnego źródła z cenami | DZIAŁA | Tak — świetne narzędzie negocjacyjne |
| `comparisonTable` (4735) | 4 modele Thermokraffta obok siebie | DZIAŁA (dla Thermokraffta) | Tak |
| `monthlyChartSvg` (4692) | Słupki zużycia prądu miesiąc po miesiącu | DZIAŁA | Tak — dobrze się tłumaczy klientowi |
| `coverageSvg` / `coverageText` (4715) | Pokrycie mocy: zapotrzebowanie vs pompa | DZIAŁA | Tak |
| `dzLogicLine` (4836) | Jedno zdanie wyjaśniające, skąd ilość sond | DZIAŁA | Tak |
| `dxBenefits` / `dxSummary3` (4885) | Bloki korzyści i 3 kluczowe liczby | DZIAŁA | Tak |
| `dxDzScope` / `dxPanelList` (4915) | „DEWAX zapewnia" vs „Po stronie Inwestora" — tylko dla kolektora płaskiego | DZIAŁA | Tak, w tym jednym wariancie |
| `pumpImage` (4642) | Zdjęcie pompy | **KALEKIE dla kaskad** — czyta `m.units`, a obiekt ma `m._units` (2707) | Tak, ale kaskada wyjdzie bez zdjęcia |
| `updateVatDisplay` (4995) | Miała przeliczać VAT na stronie oferty | MARTWE — nowa oferta nie ma już selecta VAT ani `#kosztorysTable` | Nie |
| `specRows` (4637) | Rysowanie wierszy specyfikacji | MARTWE — zastąpione przez `specRows2` | Nie |

Rzeczywista oferta jest dobra: 4 (+1 geologiczna) strony A4, uczciwie oznaczone
jako dobór wstępny, z sekcją „nie obejmuje", zakresem realizacji i kontrolą doboru.
To jest jedyna rzecz w tym pliku, którą warto pokazać klientowi.

### I. PDF, druk, wysyłka

| Funkcja | Co robi | Stan | Sprzedawca użyje? |
|---|---|---|---|
| `buildOfferPdf` (5008) | Renderuje każdą stronę A4 przez html2canvas do jednej strony PDF | DZIAŁA | Tak |
| `dxSavePdf` (6133) | Przycisk „Zapisz PDF" + zapis transakcji w HubSpocie | DZIAŁA | Tak |
| `dxPrintOffer` (5064) | Przycisk „Drukuj" + zapis transakcji | DZIAŁA | Tak |
| `generatePdfAndOpenEmail` (5081) | Przycisk „Wyślij ofertę": PDF → Worker `dewax-send` → Resend, z rozpoznawaniem konkretnych błędów | DZIAŁA | Tak — to finał całej pracy |
| `tkDownloadLastPdf` (5075) | Awaryjne pobranie PDF-a po błędzie wysyłki | DZIAŁA | Tak, gdy Worker padnie |
| `savePdfOnly` (5057, nadpisana) | To samo co `dxPrintOffer` | MARTWE — nie ma przycisku | Nie |
| `savePdfOnly` (3499, stara) | Stara wersja z `pdf.save()` | MARTWE | Nie |
| `buildOfferPdf` (3402, stara) | Stary generator PDF „sekcja po sekcji" | MARTWE | Nie |
| `generatePdfAndOpenEmail_OLD_GMAIL` (3679) | Stary tryb: pobierz PDF + otwórz Gmaila | MARTWE (autor sam to oznaczył) | Nie |
| `generatePdfAndOpenEmail_LEGACY_OLD_GMAIL` (3721) | Jeszcze starszy tryb, z `navigator.share` | MARTWE (autor sam to oznaczył) | Nie |
| `prefillEmailBody` (3833) | Stara treść maila | MARTWE | Nie |

Warto zauważyć, co jest **w martwej** `prefillEmailBody`: podpis „**Małgorzata Kuś**"
na sztywno i obietnica „oferta zawiera porównanie rocznych kosztów ogrzewania" —
której obecna oferta nie spełnia. Dobrze, że to nie żyje. Ale w żywym `smsText`
podpis to na sztywno „**Adam**" i numer `509 815 112`, a w stopce oferty jest
`+48 506 002 684`. Trzech różnych ludzi i dwa numery w jednym narzędziu.

PDF to **rastrowe zdjęcia stron** (JPEG 0,96, scale 2). Tekstu nie da się zaznaczyć
ani wyszukać, linki nie działają, plik jest ciężki. Działa i wygląda dobrze — ale to
skan, nie dokument.

### J. HubSpot — transakcja i właściciel

| Funkcja | Co robi | Stan | Sprzedawca użyje? |
|---|---|---|---|
| `syncDealToHubSpot` (3607) | Zakłada transakcję na kwotę brutto z wydruku | DZIAŁA | Tak, automatycznie |
| `hsResolveContactId` (3590) | Szuka kontaktu: wczytany lead → e-mail → telefon → 9 cyfr → zakłada nowy | DZIAŁA | Niewidocznie |
| `hsCreateContact` (3555) | Zakłada kontakt, z czytelnym komunikatem gdy Worker nie ma endpointu | DZIAŁA | Niewidocznie |
| `dxHsStatus` (3524) | Pokazuje status synchronizacji w pasku oferty | DZIAŁA | Tak — widzi, czy deal wpadł |
| kasowanie `currentLeadHsId` przy ręcznej edycji (3670) | Zapobiega przypisaniu oferty do poprzedniego leada | DZIAŁA | Niewidocznie, dobre |
| `injectPicker` — „Ofertę wystawia" (6888) | Wybór handlowca, zapamiętany w localStorage | DZIAŁA | Tak, raz na urządzenie |
| `findDealByName` + `setOwner` (6928) | Odnajduje świeżą transakcję i przypisuje właściciela osobnym PATCH-em | DZIAŁA | Niewidocznie |

**Realny problem: duplikaty transakcji.** Zabezpieczenie przed podwójnym zapisem
to `key = contactId + '|' + dealname + '|' + amount` (3635), a `dealname` zawiera
`projectNo`, który jest budowany z **aktualnej godziny i minuty**
(`DX/2026/0813-1432`, linia 4611). Każde ponowne wejście w krok 5 po zmianie minuty
generuje nowy numer → nową nazwę → **nowy deal**. Sprzedawca, który poprawi jedną
pozycję i wyśle ponownie, ma w HubSpocie dwie transakcje na tego samego klienta.
Właściciel jest wtedy przypisywany do tej, którą `deals-search` zwróci pierwszą.

### K. Umowa DOCX

| Funkcja | Co robi | Stan | Sprzedawca użyje? |
|---|---|---|---|
| `generateContract` (4035) | Generuje pełną umowę B2C: 12 paragrafów, kosztorys, 4 załączniki, logo, 30/70 | **MARTWE — nie ma z czego kliknąć** | **Nie, choć bardzo by chciał** |
| `MiniZip` (3916) | Własny, od zera napisany generator ZIP-a (CRC32, central directory) | MARTWE razem z powyższym | Nie |
| `wp` / `wpar` / `wheading` / `wtable` / `wpagebreak` (3981–4025) | Warstwa do budowania OpenXML | MARTWE razem z powyższym | Nie |

To jest **najboleśniejsze znalezisko w całym audycie**. Około 400 linii poważnej,
merytorycznej pracy — umowa z prawem odstąpienia, zastrzeżeniem własności, ryzykiem
geologicznym, warunkiem prekluzyjnym gwarancji, zakazem wygrzewania, załącznikami
1–4 zgodnymi z ustawą o prawach konsumenta. Wszystko gotowe. Jedyny przycisk, który
to uruchamiał, stoi w linii 1585 — w HTML-u kroku 5, który jest **kasowany** przy
każdym wejściu. Nowy pasek narzędzi (linia 4937) ma cztery przyciski: „Edytuj
kosztorys", „Drukuj", „Zapisz PDF", „Wyślij ofertę". Umowy nie ma.

Naprawa to jeden przycisk w `buildHtml`. Efekt: sprzedawca przestaje pisać umowy ręcznie.

### L. Warstwa UI / redesign

| Funkcja | Co robi | Stan | Sprzedawca użyje? |
|---|---|---|---|
| `renderDxSteps` (5909) | Pasek kroków z nazwami, klikalny wstecz | DZIAŁA | Tak |
| `updateDxSummary` (5970) | Boczny panel „Podsumowanie projektu", klikalny do danego kroku | DZIAŁA | Tak — dobra rzecz przy kliencie |
| `markStepNavs` (6009) | Przyklejona nawigacja na telefonie | DZIAŁA | Tak, w terenie |
| `applyDewaxBranding` (5726) | Podmiana kolorów / fontu | DZIAŁA | Kosmetyka |
| `stripEmoji` (5989) | Usuwa emoji z przycisków i etykiet **po** wyrenderowaniu | DZIAŁA | Nie zauważy |
| `updateProgress` (2149) | Rysuje 5 starych kropek postępu | **KALEKIE** — `renderDxSteps` nadpisuje to samo `innerHTML` sekundę później | Nie |
| `cardHtml` (5953) | Kafelek podsumowania | DZIAŁA (przekazywany do `.map`) | Niewidocznie |

`stripEmoji` to dobra ilustracja stanu pliku: w HTML-u są emoji („🚿 Gospodarstwo
domowe", „💡", „🔧", „🚚"), a osobny skrypt lata po DOM-ie i je wycina. Zamiast usunąć
je ze źródła. Tak samo `updateProgress` — rysuje kropki, żeby inna funkcja natychmiast
je zamalowała.

### M. Martwe pozostałości poprzednich wersji oferty

| Co | Gdzie | Dlaczego martwe |
|---|---|---|
| Cały HTML kroku 5 (238 linii) | 1355–1592 | Nadpisany przez `root.innerHTML` |
| `generateReport` (stara, 300 linii) | 3015–3314 | Nadpisana przez `window.generateReport` |
| `polishOfferLayoutV3` + jego IIFE | 4310–4342 | Owija funkcję, która została wyrzucona |
| `polishOfferLayoutV5` + jego IIFE | 4344–4390 | To samo |
| `buildKosztorys` | 3319 | Wołane tylko ze starej `generateReport` |
| `updateVatDisplay` (obie wersje) | 3344, 4995 | Nowa oferta nie ma selecta VAT |
| ukryte pola `rep*` i `marketing*` | 1365–1386 | `display:none`, zapisywane przez martwy kod |
| `pobeChartContainer` + wykres porównania paliw | 1366, 3260–3276 | Rysowany do kontenera `display:none` |
| ceny paliw: `priceGas`, `pricePellet`, `priceCoal`, `effGas`, `effPellet`, `effCoal`, `effCwuGas/Pellet/Coal` | 1609–1623 | Czytane tylko przez martwą `generateReport` |
| `paybackYears` | 3240 | Wyliczane, nigdzie nie użyte |
| `cwuCatalog`, `selectedCwuObj` | 1603, 1856 | Zadeklarowane, zero odwołań |
| `#logs` — panel „Bilans / Oszczędność / RAZEM" | 1568, 3278–3310 | Kasowany z resztą kroku 5 |
| `fmtMoney`, `setText`, `ceilTo`, `cleanPhone`, `updateInsulationDesc`, `specRows` | różne | Zero wywołań |
| CSS `.thermokrafft-offer-v5` — 48 selektorów | pierwszy `<style>` | Klasa jest dodawana przez martwą `polishOfferLayoutV5` |
| CSS `.print-only` / `.offer-*` — 52 wystąpienia | pierwszy `<style>` | Dotyczą skasowanego HTML-u |
| drugi `jspdf.umd.min.js` | linia 11 | Ta sama biblioteka wczytana dwa razy |

Uczciwie: **1 590 linii z 7 025 (≈ 23 %) nie wykonuje się nigdy.**

---

## DO WYWALENIA

Bez ryzyka, w tej kolejności.

**Poziom 1 — czysta strata, zero konsekwencji (~1 000 linii)**

1. `polishOfferLayoutV3` + `polishOfferLayoutV5` + oba ich IIFE (4310–4390). Owijają funkcję, której już nie ma.
2. `generatePdfAndOpenEmail_OLD_GMAIL` (3679–3718) i `generatePdfAndOpenEmail_LEGACY_OLD_GMAIL` (3721–3831). Autor sam napisał nad nimi „NIEUŻYWANE".
3. Stara `buildOfferPdf` (3402–3496) i stara `savePdfOnly` (3499–3517).
4. Stara `generateReport` (3015–3314) razem z `buildKosztorys` (3319–3342), starą `updateVatDisplay` (3344–3398) i `prefillEmailBody` (3833–3860).
5. `updateInsulationDesc`, `ceilTo`, `cleanPhone`, `fmtMoney`, `specRows`, `paybackYears`, `cwuCatalog`, `selectedCwuObj`.
6. Drugie wczytanie jsPDF (linia 11).

**Poziom 2 — martwy HTML i CSS (~700 linii)**

7. Cały statyczny HTML kroku 5 (1355–1592) poza tagiem `<div id="step5">`. Razem z nim: ukryte pola `rep*` / `marketing*`, `#pobeChartContainer`, `#logs`, `#kosztorysTable`, `#projDaneTable`, `#wydajnoscTable`, stopka z podpisami, sekcja ważności, stary pasek przycisków.
8. Reguły CSS na `.thermokrafft-offer-v3`, `.thermokrafft-offer-v5`, `.offer-*`, `.print-only`, `.tk-v3-logo`, `.tk-v5-logo` w pierwszym bloku `<style>`.
9. Emoji ze wszystkich etykiet, przycisków i nagłówków kroków 1–4 — i wtedy `stripEmoji` (5989) też do wyrzucenia.
10. `updateProgress` (2149) — `renderDxSteps` robi to samo i lepiej.

**Poziom 3 — decyzja produktowa, nie techniczna**

11. **Ceny paliw i cała maszyneria porównania kosztów** (`priceGas`, `pricePellet`, `priceCoal`, `effGas/Pellet/Coal`, `effCwuGas/Pellet/Coal`, `costGas/Pellet/Coal`, wykres słupkowy). Ktoś to celowo wyciszył — `marketingMonthlyCost`, `marketingSavings`, `marketingPayback` są ustawiane na pusty string (3251–3255), a w komentarzu stoi „Oferta = dobór techniczny, BEZ szacunków kosztów eksploatacji". **Albo to wróci do oferty jako świadoma sekcja, albo wylatuje.** Trzymanie tego w połowie to najgorszy z trzech możliwych stanów: dane są nieaktualne (II kw. 2026), nikt ich nie widzi, a wyglądają jakby działały.
12. **Buderus** — albo dopisać `specs` do 16 modeli i naprawić `comparisonTable`, albo usunąć przełącznik i 16 pozycji z katalogu. Teraz to obietnica, której kreator nie dowozi.
13. **13 modeli TKW / TKWD** — jeśli naprawdę są wycofane, poza wyborem ręcznym nie mają po co być w katalogu.

**Czego NIE ruszać**

`generateContract`, `MiniZip` i cała warstwa `w*` do OpenXML. Są martwe **wyłącznie
dlatego, że zniknął przycisk**. To nie do usunięcia — to do podłączenia.

---

## DZIURY

Czego brakuje, żeby wystawić ofertę od A do Z. Kolejność = ile boli.

### 1. Nie ma przycisku do umowy

Kreator kończy się na PDF-ie i mailu. Gotowa, dopracowana umowa DOCX leży w pliku
i jest nieosiągalna. Sprzedawca dowozi ofertę i **wraca do Worda**.
Koszt naprawy: jeden `<button onclick="generateContract()">` w `buildHtml` (4937).
To najtańsza duża wygrana w całym pliku.

### 2. Nic nie jest zapisywane — F5 kasuje całą pracę

Formularz, wybrane dolne źródło, ilości, ceny osprzętu, wybrana pompa — wszystko
żyje w zmiennych w pamięci. Odświeżenie strony, zaśnięcie telefonu, przypadkowy
back — i konfiguracja klienta znika. W localStorage siedzą tylko: kod dostępu,
lista obdzwonionych i wybrany handlowiec. Brak:

- autozapisu konfiguracji (choćby jeden `localStorage` na `beforeunload`),
- historii wystawionych ofert („co wysłałem Kowalskiemu 3 tygodnie temu?"),
- możliwości odtworzenia oferty z HubSpota.

### 3. Numer oferty zmienia się co minutę → duplikaty w CRM

`projectNo` = `DX/rok/MMDD-GGmm`. Nie jest ani stabilny, ani sekwencyjny, ani unikalny
w skali firmy (dwie osoby o 14:32 dostaną ten sam). Skutki: ponowna wysyłka = nowy
deal w HubSpocie; klient dostaje dwie oferty o różnych numerach z tą samą treścią;
nie da się powiedzieć „proszę powołać się na numer oferty".
Potrzebny licznik po stronie Workera albo numer zapisany przy pierwszym wygenerowaniu.

### 4. Dane poprzedniego klienta wchodzą do oferty następnego

Trzy niezależne wycieki stanu przy zmianie leada:

- `dzOverride` — ręcznie wpisane metry/sztuki (jest żółty przycisk, ale trzeba go kliknąć),
- `extrasState` — poprawione ceny i odznaczone pozycje,
- `window.__dxCwuAuto` — auto-dobór CWU odpala się tylko dla pierwszego klienta w sesji.

`fillLead` i `autoFillFromLead` czyszczą `currentLeadHsId`, ale nie ruszają konfiguracji.
Brakuje jednego `resetConfig()` wołanego przy każdej zmianie klienta.

### 5. Grzejniki = brak doboru

Opisane w części F. Katalog R290 ma B0/W35, W10/W35 i W10/W45. Nie ma **B0/W45** —
czyli grunt + grzejniki, najczęstsza modernizacja w Polsce. Kod świadomie nie
interpoluje i uczciwie pisze „BRAK DANYCH", ale sprzedawca zostaje z ofertą bez COP,
bez zużycia w punkcie pracy i ze statusem „wymaga potwierdzenia technicznego".
Potrzebne dane producenta dla B0/W45, ewentualnie B0/W55.

### 6. Zero finansowania w ofercie

Landing Thermokraffta obiecuje **do 21 000 zł z „Moje Ciepło"** i ulgę
termomodernizacyjną. W ofercie z kreatora nie ma o tym ani słowa. Nie ma:

- kwoty dotacji ani warunków (nowy dom, klasa A++, KDR 45 %),
- ulgi termomodernizacyjnej (53 000 zł podstawy),
- kosztu netto **po** dofinansowaniu — czyli jedynej liczby, o którą klient pyta,
- leasingu ani kredytu.

Klient widzi „do zapłaty brutto: 92 000 zł" i nie dowiaduje się, że realnie wyjdzie
kilkadziesiąt tysięcy mniej. Najdroższa merytoryczna dziura w całym dokumencie.

### 7. Brak warunków płatności w ofercie

Umowa DOCX ma 30 % zaliczki / 70 % po odbiorze. Oferta — nic. Klient dowiaduje się
o harmonogramie płatności dopiero przy podpisie. To zły moment na taką informację.

### 8. VAT 23 % „firma / B2B" bez danych do faktury

Można wybrać stawkę B2B, ale nie ma gdzie wpisać nazwy firmy, NIP-u ani adresu
siedziby. Umowa DOCX jest napisana wyłącznie pod konsumenta (PESEL, prawo
odstąpienia, „Niezgodność Towaru z Umową"). Wybór 23 % jest więc wyborem stawki,
a nie trybu sprzedaży — dokumentów B2B kreator nie umie zrobić.

### 9. Chłodzenie jest w katalogu, ale nie da się go sprzedać

Każda pompa R290 ma w katalogu `cooling: {kw, eer, pin}`, plakietka w ofercie mówi
„CO / CWU, chłodzenie opcjonalne", a landing sprzedaje „darmową klimatyzację".
Nigdzie nie da się wybrać chłodzenia pasywnego ani aktywnego, wycenić go
(zaworów, klimakonwektorów, sterowania) ani pokazać jego mocy w ofercie.
Argument sprzedażowy leży w danych i nie ma jak wyjść na papier.

### 10. Brak rabatu i braku widoku marży

Ceny da się edytować pozycja po pozycji — i to jest cała negocjacja. Nie ma:

- linii rabatu na całość („−5 000 zł przy decyzji do końca miesiąca"),
- widoku marży ani ceny zakupu, więc sprzedawca nie wie, kiedy schodzi pod koszt,
- limitu, poniżej którego trzeba pytać przełożonego.

### 11. Ważność oferty bez daty

W ofercie stoi „ważna 7 dni od daty wystawienia". Data wystawienia jest w nagłówku,
ale konkretna **data wygaśnięcia** nie jest nigdzie policzona. „Oferta ważna do
20.08.2026" działa lepiej niż „7 dni".

### 12. Wysłanie oferty nie zostawia śladu na leadzie

`setHandled` zapisuje `hs_lead_status: OBDZWONIONY`, ale po wysłaniu oferty status
kontaktu się nie zmienia. Powstaje deal, natomiast na samym leadzie nie widać, że
oferta poszła. Brakuje statusu „oferta wysłana" i daty.

### 13. Adres inwestycji przychodzi z HubSpota jako województwo

`p.state || p.city || p.zip` (2062). Właściwość `address` nie jest czytana.
Sprzedawca za każdym razem przepisuje adres ręcznie — a od tego adresu zależy
pobranie geologii z PIG-PIB, czyli najlepsza część oferty.

### 14. PDF to obrazki

Cztery–pięć rastrowych JPEG-ów w kopercie PDF. Nie da się zaznaczyć tekstu,
skopiować kwoty, kliknąć maila, znaleźć oferty po nazwie modelu w wyszukiwarce
plików. Klient nie może wkleić pozycji do arkusza porównawczego. Działa, wygląda
dobrze, ale to skan.

### 15. Kaskada bez zdjęcia

`pumpImage` (4642) sprawdza `m.units`, a obiekt kaskady ma `m._units` (2707).
Jedna litera. Oferta na kaskadę wychodzi z pustym miejscem po zdjęciu.

---

## Podsumowanie w trzech zdaniach

Kreator **działa** i realnie wystawia dobrą ofertę: kalkulator jest przejrzysty,
silnik dolnego źródła jest jeden i spójny, geologia z PIG-PIB to prawdziwa
przewaga, a kontrola poprawności doboru jest uczciwsza niż u konkurencji.

Kosztem tego, że plik to sześć warstw poklejonych bez usuwania poprzednich —
23 % kodu jest martwe, a wśród martwych rzeczy leży gotowa umowa DOCX, której
brakuje tylko przycisku.

Do sprzedaży od A do Z brakuje przede wszystkim trzech rzeczy: **umowy jednym
klikiem**, **dofinansowania w ofercie** i **czegokolwiek, co przetrwa odświeżenie
strony**.
