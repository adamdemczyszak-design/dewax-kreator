# Dlaczego oferty nie docierają do klientów

Handlowcy meldują, że kreator pisze „oferta wysłana", a klient maila nie
dostaje. Ten dokument prowadzi od objawu do przyczyny.

Zacznij od przycisku **„Sprawdź połączenie"** w podglądzie oferty (krok 5,
obok „Wyślij ofertę"). Sprawdza obie bramki kreatora i mówi wprost, co jest
zepsute. Poniżej opis każdego przypadku.

---

## Skąd w ogóle wzięło się nieporozumienie

Kreator kończył pracę na odpowiedzi workera. Worker odpowiada „ok", gdy
**przyjmie zlecenie** — a nie gdy list wyląduje w skrzynce klienta. Między
jednym a drugim jest cała droga, na której poczta może list odrzucić.
Kreator tej drogi nie widział i pisał „wysłana", cokolwiek się dalej działo.

Zmienione:

- komunikat po wysyłce brzmi **„przekazana do wysyłki"**, a nie „wysłana",
- pod treścią maila jest **kronika doręczeń** — co, do kogo, kiedy i z jakim
  skutkiem,
- „doręczona" pojawia się dopiero, gdy potwierdzi to dostawca poczty.

Do działania kroniki potrzebny jest endpoint `GET /status/{id}` w workerze
`dewax-send`. Gotowy kod: **`worker/dewax-send.js`**. Bez niego kreator
napisze wprost, że nie wie, czy oferta doszła — zamiast udawać, że doszła.

---

## Najczęstsza przyczyna: domena nadawcy

Jeśli w kronice widzisz **„ODRZUCONA przez serwer klienta"**, albo oferty
lądują klientom w spamie, problem jest po stronie uwierzytelniania poczty.
Poczta odbiorcy sprawdza, czy nadawca ma prawo pisać w imieniu `dewax.pl`.
Bez tych rekordów list trafia do spamu albo znika bez śladu.

