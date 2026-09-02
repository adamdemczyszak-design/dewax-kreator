/* =============================================================================
 * DEWAX - publiczny konfigurator klienta
 * =============================================================================
 * Kolejnosc ekranow jest decyzja, nie ukladem przypadkowym:
 *
 *   1. konfiguracja        - pytania, na ktore klient zna odpowiedz
 *   2. kod pocztowy        - z uzasadnieniem, dlaczego pytamy
 *   3. widelki             - BEZ danych kontaktowych
 *   4. dane kontaktowe     - dopiero gdy klient sam o to poprosi
 *
 * Punkt trzeci jest cala rzecza. Strona, ktora najpierw bierze telefon,
 * a dopiero potem pokazuje cene, uczy klienta, ze cena jest zaplata za jego
 * numer. Tutaj liczba jest za darmo i mozna z nia wyjsc.
 *
 * Pelnego adresu inwestycji nie pytamy nigdzie - ten ustala sie przy
 * umawianiu wizyty, w rozmowie.
 * ========================================================================== */

(function () {
  "use strict";

  var WORKER = "https://dewax-lead.adam-demczyszak.workers.dev";
  var TURNSTILE_SITEKEY = document.documentElement.getAttribute("data-turnstile") || "";

  var cennik = null;
  var stan = {
    ekran: 1,
    // Odpowiedzi z ekranu 1 i 2.
    wybory: {},
    wycena: null,
    zgodaPomiar: null,
    tokenTurnstile: "",
  };

  /* ======================================================================
     POMIAR
     Kazde zdarzenie ma session_id, utm_*, fbclid i czas. Bez tego nie da sie
     policzyc kosztu na wizyte - a bez kosztu na wizyte kazda decyzja
     o budzecie reklamowym jest zgadywaniem.

     Nic nie leci, dopoki klient nie zgodzi sie na pomiar.
     ====================================================================== */

  var pomiar = (function () {
    var p = new URLSearchParams(location.search);
    var dane = {
      utm_source: p.get("utm_source") || "",
      utm_medium: p.get("utm_medium") || "",
      utm_campaign: p.get("utm_campaign") || "",
      utm_content: p.get("utm_content") || "",
      fbclid: p.get("fbclid") || "",
    };
    var sesja = "";
    try {
      sesja = sessionStorage.getItem("dewax_sesja") || "";
      if (!sesja) {
        sesja = "s-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
        sessionStorage.setItem("dewax_sesja", sesja);
        sessionStorage.setItem("dewax_pierwsze", new Date().toISOString());
      }
    } catch (e) { /* tryb prywatny - pomiar po prostu nie dziala */ }
    dane.session_id = sesja;
    try { dane.pierwszeWejscie = sessionStorage.getItem("dewax_pierwsze") || ""; } catch (e) { dane.pierwszeWejscie = ""; }
    return dane;
  })();

  function zdarzenie(nazwa, krok) {
    if (stan.zgodaPomiar !== true || !pomiar.session_id) return;
    var tresc = Object.assign({ zdarzenie: nazwa, krok: krok || null }, pomiar);
    try {
      // sendBeacon przezywa zamkniecie karty; fetch nie zawsze.
      var paczka = new Blob([JSON.stringify(tresc)], { type: "application/json" });
      if (navigator.sendBeacon && navigator.sendBeacon(WORKER + "/zdarzenie", paczka)) return;
    } catch (e) { /* nizej */ }
    fetch(WORKER + "/zdarzenie", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tresc), keepalive: true,
    }).catch(function () {});
  }

  /* ======================================================================
     ZGODA NA POMIAR
     ====================================================================== */

  function ustawZgode(wartosc) {
    stan.zgodaPomiar = wartosc;
    try { localStorage.setItem("dewax_zgoda_pomiar", wartosc ? "tak" : "nie"); } catch (e) {}
    document.getElementById("cookies").hidden = true;
    if (wartosc) zdarzenie("config_start", 1);
  }

  (function bannerCookies() {
    var zapisana = null;
    try { zapisana = localStorage.getItem("dewax_zgoda_pomiar"); } catch (e) {}
    if (zapisana === "tak") { stan.zgodaPomiar = true; zdarzenie("config_start", 1); return; }
    if (zapisana === "nie") { stan.zgodaPomiar = false; return; }
    var box = document.getElementById("cookies");
    box.hidden = false;
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-cookies]");
      if (b) ustawZgode(b.getAttribute("data-cookies") === "tak");
    });
  })();

  /* ======================================================================
     NARZEDZIA
     ====================================================================== */

  function el(id) { return document.getElementById(id); }

  function pln(v) {
    return Math.round(Number(v) || 0).toLocaleString("pl-PL") + " zł";
  }
  function tys(v) {
    return Math.round((Number(v) || 0) / 1000) + " tys. zł";
  }

  function pokazBlad(idPola, tekst) {
    var b = el(idPola);
    b.textContent = tekst;
    b.hidden = false;
    b.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function schowajBlad(idPola) { el(idPola).hidden = true; }

  function idzDo(nr) {
    for (var i = 1; i <= 5; i++) {
      var s = el("ekran-" + i);
      if (s) s.hidden = (i !== nr);
    }
    stan.ekran = nr;
    el("postepPasek").style.width = Math.round((nr - 1) / 4 * 100) + "%";
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    zdarzenie("config_step", nr);
  }

  /* --- Wybor jednokrotny --------------------------------------------------- */

  document.addEventListener("click", function (e) {
    var opcja = e.target.closest(".opcja");
    if (opcja) {
      var grupa = opcja.closest("[data-pole]");
      if (!grupa) return;
      var pole = grupa.getAttribute("data-pole");
      Array.prototype.forEach.call(grupa.querySelectorAll(".opcja"), function (o) {
        o.setAttribute("aria-pressed", o === opcja ? "true" : "false");
      });
      stan.wybory[pole] = opcja.getAttribute("data-v");
      reagujNaWybor(pole, stan.wybory[pole]);
      return;
    }
    var wroc = e.target.closest("[data-wroc]");
    if (wroc) idzDo(Number(wroc.getAttribute("data-wroc")));
  });

  /* Pola, ktore pojawiaja sie dopiero, gdy maja sens. */
  function reagujNaWybor(pole, wartosc) {
    if (pole === "budynek") {
      el("poleEtap").hidden = (wartosc !== "nowy");
      if (wartosc !== "nowy") delete stan.wybory.etapBudowy;
    }
    if (pole === "studnieWOkolicy") {
      el("poleGlebokosc").hidden = (wartosc !== "tak");
    }
    if (pole === "ktoDecyduje") {
      el("poleDrugiEmail").hidden = (wartosc !== "wspolnie");
    }
  }

  /* ======================================================================
     EKRAN 1 -> 2
     ====================================================================== */

  function liczba(id) {
    var v = el(id).value.trim();
    return v === "" ? null : Number(v);
  }

  el("doKodu").addEventListener("click", function () {
    schowajBlad("bladEkran1");
    var brakuje = [];

    var m = liczba("metraz");
    if (!(m >= 20 && m <= 1000)) brakuje.push("powierzchnia domu (od 20 do 1000 m²)");
    var d = liczba("domownikow");
    if (!(d >= 1 && d <= 15)) brakuje.push("liczba domowników");
    if (!stan.wybory.ocieplenie) brakuje.push("ocieplenie");
    if (!stan.wybory.obecneOgrzewanie) brakuje.push("czym grzejesz dzisiaj");
    if (!stan.wybory.budynek) brakuje.push("budynek istniejący czy nowy");
    if (!stan.wybory.miejsceNaOdwiert) brakuje.push("miejsce na odwiert");
    if (!stan.wybory.dojazd) brakuje.push("dojazd dla wiertnicy");
    if (!stan.wybory.studnieWOkolicy) brakuje.push("studnie w okolicy");

    if (brakuje.length) {
      pokazBlad("bladEkran1", "Zostało do uzupełnienia: " + brakuje.join(", ") + ".");
      return;
    }

    stan.wybory.metraz = m;
    stan.wybory.domownikow = d;
    stan.wybory.rokBudowy = liczba("rokBudowy");
    stan.wybory.rocznyKoszt = liczba("rocznyKoszt");
    stan.wybory.glebokoscStudni = stan.wybory.studnieWOkolicy === "tak" ? liczba("glebokoscStudni") : null;
    stan.wybory.cwuPowiekszona = el("cwuPowiekszona").checked;
    stan.wybory.chlodzenie = el("chlodzenie").checked;
    stan.wybory.rekuperacja = el("rekuperacja").checked;
    if (stan.wybory.budynek !== "nowy") stan.wybory.etapBudowy = "nie_dotyczy";

    idzDo(2);
  });

  /* ======================================================================
     EKRAN 2 -> 3
     ====================================================================== */

  el("kodPocztowy").addEventListener("input", function (e) {
    // Formatowanie w locie: 63330 -> 63-330. Ludzie wpisuja i tak, i tak.
    var cyfry = e.target.value.replace(/\D/g, "").slice(0, 5);
    e.target.value = cyfry.length > 2 ? cyfry.slice(0, 2) + "-" + cyfry.slice(2) : cyfry;
  });

  /* Zgrubny podzial na strefy po dwoch pierwszych cyfrach kodu. Ten sam
     podzial ma Worker - tutaj jest po to, zeby pokazac widelki bez pytania
     serwera o cokolwiek. To nie jest badanie geologiczne, tylko punkt
     wyjscia, i strona mowi o tym wprost. */
  var STREFY = [
    { od: 60, do: 69, s: "A" }, { od: 70, do: 78, s: "A" }, { od: 80, do: 84, s: "A" },
    { od: 0, do: 9, s: "B" }, { od: 10, do: 14, s: "B" }, { od: 15, do: 19, s: "B" },
    { od: 45, do: 49, s: "B" }, { od: 50, do: 56, s: "B" }, { od: 85, do: 89, s: "B" },
    { od: 90, do: 99, s: "B" },
    { od: 20, do: 24, s: "C" }, { od: 35, do: 39, s: "C" }, { od: 40, do: 44, s: "C" },
    { od: 25, do: 29, s: "D" }, { od: 30, do: 34, s: "D" }, { od: 57, do: 59, s: "D" },
  ];
  function strefaZKodu(kod) {
    var p = parseInt(String(kod).slice(0, 2), 10);
    for (var i = 0; i < STREFY.length; i++) if (p >= STREFY[i].od && p <= STREFY[i].do) return STREFY[i].s;
    return "B";
  }

  el("doWidelek").addEventListener("click", function () {
    schowajBlad("bladEkran2");
    var kod = el("kodPocztowy").value.trim();
    if (!/^\d{2}-\d{3}$/.test(kod)) {
      pokazBlad("bladEkran2", "Kod pocztowy w formacie 00-000, na przykład 63-330.");
      return;
    }
    stan.wybory.kodPocztowy = kod;
    policzIPokaz();
  });

  /* ======================================================================
     EKRAN 3 - WIDELKI
     ====================================================================== */

  function policzIPokaz() {
    if (!cennik) { pokazBlad("bladEkran2", "Cennik jeszcze się wczytuje. Spróbuj za sekundę."); return; }

    var strefa = strefaZKodu(stan.wybory.kodPocztowy);
    var w;
    try {
      w = window.DEWAX_CORE.widelkiPubliczne(stan.wybory, strefa);
    } catch (e) {
      pokazBlad("bladEkran2", "Nie udało się policzyć widełek. Zadzwoń: 62 7413 227.");
      return;
    }
    stan.wycena = w;

    el("widelkiNaglowek").textContent = "Dom " + stan.wybory.metraz + " m², kod " + stan.wybory.kodPocztowy;
    el("widelkiWstep").textContent =
      "Rozdzieliliśmy to na dwie części, bo tylko jedna z nich jest dziś przewidywalna. "
      + "Wszystkie kwoty są brutto, z 8% VAT dla osoby fizycznej w budynku mieszkalnym.";

    /* --- czesc pewna --- */
    el("pewnaZakres").textContent = pln(w.czescPewna.zakres.od) + " – " + pln(w.czescPewna.zakres.do);
    el("pewnaTypowa").innerHTML = "Większość domów jak Twój: <b>około "
      + tys(w.czescPewna.zakres.typowa) + "</b>.";
    el("pewnaZawiera").innerHTML = w.czescPewna.zawiera.map(function (t) {
      return "<li>" + t + "</li>";
    }).join("") + w.czescPewna.dodatki.map(function (d) {
      return "<li>" + d.nazwa + " (+" + pln(d.brutto) + ")</li>";
    }).join("");

    /* --- odwiert --- */
    el("odwiertZakres").textContent = pln(w.dolneZrodlo.zakres.od) + " – " + pln(w.dolneZrodlo.zakres.do);
    el("odwiertOpis").innerHTML = "Około <b>" + w.dolneZrodlo.metrow + " metrów</b> odwiertu. "
      + w.dolneZrodlo.opisStrefy;

    /* --- razem --- */
    el("razemTypowa").textContent = pln(w.razem.typowa);

    /* --- dotacja: osobno i drugorzednie --- */
    el("dotacjaTekst").innerHTML =
      "<b>" + w.dofinansowanie.nazwa + "</b>: szacowany koszt po możliwym dofinansowaniu to około "
      + tys(w.dofinansowanie.szacowanyKosztPoDofinansowaniu) + " (dotacja rzędu "
      + tys(w.dofinansowanie.szacowanaKwota) + "). " + w.dofinansowanie.zastrzezenie;

    el("zastrzezenieCeny").innerHTML = w.zastrzezenie
      + " Kalkulacja ważna " + w.wazneDni + " dni od dzisiaj."
      + "<br><br><b>Co może zmienić tę cenę:</b> " + cennik.coZmieniaCene.join("; ") + ".";

    pokazEksploatacje(w);
    pokazNieOplaca();

    idzDo(3);
    zdarzenie("config_price_shown", 3);
  }

  /* --- Koszt eksploatacji kontra obecne ogrzewanie ------------------------ */
  function pokazEksploatacje(w) {
    var e = cennik.eksploatacja;
    // Zapotrzebowanie liczone z metrazu i pasma mocy - tak samo zgrubnie jak
    // widelki. Podawanie tu dokladnej liczby bylo by falszywa precyzja.
    var wskaznik = { slabe: 120, srednie: 95, dobre: 70, bardzo_dobre: 45, nie_wiem: 95 };
    var kwhRok = Math.round(stan.wybory.metraz * (wskaznik[stan.wybory.ocieplenie] || 95));
    var cwu = Math.round((stan.wybory.domownikow || 4) * 700);
    var razemKwh = kwhRok + cwu;

    var pompa = Math.round(razemKwh / e.scopTypowy * e.cenaPraduZlKwh);

    var wiersze = ['<tr><th>Ogrzewanie</th><th>Rocznie, orientacyjnie</th></tr>'];
    wiersze.push('<tr class="pompa"><td>Gruntowa pompa ciepła</td><td>' + pln(pompa) + "</td></tr>");

    var obecne = stan.wybory.obecneOgrzewanie;
    var mapa = { gaz: "gaz", pelet: "pelet", wegiel: "wegiel", prad: "prad" };
    var klucz = mapa[obecne];
    if (klucz && e.porownanie[klucz]) {
      var p = e.porownanie[klucz];
      var koszt = Math.round(razemKwh / p.sprawnosc * p.cenaZlKwh);
      wiersze.push('<tr class="teraz"><td>' + p.nazwa + " (masz teraz)</td><td>" + pln(koszt) + "</td></tr>");
      var roznica = koszt - pompa;
      el("eksploatacjaWstep").textContent = roznica > 0
        ? "Przy Twoim obecnym ogrzewaniu różnica wychodzi około " + pln(roznica) + " rocznie na korzyść pompy."
        : "Przy Twoim obecnym ogrzewaniu pompa nie wychodzi taniej w eksploatacji. Mówimy o tym wprost.";
    } else {
      el("eksploatacjaWstep").textContent = "Szacunek dla przeciętnego sezonu grzewczego i cen energii z II kwartału 2026.";
    }

    // Jesli klient podal wlasny roczny koszt, to on jest wazniejszy niz nasz
    // szacunek jego obecnego ogrzewania - to jedyna twarda liczba, jaka mamy.
    if (stan.wybory.rocznyKoszt > 0) {
      wiersze.push('<tr class="teraz"><td>Tyle płacisz dzisiaj (Twoja odpowiedź)</td><td>'
        + pln(stan.wybory.rocznyKoszt) + "</td></tr>");
    }

    el("tabelaEksploatacji").innerHTML = wiersze.join("");
    el("eksploatacjaZastrzezenie").textContent = e.zastrzezenie;
  }

  /* --- Kiedy sie nie oplaca ---------------------------------------------- */
  function pokazNieOplaca() {
    el("nieOplaca").innerHTML = cennik.kiedySieNieOplaca.map(function (p) {
      return '<div class="przypadek"><h3>' + p.tytul + "</h3><p>" + p.tresc + "</p></div>";
    }).join("");
  }

  el("doKontaktu").addEventListener("click", function () {
    idzDo(4);
    zaladujTurnstile();
  });

  /* ======================================================================
     EKRAN 4 - ZGLOSZENIE
     ====================================================================== */

  function zaladujTurnstile() {
    if (window.turnstile || !TURNSTILE_SITEKEY) return;
    var s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=dewaxTurnstile";
    s.async = true; s.defer = true;
    document.head.appendChild(s);
  }
  window.dewaxTurnstile = function () {
    window.turnstile.render("#turnstile", {
      sitekey: TURNSTILE_SITEKEY,
      language: "pl",
      callback: function (t) { stan.tokenTurnstile = t; },
      "expired-callback": function () { stan.tokenTurnstile = ""; },
    });
  };

  function tekst(id) { return el(id).value.trim(); }

  el("formularz").addEventListener("submit", async function (e) {
    e.preventDefault();
    schowajBlad("bladFormularz");

    var braki = [];
    if (!tekst("imie")) braki.push("imię");
    if (!/^(\+?48)?[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{3}$/.test(tekst("telefon").replace(/\s/g, " "))) braki.push("telefon (dziewięć cyfr)");
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(tekst("email"))) braki.push("poprawny e-mail");
    if (!stan.wybory.terminInstalacji) braki.push("kiedy chcesz to zrobić");
    if (!stan.wybory.ktoDecyduje) braki.push("kto podejmuje decyzję");
    if (!stan.wybory.poraTelefonu) braki.push("pora telefonu");
    if (stan.wybory.ktoDecyduje === "wspolnie" && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(tekst("drugiEmail"))) {
      braki.push("e-mail osoby, która decyduje razem z Tobą");
    }
    if (!el("zgodaTelefon").checked || !el("zgodaEmail").checked) {
      braki.push("obie zgody - bez nich nie wolno nam się odezwać");
    }
    if (braki.length) {
      pokazBlad("bladFormularz", "Zostało do uzupełnienia: " + braki.join(", ") + ".");
      return;
    }
    if (TURNSTILE_SITEKEY && !stan.tokenTurnstile) {
      pokazBlad("bladFormularz", "Poczekaj chwilę, aż zakończy się sprawdzenie zabezpieczenia, i spróbuj ponownie.");
      return;
    }

    var przycisk = el("wyslij");
    przycisk.disabled = true;
    przycisk.textContent = "Wysyłam…";

    var konfiguracja = {
      metraz: stan.wybory.metraz,
      rokBudowy: stan.wybory.rokBudowy,
      ocieplenie: stan.wybory.ocieplenie,
      obecneOgrzewanie: stan.wybory.obecneOgrzewanie,
      rocznyKoszt: stan.wybory.rocznyKoszt,
      domownikow: stan.wybory.domownikow,
      budynek: stan.wybory.budynek,
      etapBudowy: stan.wybory.etapBudowy || "nie_dotyczy",
      miejsceNaOdwiert: stan.wybory.miejsceNaOdwiert,
      dojazd: stan.wybory.dojazd,
      studnieWOkolicy: stan.wybory.studnieWOkolicy,
      glebokoscStudni: stan.wybory.glebokoscStudni,
      cwuPowiekszona: stan.wybory.cwuPowiekszona,
      chlodzenie: stan.wybory.chlodzenie,
      rekuperacja: stan.wybory.rekuperacja,
      kodPocztowy: stan.wybory.kodPocztowy,
    };

    var kontakt = {
      imie: tekst("imie"),
      telefon: tekst("telefon"),
      email: tekst("email"),
      terminInstalacji: stan.wybory.terminInstalacji,
      ktoDecyduje: stan.wybory.ktoDecyduje,
      drugiEmail: stan.wybory.ktoDecyduje === "wspolnie" ? tekst("drugiEmail") : null,
      poraTelefonu: stan.wybory.poraTelefonu,
      zgodaTelefon: true,
      zgodaEmail: true,
      wersjaKlauzuli: el("klauzula").getAttribute("data-wersja"),
    };

    try {
      var r = await fetch(WORKER + "/zgloszenie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          konfiguracja: konfiguracja,
          kontakt: kontakt,
          wycena: stan.wycena,
          // Pomiar leci tylko za zgoda. Bez niej worker dostaje pusty obiekt.
          pomiar: stan.zgodaPomiar ? {
            session_id: pomiar.session_id, utm_source: pomiar.utm_source,
            utm_medium: pomiar.utm_medium, utm_campaign: pomiar.utm_campaign,
            utm_content: pomiar.utm_content, fbclid: pomiar.fbclid,
            pierwszeWejscie: pomiar.pierwszeWejscie,
          } : {},
          turnstile: stan.tokenTurnstile,
          firma: tekst("firma"),
        }),
      });
      var dane = await r.json().catch(function () { return null; });
      if (!r.ok || !dane || !dane.ok) {
        throw new Error((dane && dane.blad) || "Nie udało się wysłać zgłoszenia.");
      }

      el("koniecTekst").textContent = "Dzwonimy do Ciebie "
        + ({ rano: "rano, między 8 a 11", poludnie: "w południe, między 11 a 14",
             popoludnie: "po południu, między 14 a 17", wieczor: "wieczorem, między 17 a 20",
             dowolna: "w najbliższym możliwym terminie" }[stan.wybory.poraTelefonu] || "wkrótce")
        + ". Rozmowa trwa kilka minut - chodzi o to, żeby ustalić trzy rzeczy, których nie da się odgadnąć z formularza.";
      idzDo(5);
      zdarzenie("lead_submitted", 5);
    } catch (err) {
      pokazBlad("bladFormularz", err.message + " Możesz też po prostu zadzwonić: 62 7413 227.");
      przycisk.disabled = false;
      przycisk.textContent = "Wyślij i umów rozmowę";
      if (window.turnstile) { try { window.turnstile.reset(); } catch (e) {} stan.tokenTurnstile = ""; }
    }
  });

  /* ======================================================================
     START
     ====================================================================== */

  fetch("core/cennik-publiczny.json")
    .then(function (r) { return r.json(); })
    .then(function (c) {
      cennik = c;
      window.DEWAX_CORE.zaladuj(null, c);
    })
    .catch(function () {
      var b = el("bladEkran1");
      b.textContent = "Nie udało się wczytać cennika. Odśwież stronę albo zadzwoń: 62 7413 227.";
      b.hidden = false;
    });

  el("postepPasek").style.width = "0%";
})();
