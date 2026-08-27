# Kreator DEWAX — co się zmieniło i co trzeba kliknąć

Dokument dla Adama. Trzy rzeczy do zrobienia ręcznie są na końcu, każda
z gotowym tekstem do skopiowania.

---

## 1. Maile jednak działają

Sprawdziliśmy to ręcznie i wynik jest jednoznaczny:

- domena `dewax.pl` w Resend ma status **Verified**,
- nadawca to `DEWAX <kontakt@dewax.pl>`,
- testowa oferta doszła do skrzynki, do folderu Odebrane — nie do spamu,
- Daria też wysłała ofertę testową i dotarła.

**Nie ruszamy ustawień poczty.** Rekordy SPF, DKIM i DMARC są w porządku
i nie mają z tym nic wspólnego.

Skąd więc meldunki „nie dochodzi"? Stary kreator pisał **„oferta wysłana"**,
choć wiedział tylko tyle, że worker przyjął zlecenie. Nie miał pojęcia, czy
list trafił do skrzynki klienta. Maile leżały u klientów nieprzeczytane,
handlowiec nie miał jak tego sprawdzić i zgłaszał awarię, której nie było.

Naprawą jest więc pokazywanie prawdy o doręczeniu — i to zrobiliśmy.

---

## 2. Co teraz widać w kreatorze

**Po kliknięciu „Wyślij ofertę"** kreator pisze **„przekazana do wysyłki"**.
Nie „wysłana" — bo w tym momencie jeszcze nie wiadomo, czy doszła.

**Pod treścią maila** jest **kronika doręczeń**. Dla każdej oferty widać, do
kogo poszła, o której i z jakim skutkiem:

| Co widzisz | Co to znaczy |
|---|---|
| ✅ Doręczona do skrzynki klienta | List jest u klienta. Sprawa zamknięta. |
| ⏳ W drodze | Poczta klienta jeszcze nie potwierdziła. Kliknij „Odśwież" za chwilę. |
| ⏳ Doręczenie opóźnione | Serwer klienta chwilowo nie przyjmuje. Zwykle dochodzi później. |
| ❌ Odrzucona | Nie dotarła. Sprawdź, czy adres e-mail nie ma literówki. |
| ❌ Spam | Klient sam oznaczył wiadomość jako spam. |

Kreator sam sprawdza status kilka razy po wysyłce. Przycisk **„Odśwież"**
w kronice sprawdza od razu.

**Gdy klient mówi, że nie dostał oferty:** zajrzyj do kroniki. Jeśli jest
tam ✅ **Doręczona** — list jest w jego skrzynce i szukać trzeba u niego,
nie w kreatorze.

**Przycisk „Sprawdź połączenie"** obok „Wyślij ofertę" sprawdza bazę
klientów i wysyłkę ofert, i pisze po polsku, co nie działa.

---

## 3. Kto wystawia ofertę — cztery podpisy, jedno konto

Na liście „Ofertę wystawia" są cztery osoby. Wszystkie transakcje
z kreatora trafiają na **konto Adama**:

| Podpis w kreatorze | Konto w HubSpocie |
|---|---|
| Adam Demczyszak | Adam Demczyszak |
| Daria Czajka | Adam Demczyszak |
| Małgorzata Kuś | Adam Demczyszak |
| Romana Wojnowska | Adam Demczyszak |

Nowych kont nie zakładamy. Podpis wybrany w kreatorze wchodzi na ofertę,
a właścicielem transakcji w HubSpocie jest zawsze Adam.

**Ważne dla Gosi:** ona ma w HubSpocie własne konto, ale kreator z niego
nie korzysta. Transakcje wystawione przez nią **nie pojawią się na jej
własnej liście**. Zobaczy je dopiero po ustawieniu uprawnień z punktu 4
poniżej — bez tego kroku Gosia nie zobaczy swoich ofert w HubSpocie.

Wcześniej ta lista była pomylona: pozycja podpisana „Romana Wojnowska"
wysyłała numer konta Adama, a pozycja „Adam Demczyszak" wysyłała numer,
którego w HubSpocie w ogóle nie ma. Dlatego transakcje nie trafiały tam,
gdzie powinny. Teraz numer jest jeden i się zgadza.

Poprawiony jest też komunikat *„transakcja zapisana, ale nie udało się jej
odnaleźć"*. Kreator zapisywał transakcję, a zaraz potem szukał jej po
nazwie, żeby dopisać handlowca — a HubSpot potrzebuje kilku sekund, zanim
nowa transakcja pojawi się w wyszukiwarce. Teraz handlowiec jest wysyłany
od razu razem z transakcją, więc nie ma czego szukać.

### Uwaga: każdy handlowiec musi raz wybrać się z listy

Po tej zmianie pole **„Ofertę wystawia"** będzie puste, także u osób, które
wcześniej coś wybrały. Trzeba wybrać się z listy jeden raz — potem kreator
pamięta.

**Gotowa wiadomość do handlowców** (skopiuj i wyślij):