1. Wejdź na [resend.com/domains](https://resend.com/domains) i sprawdź, czy
   `dewax.pl` ma status **Verified**. Status „Pending" oznacza, że listy
   wychodzą, ale nie mają jak się uwierzytelnić.
2. Resend pokazuje rekordy do wpisania w DNS domeny `dewax.pl`
   (u operatora, u którego trzymacie domenę):
   - **DKIM** — rekord `TXT`, podpis kryptograficzny wiadomości,
   - **SPF** — rekord `TXT` z `include:` wskazanym przez Resend; jeśli macie
     już SPF (np. od Google Workspace), **nie dodawaj drugiego** — dopisz
     `include:` do istniejącego. Dwa rekordy SPF unieważniają oba.
   - **MX** dla subdomeny wysyłkowej, jeśli Resend o niego prosi.
3. Sprawdź `DMARC` — rekord `TXT` na `_dmarc.dewax.pl`. Przy polityce
   `p=reject` bez poprawnego SPF i DKIM **wszystkie** oferty są odrzucane po
   cichu. To wygląda dokładnie tak, jak opisują handlowcy.
4. Zmiany w DNS potrzebują od kilkunastu minut do kilku godzin.

Sprawdzenie od zewnątrz: [mxtoolbox.com/SuperTool.aspx](https://mxtoolbox.com/SuperTool.aspx)
— wpisz `dewax.pl` i sprawdź kolejno `SPF`, `DMARC` oraz `TXT` dla nazwy
wskazanej przez Resend jako DKIM.

> Nie dało się tego sprawdzić przy pisaniu tych zmian — środowisko, w którym
> powstawały, nie ma dostępu do DNS ani do Cloudflare. To jedyny punkt tej
> listy oparty na diagnozie, a nie na sprawdzonym fakcie. Jest pierwszy na
> liście, bo objaw („worker mówi ok, klient nie ma maila") pasuje do niego
> najlepiej.

### Tryb testowy Resend

Jeśli `FROM_EMAIL` w Cloudflare to `onboarding@resend.dev`, Resend wysyła
**wyłącznie na Twój własny adres**. Każda oferta do klienta jest odrzucana.
Ustaw `FROM_EMAIL` na adres w zweryfikowanej domenie, np.
`DEWAX <oferty@dewax.pl>`.

---

## Kod dostępu (HTTP 401)

Diagnostyka mówi **„Worker odrzucił kod dostępu"**: kod wpisywany przy
wejściu do kreatora nie zgadza się z sekretem `AUTH_TOKEN`.

Cloudflare → Workers → `dewax-send` → Settings → Variables and Secrets.
Ten sam kod musi być w `dewax-hubspot`. Po zmianie sekretu handlowcy muszą
wpisać nowy kod przy najbliższym wejściu.

---

## Brak połączenia z workerem

Diagnostyka mówi **„Brak połączenia"**: worker nie jest wdrożony albo nie
przepuszcza żądań z domeny kreatora (CORS). Ustaw w workerze zmienną
`ALLOWED_ORIGIN` na adres kreatora i sprawdź, czy worker odpowiada na
`OPTIONS` — przeglądarka pyta o zgodę przed każdym żądaniem z nagłówkiem
`X-Dewax-Auth`.

---

## Dostęp do klientów dla całego zespołu

### Po stronie kreatora — działa

Lista leadów pobiera z HubSpota wszystkie kontakty, bez filtra po
właścicielu. Każdy handlowiec widzi w kreatorze każdego klienta.
Znaczniki „obdzwoniony" są prywatne dla urządzenia i nikomu niczego nie
ukrywają.

Transakcja bez wybranego handlowca nie jest już zgłaszana jako błąd —
trafia do HubSpota i jest widoczna dla zespołu. Pole „Ofertę wystawia"
służy tylko temu, żeby oferta trafiła **dodatkowo** na własną listę
konkretnej osoby.

### Po stronie HubSpota — do wyklikania

Widoczności rekordów nie da się ustawić z kodu; to uprawnienia użytkownika.
HubSpot → Settings → Users & Teams → wybierz użytkownika → Edit permissions
→ CRM → Contacts / Deals → **View: Everything** (zamiast „Owned only"
i „Team only"). To samo dla Deals, jeśli mają widzieć wszystkie oferty.

Stan portalu `49004516` na dziś: brak zdefiniowanych zespołów, dwa aktywne
konta — **Adam Demczyszak** i **Małgorzata Kuś**. Przy dwóch osobach i braku
zespołów wystarczy ustawić obu „View: Everything".

---

## Lista handlowców rozjechana z HubSpotem — naprawione

Lista w `index.html` była wpisana na sztywno i się rozjechała:

| Podpis w kreatorze | Wysyłane ID | Kto to naprawdę |
|---|---|---|
| Romana Wojnowska | `76509862` | **Adam Demczyszak** |
| Małgorzata Kuś | `79601430` | Małgorzata Kuś ✔ |
| Adam Demczyszak | `79652341` | **nie istnieje w portalu** |

Wybranie „Adama Demczyszaka" wysyłało więc nieistniejące ID i HubSpot
odrzucał przypisanie. Wybranie „Romany Wojnowskiej" przypisywało transakcję
Adamowi. **Romany Wojnowskiej nie ma wśród właścicieli w HubSpocie** — jeśli
ma wystawiać oferty, trzeba jej najpierw założyć konto.

Lista jest teraz pobierana z HubSpota (`GET /owners`), a wpisane w kodzie ID
zostały poprawione i służą już tylko jako awaryjny fallback. Endpoint trzeba
dołożyć do workera `dewax-hubspot` — kod w
**`worker/dewax-hubspot-owners.js`**.

---

## Właściciel transakcji gubiony przy zapisie — naprawione

Komunikat *„transakcja zapisana, ale nie udało się jej odnaleźć, żeby
przypisać właściciela"* brał się z wyścigu: kreator tworzył transakcję,
a zaraz potem szukał jej po nazwie, żeby dopisać właściciela. Indeks
wyszukiwania HubSpota nie widzi świeżo utworzonego obiektu przez kilka
sekund, więc wyszukiwanie zwracało pustkę.

Właściciel jest teraz wysyłany **razem z żądaniem tworzącym transakcję**,
gdzie indeks nie gra roli. Wyszukiwanie po nazwie zostało jako plan B dla
starszych transakcji i ponawia próbę trzy razy co 1,5 sekundy.

---

## Kolejność napraw

1. **Wgraj `worker/dewax-send.js`** — bez `/status/{id}` dalej nie wiadomo,
   czy oferty docierają. To jedyny sposób, żeby przestać zgadywać.
2. **Sprawdź weryfikację `dewax.pl` w Resend** oraz SPF, DKIM i DMARC.
3. **Wgraj `worker/dewax-hubspot-owners.js`** — lista handlowców przestaje
   się rozjeżdżać z HubSpotem.
4. **Ustaw „View: Everything"** obu handlowcom w HubSpocie.
5. Wyślij ofertę testową na własny adres i sprawdź kronikę doręczeń.
