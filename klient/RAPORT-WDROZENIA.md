# Raport: konfigurator kliencki DEWAX (pompy.dewax.pl)

Data: 10.09.2026. Gałąź: `claude/dewax-client-configurator-hetpaz`, katalog `klient/`.

## 1. Adres testowy i co działa

Projekt Netlify **`dewax-pompy`** (https://dewax-pompy.netlify.app) jest utworzony
i ma wpisane zmienne środowiskowe, ale **nie ma jeszcze wdrożenia**: sieć tego
środowiska nie przepuszcza połączeń do Netlify ani do workerów Cloudflare, więc
ani ręczne wgranie, ani test na żywo nie były możliwe stąd. Pierwsze wdrożenie
to jedno kliknięcie w panelu (punkt 3, pozycja 1). Po nim adres testowy działa
od razu, bez zmian w kodzie.

Co zostało sprawdzone lokalnie (testy jednostkowe cennika: 8/8, test
przeglądarkowy Chromium w szerokości 390 px z atrapami workerów i Make):

- pięć kroków: dom (m2, stan budynku, ogrzewanie), pompa Thermokrafft TK
  (cztery modele R290, polecany oznaczony), dolne źródło (odwierty pionowe,
  HELIX, kolektor poziomy), cztery pytania kwalifikacyjne, dane kontaktowe ze
  zgodą RODO i linkiem do polityki prywatności,
- widełki od-do pojawiają się dopiero po wysłaniu danych; liczone są na
  serwerze z cennika kreatora zespołowego (ceny netto pomp, 140 zł/mb odwiertu,
  2500 zł/sonda HELIX, 40 zł/mb kolektora, montaż 6000, zasobnik CWU 2600,
  VAT 8% od każdej pozycji), przeglądarka nie dostaje cennika,
- „Chcę dokładną wycenę": wybór dnia (5 dni roboczych) i okna godzinowego,
- link powrotny w mailu (`?k=...`, stan zaszyfrowany AES-GCM) otwiera zapisaną
  konfigurację z danymi kontaktowymi bez ponownego wypełniania,
- Meta Pixel: `PageView` przy wejściu, `Lead` po wysłaniu danych, `Schedule`
  po wyborze godziny; identyfikator z `META_PIXEL_ID`, bez ID blok pixela
  znika z HTML,
- UTM (`utm_source/medium/campaign/content/term`, `fbclid`) z adresu wejścia
  pamiętane w sesji i wysyłane ze zgłoszeniem,
- walidacja po sztywnej liście pól (nieznane pole = 400), honeypot, limit
  5 zgłoszeń na godzinę z jednego IP (Netlify Blobs), opcjonalny Turnstile,
- nagłówki bezpieczeństwa (CSP, HSTS, X-Frame-Options DENY, Referrer-Policy
  no-referrer, Permissions-Policy), stopka z pełnymi danymi KSH, logo DEWAX,
- strona nie przewija się w bok na 390 px, brak pauz długich w tekstach
  (build to sprawdza i przerywa wydanie).

Kreator zespołowy: `index.html`, `netlify.toml` i brama `auth.ts` w katalogu
głównym są nietknięte. Strona `dewax-kreator` działa jak dotąd.

## 2. HubSpot i Make: co zrobiono i jak to sprawdzić

**Jak kreator zespołowy zapisuje dziś do HubSpota (ustalone z kodu).** Nie przez
`/auth`, `/outcome`, `/setup` (to ścieżki kokpitu crmdewax), tylko przez worker
`dewax-hubspot` z nagłówkiem `X-Dewax-Auth`: `POST /search` (szukanie kontaktu
po e-mailu, telefonie, 9 ostatnich cyfrach), `POST /contact` (nowy kontakt),
`POST /deal` (transakcja z `contactId`, `dealname`, `amount`,
`hubspot_owner_id` = 76509862, konto Adama; worker ustawia etap
`qualifiedtobuy` gdy nie podano). Kod źródłowy workera leży w repozytorium
`dewax-crm/workers/dewax-hubspot/worker.js`.

**Wersja kliencka idzie tą samą drogą** (funkcja `klient/netlify/functions/zgloszenie.mjs`):

1. kontakt: `/search` po e-mailu i telefonie, gdy brak: `POST /contact`
   (`firstname`, `lastname`, `email`, `phone`, `lifecyclestage=lead`),
2. `PATCH /contact/{id}` z polami, które w portalu już są:
   `dewax_adres_inwestycji`, `dewax_powierzchnia_grzewcza`,
   `dewax_handlowiec=Daria`, `hs_lead_status=NEW`,
3. drugi `PATCH` z polami, których w portalu **jeszcze nie ma** (sprawdzone
   przez API: `dewax_zrodlo_leada`, `dewax_utm_source`, `dewax_utm_medium`,
   `dewax_utm_campaign`, `dewax_utm_content`, `dewax_fbclid`,
   `dewax_wycena_id`, `dewax_wersja_cennika`). Zakłada je jednorazowe
   `POST /setup` workera `dewax-hubspot` (klucz `SETUP_KEY`, ma go Adam). Do
   tego czasu ten zapis kończy się błędem, który nie przewraca zgłoszenia,
   a UTM i tak trafiają do opisu transakcji i do notatki,
4. `POST /deal`: nazwa `Imię - konfigurator, 150 m2, Thermokrafft TK-G2S`,
   kwota = środek widełek, waluta PLN, etap `appointmentscheduled`
   („Nowy lead"), właściciel 76509862, opis z widełkami, odpowiedziami
   kwalifikacyjnymi i UTM,
5. `POST /deal/{id}/note`: pełna konfiguracja słowo w słowo, zgoda z datą
   i IP, link powrotny.
6. Po wyborze godziny (`termin.mjs`): notatka na transakcji, na kontakcie
   `dewax_nastepny_krok="Telefon do klienta: 14.09.2026, 12:00-14:00"` i
   `dewax_data_nastepnego_kontaktu`.

Jak sprawdzić: po pierwszym zgłoszeniu testowym w HubSpocie (portal 49004516)
pojawia się kontakt z `DEWAX handlowiec = Daria` i transakcja
„... - konfigurator ..." w etapie „Nowy lead" z notatką.

**Make.** Utworzony webhook **„DEWAX konfigurator klienta - SMS"** (id 4367182,
adres wpisany w Netlify jako `MAKE_WEBHOOK`) i scenariusz **9791484 „DEWAX
konfigurator klienta - SMS do handlowca"**: webhook -> SMSAPI „Send a Text
Message" (połączenie 5965771), odbiorca `{{do}}`, treść `{{tresc}}`, filtr
„jest numer odbiorcy". Scenariusz jest **aktywny**. Funkcja wysyła dwa SMS-y:
po zgłoszeniu („Nowy lead z konfiguratora: imię, tel., m2, widełki, godzina
jeszcze nie wybrana") i po wyborze godziny („Klient prosi o telefon: imię,
tel., termin, widełki"). Numer odbiorcy funkcja bierze ze zmiennej `SMS_DO`
(patrz punkt 3). Jak sprawdzić: Make -> scenariusz 9791484 -> History; każde
zgłoszenie z konfiguratora to jedno wykonanie. Uwaga: połączenie SMSAPI
w Make nosi nazwę „Basic (Deprecated)", ostatnie użycie w marcu 2026; jeśli
SMS nie wyjdzie, trzeba odświeżyć połączenie w Make.

**Maile.** Przez worker `dewax-send` (Resend, nadawca ustawiony w workerze,
reply-to `biuro@dewax.pl`): do biura pełna konfiguracja (plus lista braków
zapisu, jeśli były), do klienta widełki z rozbiciem i linkiem powrotnym.
Wywołania idą z serwera Netlify, bez nagłówka Origin przeglądarki, więc
`ALLOWED_ORIGIN` workera ich nie blokuje; adres strony i tak warto dopisać.

**CRM DEWAX (crmdewax.netlify.app).** Zdarzenie „konfiguracja wysłana" jest już
widoczne pośrednio: nowa transakcja w etapie „Nowy lead" z nazwą zawierającą
„konfigurator" oraz notatka w historii kontaktu (`/contact/{id}/history`).
Żeby kokpit oznaczał takie leady wprost, potrzebna jest zmiana w
`dewax-crm/index.html` (NIE wykonana, do zgody):

- w liście właściwości pobieranych dla kontaktów (ok. linia 1868,
  `properties: ['firstname','lastname','phone','email','createdate',...`)
  dopisać `dewax_zrodlo_leada`,
- w bloku plakietek karty leada (ok. linie 928-932, `<div class="badges">`)
  dodać plakietkę „konfigurator" gdy
  `p.dewax_zrodlo_leada === 'konfigurator klienta'`,
- warunek: pole `dewax_zrodlo_leada` musi istnieć w portalu (jednorazowe
  `POST /setup` workera `dewax-hubspot`, patrz wyżej).

## 3. Czego nie dało się zrobić bez Adama lub Małgorzaty

1. **Adam: pierwsze wdrożenie i CD.** W panelu Netlify projektu `dewax-pompy`
   (Project configuration -> Build & deploy -> Link repository) podpiąć
   `adamdemczyszak-design/dewax-kreator`, Base directory `klient`, gałąź
   `main` (albo na test: `claude/dewax-client-configurator-hetpaz`); build
   command i publish czyta `klient/netlify.toml`. Nie da się tego zrobić przez
   API dostępne w tej sesji, a sieć środowiska blokuje netlify.com.
2. **Adam: kod do wysyłki maili.** Zmienna `DEWAX_SEND_TOKEN` na `dewax-pompy`
   nie jest ustawiona, bo wartości sekretu `AUTH_TOKEN_SEND` workera
   `dewax-send` nie ma w żadnym panelu Netlify, do którego mam dostęp (jest
   tylko w Cloudflare). Bez niej maile do biura i do klienta nie wychodzą,
   a funkcja zgłasza to w logu.
3. **Adam: numer Darii.** Zmienna `SMS_DO` (format `+48XXXXXXXXX`) nie jest
   ustawiona, bo numeru Darii nie ma w żadnym repozytorium ani panelu i nie
   wolno go zgadywać; bez niej SMS-y są pomijane.
4. **Adam: `POST /setup` na workerze `dewax-hubspot`** (nagłówek
   `X-Setup-Key`), bo klucz `SETUP_KEY` jest tylko w Cloudflare; zakłada pola
   UTM i `dewax_zrodlo_leada`, bez których źródło reklamy nie zapisze się
   w polach kontaktu (zostaje w opisie transakcji i notatce).
5. **Adam: potwierdzenie kodu `DEWAX_AUTH_TOKEN`.** Na `dewax-pompy` wpisano
   tę samą wartość, jaką ma `crmdewax` i `dewax-kreator`; czy zgadza się
   z aktualnym `AUTH_TOKEN_HUBSPOT` workera, sprawdzi dopiero pierwsze
   zgłoszenie (worker jest nieosiągalny z tego środowiska).
6. **Adam: identyfikator Meta Pixel.** Wpisano `1032857169399673` (jedyny
   zestaw danych „dewax.pl" widoczny w firmie Dewax, 159657032930324). Konto
   reklamowe „Dewax gruntowe pompy ciepła" (955522616312255, firma
   „Gruntowe pompy ciepła") nie jest dostępne przez API, więc jeśli kampanie
   idą z niego i ma własny pixel, trzeba podmienić `META_PIXEL_ID`.
7. **Adam: `ALLOWED_ORIGIN` w workerach** `dewax-send` i `dewax-hubspot`
   dopisać `https://dewax-pompy.netlify.app` i docelową domenę (panel
   Cloudflare, brak dostępu z tej sesji).
8. **Adam: decyzja o domenie.** `pompy.dewax.pl` to dziś żywa strona
   marketingowa (repozytorium `adamdemczyszak-design/pompy.dewax.pl`,
   15 podstron SEO, GA4, formularz PHP), wdrażana FTP-em na nazwa.pl.
   Przełączenie rekordu na Netlify wyłączy tę stronę w całości. Bezpieczna
   alternatywa: `wycena.dewax.pl` albo link „Konfigurator" ze strony
   marketingowej do adresu Netlify. Rekordy dla obu wariantów są w punkcie 4.
9. **Małgorzata: rekord DNS** w panelu nazwa.pl (punkt 4), a Adam dodaje tę
   domenę w Netlify (Domain management -> Add domain), bo bez tego Netlify
   nie wystawi certyfikatu.
10. **Adam: Turnstile (opcjonalnie).** Cloudflare -> Turnstile -> widżet dla
    domeny konfiguratora, Site key do `TURNSTILE_SITE_KEY`, Secret do
    `TURNSTILE_SECRET`; bez tego działa honeypot i limit IP.
11. **Adam: górna granica widełek.** „Do" liczone jest dla gruntu słabszego
    (30 W/mb odwiertu, 14 W/m2 kolektora, 0,5 kW/sonda HELIX) - to
    założenie konfiguratora zapisane w `klient/lib/wycena.mjs`
    (`ZALOZENIA.gruntSlabszy`), do potwierdzenia albo zmiany.
12. **Adam: zmiana w CRM** z punktu 2 (plakietka „konfigurator"), wymaga
    zgody i osobnego wdrożenia crmdewax.

## 4. Rekord DNS dla nazwa.pl

Instrukcja dla Małgorzaty Kuś (do skopiowania):

> Pani Małgorzato, proszę zalogować się do panelu **admin.nazwa.pl**, wejść w
> **Domeny -> dewax.pl -> Konfiguracja DNS** (strefa DNS domeny dewax.pl) i
> dodać jeden rekord:
>
> | Typ | Nazwa (host) | Wartość (cel) | TTL |
> |---|---|---|---|
> | CNAME | `pompy` | `dewax-pompy.netlify.app.` | 3600 |
>
> Jeśli dla nazwy `pompy` istnieje już rekord A (adres 85.128.139.207,
> obecna strona), trzeba go **najpierw usunąć**, bo CNAME nie może istnieć
> obok rekordu A. UWAGA: ten krok wyłącza obecną stronę pompy.dewax.pl.
> Proszę wykonać go dopiero po potwierdzeniu od Adama.
>
> Wariant bezpieczny (nowa nazwa, obecna strona zostaje):
>
> | Typ | Nazwa (host) | Wartość (cel) | TTL |
> |---|---|---|---|
> | CNAME | `wycena` | `dewax-pompy.netlify.app.` | 3600 |
>
> Po zapisaniu rekordu proszę dać znać Adamowi, że rekord jest wpisany.
> Zmiana rozchodzi się do godziny.

Uwaga dla Adama: w Netlify (projekt `dewax-pompy` -> Domain management) trzeba
dodać tę samą nazwę domeny; certyfikat Let's Encrypt wystawi się sam po
rozejściu się rekordu. Kod strony nie wymaga zmian przy zmianie domeny:
adres bierze ze zmiennej `URL`, którą Netlify ustawia na domenę główną.