> Cześć, zaktualizowaliśmy kreator ofert.
>
> Przy pierwszej ofercie po zmianie wybierzcie siebie w polu **„Ofertę
> wystawia"** — lista jest nad danymi klienta. Wystarczy raz, potem kreator
> będzie pamiętał.
>
> Na liście są cztery podpisy: Adam, Daria, Gosia i Romana. Wybrany podpis
> wchodzi na ofertę; w HubSpocie wszystkie transakcje z kreatora zapisują
> się na koncie Adama, więc szukajcie ich tam, a nie na własnych listach.
>
> Druga zmiana: po wysłaniu oferty kreator pisze teraz **„przekazana do
> wysyłki"**, a pod treścią maila pokazuje, czy oferta faktycznie dotarła do
> klienta i o której godzinie. Jak klient mówi, że nic nie dostał —
> sprawdźcie tam najpierw.

---

## 4. DO ZROBIENIA: dostęp do wszystkich klientów w HubSpocie

To jedyna rzecz, której nie da się ustawić z kodu. Trzeba wyklikać
w HubSpocie, osobno dla Adama i dla Gosi.

**Dla Gosi to nie jest opcja, tylko warunek.** Wszystkie transakcje
z kreatora należą do konta Adama (patrz punkt 3), więc dopóki Gosia nie ma
uprawnienia „View: Everything", nie zobaczy w HubSpocie ani jednej swojej
oferty.

HubSpot jest po angielsku, więc poniżej podane są napisy, które zobaczysz
na ekranie.

**Krok po kroku:**

1. Wejdź na **app.hubspot.com** i zaloguj się.
2. Kliknij **ikonę zębatki** w prawym górnym rogu (to jest „Settings",
   czyli ustawienia).
3. W menu po lewej znajdź **Users & Teams** (użytkownicy i zespoły)
   i kliknij.
4. Zobaczysz listę osób. Kliknij na **Adam Demczyszak**.
5. Po prawej otworzy się panel. Kliknij **Edit permissions**
   (edytuj uprawnienia).
6. Wybierz zakładkę **CRM**.
7. Znajdź wiersz **Contacts** (kontakty). Przy pozycji **View** (widok)
   zaznacz **Everything** (wszystko). Nie „Owned only", nie „Team only".
8. Znajdź wiersz **Deals** (transakcje). Przy **View** też zaznacz
   **Everything**.
9. Kliknij **Save** (zapisz) na dole.
10. **Powtórz kroki 4–9 dla Małgorzaty Kuś.**

Po tym każdy widzi wszystkich klientów i wszystkie oferty.

W kreatorze dostęp już działa — lista leadów pokazuje wszystkie kontakty,
bez względu na to, czyj to klient. Transakcja bez wybranego handlowca też
nie jest już zgłaszana jako błąd: trafia do HubSpota i widzi ją zespół.

---

## 5. Worker `dewax-send` — gdzie jest jego kod

**Kodu workera nie ma w tym repozytorium** i nie należy go tu wstawiać.
Worker jest wdrażany ręcznie przez panel Cloudflare i to tam jest jedyna
prawdziwa wersja. Kopia w repozytorium tylko rozjeżdżałaby się z produkcją
i myliła przy kolejnych naprawach.

Aktualnie wdrożona wersja: **56b9c876**. Obsługuje:

| Adres | Do czego służy |
|---|---|
| `POST /` | wysyłka oferty (działa też ze starym kreatorem) |
| `GET /status/{id}` | czy oferta doszła — zwraca `stan` i `opis` |
| `GET /health` | diagnostyka: sekrety, połączenie z Resend, nadawca, dozwolona domena |

Możliwe stany zwracane przez `/status/{id}`:
`dostarczona`, `w_drodze`, `opozniona`, `odrzucona`, `spam`, `nieznany`.

Kod dostępu handlowca idzie w nagłówku `X-Dewax-Auth`.

Kreator odpytuje dokładnie te trzy adresy i czyta dokładnie te pola.
**Jeśli worker będzie kiedyś zmieniany, trzeba sprawdzić, czy nazwy pól
się zgadzają** — kreator nie zgaduje ich na zapas.

Worker `dewax-hubspot` (baza klientów) działa bez zmian i nie był ruszany.

---

## 6. Gdyby coś przestało działać

Kliknij **„Sprawdź połączenie"** w podglądzie oferty. Napisze po polsku,
co jest zepsute. Najczęstsze przypadki:

| Komunikat | Co zrobić |
|---|---|
| „Worker odrzucił kod dostępu" | Kod wpisywany przy wejściu do kreatora nie zgadza się z ustawieniem `AUTH_TOKEN` w Cloudflare. |
| „Na Cloudflare stoi stara wersja workera" | Wdrożona wersja jest starsza niż 56b9c876 i nie umie potwierdzać doręczeń. |
| „Brak połączenia z workerem" | Worker nie odpowiada albo `ALLOWED_ORIGIN` nie zgadza się z adresem kreatora (`https://dewax-kreator.netlify.app`). |
