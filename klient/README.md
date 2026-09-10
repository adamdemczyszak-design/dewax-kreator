# Konfigurator kliencki DEWAX (pompy.dewax.pl)

Publiczna, bezhasłowa wersja kreatora pomp ciepła dla klientów końcowych.
Osobna strona Netlify (`dewax-pompy`) budowana z katalogu `klient/` tego
repozytorium. Kreator zespołowy (`index.html` w katalogu głównym, strona
`dewax-kreator` za bramą HTTP Basic) pozostaje bez zmian.

## Jak to działa

```
przeglądarka klienta (klient/src/index.html, statyczny HTML)
   |  POST /api/zgloszenie  (konfiguracja + 4 pytania + kontakt + UTM)
   v
funkcja Netlify klient/netlify/functions/zgloszenie.mjs
   |- liczy widełki (klient/lib/wycena.mjs, cennik z kreatora zespołowego)
   |- HubSpot: worker dewax-hubspot  -> /search, /contact, PATCH /contact/{id},
   |                                    /deal, /deal/{id}/note   (jak kreator zespołu)
   |- mail do biura i do klienta: worker dewax-send (Resend)
   |- SMS do handlowca: webhook Make -> SMSAPI
   |- link powrotny: stan zaszyfrowany AES-GCM (LINK_SECRET), ?k=...
   v
przeglądarka: widełki od-do, przycisk "Chcę dokładną wycenę"
   |  POST /api/termin (token + dzień + okno godzinowe)
   v
funkcja termin.mjs: notatka i następny krok w HubSpocie, mail do biura, SMS
```

Ceny jednostkowe są wyłącznie w `lib/wycena.mjs` (serwer). Do przeglądarki
trafiają gotowe widełki.

## Zmienne środowiskowe (panel Netlify projektu `dewax-pompy`)

| Nazwa | Rola | Sekret? |
|---|---|---|
| `DEWAX_AUTH_TOKEN` | kod dostępu do workera `dewax-hubspot` (X-Dewax-Auth) | tak |
| `DEWAX_SEND_TOKEN` | kod dostępu do workera `dewax-send` (AUTH_TOKEN_SEND) | tak |
| `LINK_SECRET` | klucz szyfrowania linku powrotnego, min. 32 znaki losowe | tak |
| `MAKE_WEBHOOK` | adres webhooka Make (scenariusz SMS) | tak |
| `SMS_DO` | numer handlowca do SMS-ów, format `+48XXXXXXXXX` | nie |
| `META_PIXEL_ID` | identyfikator Meta Pixel; pusty = pixel nie ładuje się | nie |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET` | Cloudflare Turnstile (opcjonalnie); bez nich formularz działa, chroni go honeypot i limit IP | site key nie, secret tak |
| `ALERT_EMAIL` | adres na zgłoszenia, domyślnie `biuro@dewax.pl` | nie |
| `HANDLOWIEC` | wartość pola `dewax_handlowiec` w HubSpocie, domyślnie `Daria` | nie |
| `HUBSPOT_OWNER_ID` | właściciel transakcji, domyślnie `76509862` (konto Adama, jak w kreatorze) | nie |
| `HUBSPOT_ETAP` | etap transakcji, domyślnie `appointmentscheduled` („Nowy lead") | nie |

Zmiana zmiennej działa dopiero po nowym wdrożeniu (Deploys -> Trigger deploy).
Funkcje czytają zmienne w czasie wykonania, ale `META_PIXEL_ID` i
`TURNSTILE_SITE_KEY` wstawia build, więc wymagają wdrożenia.

## Ustawienia projektu Netlify

- Repozytorium: `adamdemczyszak-design/dewax-kreator`, gałąź produkcyjna `main`
- Base directory: `klient`
- Build command: `npm run build`
- Publish directory: `klient/dist`
- Functions directory: `klient/netlify/functions`
- Brak bramy hasłowej i SSO (strona publiczna)

Te same wartości są w `klient/netlify.toml`, panel musi mieć tylko katalog
bazowy `klient`, resztę czyta z pliku.

## Lokalnie

```
cd klient
npm install
npm test                    # testy cennika
npm run build               # dist/
MOCK_USLUGI=1 npm start     # http://localhost:8788 z atrapami workerów i Make
```

## Domena

Docelowo `pompy.dewax.pl` (dziś: strona marketingowa na nazwa.pl, patrz raport
wdrożenia - zmiana rekordu wyłączy tamtą stronę). Rekord CNAME i alternatywa
(`wycena.dewax.pl`) są w raporcie końcowym.
