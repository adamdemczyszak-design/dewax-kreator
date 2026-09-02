# pompy.dewax.pl - co zmienić

Ta strona stoi na **nazwa.pl**, poza Netlify i poza Gitem. Nie mam do niej
dostępu, więc tutaj leży wyłącznie to, co trzeba w niej podmienić - gotowe
do wklejenia, bez przepisywania.

Zmiany są dwie i obie są jednolinijkowe.

---

## 1. Przycisk do konfiguratora klienta (nowy)

Strona ma dziś sekcję `#kreator` z hasłem „Policz koszt systemu w 2 minuty",
ale nie prowadzi do niczego, czym klient może się posłużyć - jedyne linki
zewnętrzne prowadzą do kreatora zespołu, za bramą logowania.

**Gdzie:** w sekcji `#kreator`, jako główny przycisk.

```html
<a class="btn b-cta"
   href="https://pompy-dewax-test.netlify.app/"
   rel="noopener"
   style="display:inline-block;background:#1e2a5e;color:#fff;text-decoration:none;padding:16px 26px;border-radius:12px;font-weight:800;font-size:17px">
  Policz koszt dla swojego domu
</a>
<p style="margin-top:10px;font-size:14px;color:#5b6577">
  Kilka pytań o dom, jedno o kod pocztowy. Widełki zobaczysz bez podawania
  nazwiska, telefonu i adresu.
</p>
```

Adres `pompy-dewax-test.netlify.app` do podmiany na docelowy, gdy konfigurator
dostanie własną domenę (na przykład `konfigurator.dewax.pl`).

**Ważne przy dodawaniu kampanii:** link z reklamy ma nieść parametry
`?utm_source=...&utm_medium=...&utm_campaign=...`. Konfigurator je czyta
i dokleja do zgłoszenia - bez nich nie da się policzyć kosztu na wizytę,
a etap 4 stoi właśnie na tej liczbie.

---

## 2. Poprawka opisu kreatora zespołu (istniejący)

W dwóch miejscach jest link opisany jako „Kreator ofertowy (kod dostępu)".
Kod dostępu zniknął - wejście jest przez login i hasło bramy. Opis wprowadza
w błąd partnera, który będzie szukał kodu.

**Znajdź:**

```html
Kreator ofertowy (kod dostępu)
```

**Zamień na:**

```html
Kreator ofertowy (dla partnerów, po zalogowaniu)
```

To wszystko. Reszta strony zostaje bez zmian.
