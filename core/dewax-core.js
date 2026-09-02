/* =============================================================================
 * DEWAX - wspolny rdzen cenowy
 * =============================================================================
 * PO CO TO JEST
 *
 * Logika cen ma za chwile pracowac w trzech miejscach: w kreatorze zespolu,
 * w publicznym konfiguratorze klienta i w kokpicie. Trzy kopie tego samego
 * rachunku rozjezdzaja sie w ciagu tygodni - i wtedy klient widzi na stronie
 * inna kwote niz handlowiec przez telefon. To jest jedna kopia.
 *
 * DWIE FUNKCJE WYJSCIOWE, CELOWO ROZDZIELONE
 *
 *   wycenaDokladna(konfig)                 - dla zespolu, z prawdziwego cennika
 *   widelkiPubliczne(konfig, strefaGruntu) - dla klienta, z cennika publicznego
 *
 * Rozdzial nie jest kosmetyczny. `widelkiPubliczne` fizycznie nie ma dostepu do
 * `cennik.json` - liczy wylacznie z `cennik-publiczny.json`, ktory zawiera inne
 * liczby. Publiczna strona nigdy nie dostaje prawdziwych stawek, wiec nie da sie
 * ich z niej odczytac ani zrekonstruowac.
 *
 * ZGODNOSC Z DOTYCHCZASOWYM KREATOREM
 *
 * Kazdy wzor ponizej jest przeniesiony z index.html bez zmiany, razem
 * z zaokragleniami. Nawet te zaokraglenia, ktore wygladaja na przypadkowe
 * (Math.ceil na dziesiatki metrow, parzystosc sond, VAT liczony pozycja po
 * pozycji), sa tu odtworzone co do zlotowki. Test core/test-zgodnosc.mjs
 * porownuje stary i nowy rachunek na macierzy konfiguracji.
 *
 * SPOSOB LADOWANIA
 *
 *   przegladarka: <script src="core/dewax-core.js"> -> window.DEWAX_CORE
 *   Node:         const core = require("./core/dewax-core.js")
 *
 * Cennik podaje sie osobno przez DEWAX_CORE.zaladuj(cennik, cennikPubliczny),
 * zeby ten plik nie zawieral zadnej ceny - inaczej znowu bylyby dwa miejsca.
 * ========================================================================== */

(function (globalny) {
  "use strict";

  var CENNIK = null;
  var CENNIK_PUBLICZNY = null;

  function zaladuj(cennik, cennikPubliczny) {
    if (cennik) CENNIK = cennik;
    if (cennikPubliczny) CENNIK_PUBLICZNY = cennikPubliczny;
    return { wersja: CENNIK && CENNIK.wersja, wersjaPubliczna: CENNIK_PUBLICZNY && CENNIK_PUBLICZNY.wersja };
  }

  function wymagajCennika() {
    if (!CENNIK) throw new Error("Rdzen bez cennika. Wywolaj DEWAX_CORE.zaladuj(cennik) przed wycena.");
    return CENNIK;
  }

  function wymagajPublicznego() {
    if (!CENNIK_PUBLICZNY) throw new Error("Rdzen bez cennika publicznego.");
    return CENNIK_PUBLICZNY;
  }

  /* ========================================================================
     CZESC 1 - DOBOR TECHNICZNY
     Przeniesione z index.html: dxSpecAt, dxSizingParams, dxPBase, dxDzSizing.
     ======================================================================== */

  /** Moc i COP urzadzenia (albo kaskady) w konkretnym punkcie pracy. */
  function specW(model, punkt) {
    if (!model || !punkt) return null;
    var jednostki = (model._cascade && model._units && model._units.length) ? model._units : [model];
    var sumaKw = 0, wazonyCop = 0;
    for (var i = 0; i < jednostki.length; i++) {
      var s = jednostki[i] && jednostki[i].specs && jednostki[i].specs[punkt];
      // Brak danych choćby dla jednej jednostki unieważnia całą kaskadę.
      if (!s || !(s.kw > 0)) return null;
      sumaKw += s.kw;
      wazonyCop += s.kw * (Number(s.cop) || 0);
    }
    if (!(sumaKw > 0)) return null;
    return { kw: sumaKw, cop: wazonyCop / sumaKw };
  }

  /** Moc projektowa budynku [kW]. OZC ma pierwszenstwo przed metrazem. */
  function mocProjektowa(konfig) {
    var b = konfig.budynek || {};
    var ozc = parseFloat(b.ozc);
    if (ozc > 0) return ozc;
    return (Number(b.powierzchnia) || 0) * (Number(b.wskaznikStrat) || 0) / 1000;
  }

  /** Wskazniki gruntu: z konfiguracji albo ryczalt DEWAX. */
  function grunt(konfig) {
    var c = wymagajCennika();
    var d = c.dolneZrodlo.gruntDomyslny;
    var g = konfig.grunt || {};
    return {
      wm2: (g.wm2 > 0) ? g.wm2 : d.wm2,
      wm: (g.wm > 0) ? g.wm : d.wm,
      eff: (g.eff > 0) ? g.eff : d.eff,
    };
  }

  /**
   * Parametry doboru zrodla. Kotwica to opublikowany punkt B0/W35; woda-woda
   * ma wlasny punkt, bo pompa oddaje w nim inna moc.
   */
  function parametryDoboru(konfig, model) {
    var c = wymagajCennika();
    var odbiorniki = konfig.odbiorniki || "low";
    var solanka = specW(model, "B0W35");
    var cop = solanka ? solanka.cop : (c.energia.scopBase[odbiorniki] || 5.30);

    var punktWody = (odbiorniki === "low") ? "W10W35" : "W10W45";
    var woda = specW(model, punktWody);

    var pompaKw = solanka ? solanka.kw : 0;
    if (!pompaKw && model) {
      // Starsze serie nie maja tablicy specs w tych punktach - zostaje moc
      // katalogowa. Dokladnie ta sama sciezka co w kreatorze.
      pompaKw = Number(model.power) || 0;
    }

    var g = grunt(konfig);
    return {
      cop: Math.max(cop, 1.5),
      pompaKw: pompaKw,
      pompaKwWoda: woda ? woda.kw : 0,
      copWoda: woda ? woda.cop : 0,
      gruntWm2: g.wm2,
      gruntWm: g.wm,
      gruntEff: g.eff,
      copZKatalogu: !!solanka,
    };
  }

  /**
   * Moc grzewcza, od ktorej liczone jest dolne zrodlo. Trzy czlony: podloga
   * (budynku nie da sie nie pokryc), udzial mocy pompy i sufit - zrodlo nie
   * podaza za pompa w nieskonczonosc, bo pompa dobrana z zapasem na szczyt
   * ladowania CWU nie pracuje moca szczytowa przez sezon.
   */
  function bazaMocy(pDesign, pompaKw) {
    var s = wymagajCennika().dolneZrodlo.sizing;
    var kw = (pompaKw > 0) ? pompaKw : pDesign;
    return Math.max(pDesign, Math.min(kw * s.pumpShare, pDesign * s.PUMP_FOLLOW_CAP));
  }

  /**
   * Ilosci dolnego zrodla dla wszystkich technologii naraz.
   * Zwraca to samo, co dxDzSizing w kreatorze.
   */
  function wymiaryDolnegoZrodla(pDesign, p, nadpisania) {
    var c = wymagajCennika();
    var DZ = c.dolneZrodlo;
    var s = DZ.sizing;
    var rozstaw = DZ.rozstawKolektora;

    var cop = Math.max(p.cop || 4, 1.5);
    var pk = (p.pompaKw > 0) ? p.pompaKw : pDesign;
    var pkWody = (p.pompaKwWoda > 0) ? p.pompaKwWoda : pk;

    var bazaSolanka = bazaMocy(pDesign, pk);

    var tech = {};
    Object.keys(DZ.technologie).forEach(function (k) {
      var T = DZ.technologie[k];
      // Woda-woda ma wlasny opublikowany punkt pracy - nie przeliczamy go z B0/W35.
      var copT = (k === "wodawoda" && p.copWoda > 0) ? p.copWoda : cop * T.copFactor;
      copT = Math.max(copT, 1.5);
      var baza = (k === "wodawoda") ? bazaMocy(pDesign, pkWody) : bazaSolanka;
      var req = baza * (copT - 1) / copT;
      tech[k] = {
        copT: copT,
        label: T.label,
        zKatalogu: (k === "odwiert") || (k === "wodawoda" && p.copWoda > 0),
        req: req,
        reqZ: req * s.GROUND_UNCERTAINTY,
      };
    });

    // Sondy spiralne montuje sie parami (dwa obiegi na rozdzielaczu).
    var sondy = Math.ceil(tech.spirale.reqZ / p.gruntEff);
    if (sondy % 2 !== 0) sondy++;
    var odwiert = Math.ceil(((tech.odwiert.reqZ * 1000) / p.gruntWm) / 10) * 10;
    var powierzchnia = Math.ceil((tech.poziomy.reqZ * 1000) / p.gruntWm2);
    var kolektor = Math.ceil((powierzchnia / rozstaw) / 10) * 10;

    var ov = nadpisania || {};
    var sondyE = (ov.koszowe > 0) ? parseInt(ov.koszowe, 10) : sondy;
    if (sondyE % 2 !== 0) sondyE++;
    var odwiertE = (ov.pionowe > 0) ? parseInt(ov.pionowe, 10) : odwiert;
    var kolektorE = (ov.poziome > 0) ? parseInt(ov.poziome, 10) : kolektor;
    var powierzchniaE = (ov.poziome > 0) ? Math.round(kolektorE * rozstaw) : powierzchnia;

    return {
      tech: tech,
      sondy: sondyE, odwiert: odwiertE, kolektor: kolektorE, powierzchnia: powierzchniaE,
      sondyAuto: sondy, odwiertAuto: odwiert, kolektorAuto: kolektor, powierzchniaAuto: powierzchnia,
      reczne: !!(ov.koszowe > 0 || ov.pionowe > 0 || ov.poziome > 0),
      gruntWm2: p.gruntWm2, gruntWm: p.gruntWm, gruntEff: p.gruntEff,
    };
  }

  /** Najslabsze urzadzenie serii TK R290 o mocy nie mniejszej niz pDesign. */
  function dobierzModel(konfig) {
    var c = wymagajCennika();
    var pDesign = mocProjektowa(konfig);
    var odbiorniki = konfig.odbiorniki || "low";
    var punkt = (konfig.dolneZrodlo === "wodawoda")
      ? (odbiorniki === "low" ? "W10W35" : "W10W45")
      : (odbiorniki === "low" ? "B0W35" : null);

    var kandydaci = c.urzadzenia
      .filter(function (m) { return m.brand === "dewax"; })
      .sort(function (a, b) { return a.power - b.power; });

    for (var i = 0; i < kandydaci.length; i++) {
      var m = kandydaci[i];
      var s = punkt ? specW(m, punkt) : null;
      var moc = s ? s.kw : m.power;
      if (moc >= pDesign) return m;
    }
    return null;
  }

  /* ========================================================================
     CZESC 2 - WYCENA DOKLADNA (dla zespolu)
     ======================================================================== */

  var CENA_ZRODLA = {
    koszowe:     function (w, ceny) { return { ilosc: w.sondy,    jednostka: "szt.", opis: "Sondy spiralne HELIX",              netto: w.sondy * ceny.sondaSzt }; },
    pionowe:     function (w, ceny) { return { ilosc: w.odwiert,  jednostka: "mb",   opis: "Odwiert pionowy",                   netto: w.odwiert * ceny.odwiertMb }; },
    poziome:     function (w, ceny) { return { ilosc: w.kolektor, jednostka: "mb",   opis: "Kolektor plaski - rury",            netto: w.kolektor * ceny.kolektorMb }; },
    wodawoda:    function (w, ceny) { return { ilosc: 1,          jednostka: "kpl.", opis: "Wymiennik woda-woda (ryczalt)",     netto: ceny.wodawoda }; },
    kolektorinw: function (w, ceny, ryczalt) { return { ilosc: 1, jednostka: "kpl.", opis: "Kolektor plaski - wykop Inwestora (ryczalt)", netto: (ryczalt > 0) ? Math.round(ryczalt) : ceny.kolektorInw }; },
  };

  /**
   * Pelna wycena z prawdziwego cennika.
   *
   * konfig = {
   *   budynek: { powierzchnia, wskaznikStrat, ozc },
   *   odbiorniki: 'low' | 'high' | 'mixed' | 'other',
   *   osoby, lazienka: 'prysznic' | 'wanna',
   *   dolneZrodlo: 'pionowe' | 'koszowe' | 'poziome' | 'kolektorinw' | 'wodawoda',
   *   grunt: { wm2, wm, eff },
   *   modelId: 'r290_g3s' | null (null = dobor automatyczny),
   *   nadpisaniaIlosci: { koszowe, pionowe, poziome },
   *   ryczaltKolektorInw: liczba,
   *   osprzet: { idPozycji: { checked, price } },
   *   vat: 8 | 23
   * }
   */
  function wycenaDokladna(konfig) {
    var c = wymagajCennika();
    konfig = konfig || {};

    var pDesign = mocProjektowa(konfig);
    var model = konfig.modelId
      ? c.urzadzenia.filter(function (m) { return m.id === konfig.modelId; })[0] || null
      : dobierzModel(konfig);

    var p = parametryDoboru(konfig, model);
    var wymiary = wymiaryDolnegoZrodla(pDesign, p, konfig.nadpisaniaIlosci);

    var dz = konfig.dolneZrodlo || "pionowe";
    var licz = CENA_ZRODLA[dz] || CENA_ZRODLA.pionowe;
    var pozycjaZrodla = licz(wymiary, c.dolneZrodlo.ceny, konfig.ryczaltKolektorInw);

    /* --- Pozycje kosztorysu ---------------------------------------------- */
    var pozycje = [];
    pozycje.push({
      id: "pompa",
      nazwa: model ? model.name : "Pompa ciepla (nie wybrano)",
      netto: model ? Number(model.price) || 0 : 0,
    });
    pozycje.push({
      id: "dolneZrodlo",
      nazwa: pozycjaZrodla.opis + " - " + pozycjaZrodla.ilosc + " " + pozycjaZrodla.jednostka,
      netto: pozycjaZrodla.netto,
    });

    var stan = konfig.osprzet || {};
    c.osprzet.forEach(function (poz) {
      var s = stan[poz.id];
      if (s && s.checked) {
        pozycje.push({ id: poz.id, nazwa: poz.name, netto: Number(s.price) || 0 });
      }
    });

    /* --- Sumy. VAT liczony POZYCJA PO POZYCJI ----------------------------- */
    // Nie od sumy netto. Tak liczy kosztorys na wydruku i tak ma liczyc kreator -
    // inaczej kwota brutto w kroku 4 rozni sie od tej w ofercie o kilka zlotych,
    // a klient to zauwaza.
    var vat = Number(konfig.vat) || c.vat.osobaFizyczna;
    var netto = 0, kwotaVat = 0;
    pozycje.forEach(function (poz) {
      var n = Number(poz.netto) || 0;
      poz.vat = Math.round(n * vat / 100);
      poz.brutto = n + poz.vat;
      netto += n;
      kwotaVat += poz.vat;
    });

    return {
      wersjaCennika: c.wersja,
      dataCennika: c.data,
      stawkaVat: vat,
      dobor: {
        pDesign: pDesign,
        model: model ? { id: model.id, nazwa: model.name, moc: model.power } : null,
        cop: p.cop,
        copZKatalogu: p.copZKatalogu,
        pompaKw: p.pompaKw,
        dolneZrodlo: dz,
        technologia: c.dolneZrodlo.technologiaDla[dz] || "odwiert",
        ilosc: pozycjaZrodla.ilosc,
        jednostka: pozycjaZrodla.jednostka,
        wymiary: wymiary,
      },
      pozycje: pozycje,
      netto: netto,
      vat: kwotaVat,
      brutto: netto + kwotaVat,
    };
  }

  /* ========================================================================
     CZESC 3 - WIDELKI PUBLICZNE (dla klienta)
     Licza wylacznie z cennika publicznego. Prawdziwy cennik nie jest tu
     w ogole czytany - to nie jest kwestia dyscypliny, tylko konstrukcji.
     ======================================================================== */

  /**
   * Przedzial wokol wartosci typowej.
   *
   * Wartosc typowa zaokraglana do pelnego tysiaca (klient ma to przeczytac,
   * a nie policzyc), konce przedzialu do pelnych 500 zl na zewnatrz - lepiej
   * podac przedzial odrobine szerszy niz obiecac wezszy, niz wyjdzie.
   *
   * `maks` to twardy sufit rozpietosci, liczony od wartosci typowej. Samo
   * zaokraglanie potrafi rozszerzyc przedzial ponad zadany procent przy malych
   * kwotach - a obietnica "rozpietosc czesci pewnej maksymalnie 20%" ma byc
   * prawdziwa dla kazdego domu, nie tylko dla srednich.
   */
  function widelki(typowa, procent, maks) {
    var t = Math.round(typowa / 1000) * 1000;
    var od = Math.floor(t * (1 - procent) / 500) * 500;
    var doo = Math.ceil(t * (1 + procent) / 500) * 500;

    if (maks > 0) {
      var nadmiar = (doo - od) - t * maks;
      if (nadmiar > 0) {
        // Skracamy symetrycznie, do pelnych 100 zl, zeby sufit obowiazywal.
        var polowa = Math.ceil(nadmiar / 2 / 100) * 100;
        od += polowa;
        doo -= polowa;
      }
    }
    return { od: od, typowa: t, do: doo };
  }

  /** Pasmo metrazu z cennika publicznego. */
  function pasmoDla(pub, metraz) {
    var pasma = pub.czescPewna.pasma;
    for (var i = 0; i < pasma.length; i++) {
      if (metraz <= pasma[i].doM2) return pasma[i];
    }
    return pasma[pasma.length - 1];
  }

  /**
   * Widelki dla klienta, rozdzielone na dwie czesci.
   *
   * Rozdzielone celowo. Czesc pewna - pompa, montaz, instalacja wewnetrzna -
   * jest przewidywalna i moze miec waskie widelki. Odwiert zalezy od tego,
   * co jest pod dzialka, i tego nikt nie wie przed rozpoznaniem gruntu.
   * Wrzucenie obu do jednej kwoty daje albo rozpietosc, ktora nic nie mowi,
   * albo falszywa precyzje w tej czesci, ktora jej nie ma.
   *
   * konfig = { metraz, rokBudowy, ocieplenie, osoby, cwu, chlodzenie,
   *            rekuperacja, budynek: 'istniejacy'|'nowy' }
   * strefaGruntu = 'A' | 'B' | 'C' | 'D' (z kodu pocztowego)
   */
  function widelkiPubliczne(konfig, strefaGruntu) {
    var pub = wymagajPublicznego();
    konfig = konfig || {};

    var metraz = Number(konfig.metraz) || 150;
    var pasmo = pasmoDla(pub, metraz);

    /* --- Czesc pewna: pompa + montaz + instalacja wewnetrzna -------------- */
    var typowaPewna = pasmo.typowaBrutto;

    var dodatki = [];
    (pub.czescPewna.opcje || []).forEach(function (o) {
      if (konfig[o.klucz]) {
        typowaPewna += o.brutto;
        dodatki.push({ nazwa: o.nazwa, brutto: o.brutto });
      }
    });

    // Budynek istniejacy: instalacja wewnetrzna czesto wymaga przerobek.
    if (konfig.budynek === "istniejacy" && pub.czescPewna.dopłataIstniejacy) {
      typowaPewna += pub.czescPewna.dopłataIstniejacy;
      // Ten napis czyta klient na stronie, wiec z polskimi znakami.
      dodatki.push({ nazwa: "budynek istniejący - przeróbki instalacji", brutto: pub.czescPewna.dopłataIstniejacy });
    }

    var czescPewna = widelki(typowaPewna, pub.czescPewna.rozrzut, pub.czescPewna.maksRozpietosc);

    /* --- Dolne zrodlo: osobne widelki, zalezne od strefy gruntu ---------- */
    var strefa = pub.strefyGruntu[strefaGruntu] || pub.strefyGruntu[pub.strefaDomyslna];
    var metrowOdwiertu = Math.ceil((pasmo.mocKw * strefa.mbNaKw) / 10) * 10;
    var typowyOdwiert = metrowOdwiertu * strefa.stawkaMbBrutto;
    var odwiert = widelki(typowyOdwiert, strefa.rozrzut, 0);

    /* --- Razem i dotacja -------------------------------------------------- */
    var razem = {
      od: czescPewna.od + odwiert.od,
      typowa: czescPewna.typowa + odwiert.typowa,
      do: czescPewna.do + odwiert.do,
    };

    // Dwa rozne programy, dwie rozne kwoty. Budynek nowy nie kwalifikuje sie do
    // Czystego Powietrza, a istniejacy - do Mojego Ciepla. Podanie jednej
    // uśrednionej kwoty byloby po prostu nieprawda.
    var d = (konfig.budynek === "nowy") ? pub.dotacja.nowy : pub.dotacja.istniejacy;
    var kwotaDotacji = Math.min(
      Math.round(razem.typowa * d.udzial),
      d.maks,
    );

    return {
      wersjaCennika: pub.wersja,
      dataCennika: pub.data,
      metraz: metraz,
      mocKw: pasmo.mocKw,
      strefaGruntu: strefa.kod,

      czescPewna: {
        zakres: czescPewna,
        zawiera: pub.czescPewna.zawiera,
        dodatki: dodatki,
        // Rozpietosc czesci pewnej nie moze przekroczyc 20% - inaczej widelki
        // przestaja byc informacja, a staja sie zaslona.
        rozpietoscProc: Math.round((czescPewna.do - czescPewna.od) / czescPewna.typowa * 100),
      },

      dolneZrodlo: {
        zakres: odwiert,
        metrow: metrowOdwiertu,
        opisStrefy: strefa.opis,
        coDomknieWidelki: "rozpoznanie gruntu na dzialce",
      },

      razem: razem,

      dofinansowanie: {
        nazwa: d.nazwa,
        szacowanaKwota: kwotaDotacji,
        // Nigdy "cena". To jest szacunek zalezny od decyzji, ktorej nie
        // podejmuje ani klient, ani DEWAX.
        szacowanyKosztPoDofinansowaniu: razem.typowa - kwotaDotacji,
        zastrzezenie: d.zastrzezenie,
      },

      zastrzezenie: pub.zastrzezenie,
      wazneDni: pub.wazneDni,
    };
  }

  /* ========================================================================
     CZESC 4 - SNAPSHOT WYCENY
     ======================================================================== */

  /**
   * Komplet do zapisania w HubSpocie: dane wejsciowe, wynik, wersja cennika,
   * data i identyfikator. Bez tego nie da sie po miesiacu odpowiedziec na
   * pytanie "skad wzieliscie te kwote" - a dzis HubSpot przechowuje wylacznie
   * kwote koncowa, bez zadnego wejscia.
   */
  function snapshot(rodzaj, konfig, wynik) {
    var teraz = new Date();
    return {
      identyfikator: identyfikatorWyceny(teraz),
      rodzaj: rodzaj,                       // 'zespol' albo 'publiczna'
      data: teraz.toISOString(),
      wersjaCennika: wynik.wersjaCennika,
      wejscie: konfig,
      wynik: wynik,
    };
  }

  function identyfikatorWyceny(kiedy) {
    var d = kiedy || new Date();
    var los = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");
    return "W-" + d.toISOString().slice(0, 10).replace(/-/g, "") + "-" + los;
  }

  /** Snapshot jako czytelna notatka - to trafia na kontakt w HubSpocie. */
  function snapshotJakoNotatka(s) {
    var l = [];
    l.push("WYCENA " + s.identyfikator + " (" + s.rodzaj + ")");
    l.push("Cennik: " + s.wersjaCennika + " | data: " + s.data);
    l.push("");
    l.push("DANE WEJSCIOWE:");
    Object.keys(s.wejscie || {}).forEach(function (k) {
      var v = s.wejscie[k];
      l.push("  " + k + ": " + (typeof v === "object" ? JSON.stringify(v) : String(v)));
    });
    l.push("");
    if (s.wynik.pozycje) {
      l.push("KOSZTORYS (netto):");
      s.wynik.pozycje.forEach(function (p) {
        l.push("  " + p.nazwa + ": " + p.netto + " zl");
      });
      l.push("  RAZEM netto: " + s.wynik.netto + " zl");
      l.push("  VAT " + s.wynik.stawkaVat + "%: " + s.wynik.vat + " zl");
      l.push("  RAZEM brutto: " + s.wynik.brutto + " zl");
    } else {
      l.push("WIDELKI:");
      l.push("  czesc pewna: " + s.wynik.czescPewna.zakres.od + " - " + s.wynik.czescPewna.zakres.do
        + " zl (typowo " + s.wynik.czescPewna.zakres.typowa + ")");
      l.push("  dolne zrodlo: " + s.wynik.dolneZrodlo.zakres.od + " - " + s.wynik.dolneZrodlo.zakres.do
        + " zl (" + s.wynik.dolneZrodlo.metrow + " mb, strefa " + s.wynik.strefaGruntu + ")");
      l.push("  razem typowo: " + s.wynik.razem.typowa + " zl");
      l.push("  szacowany koszt po mozliwym dofinansowaniu: "
        + s.wynik.dofinansowanie.szacowanyKosztPoDofinansowaniu + " zl");
    }
    return l.join("\n");
  }

  /* ======================================================================== */

  var API = {
    zaladuj: zaladuj,
    wycenaDokladna: wycenaDokladna,
    widelkiPubliczne: widelkiPubliczne,
    // Ponizsze wystawione, bo kreator uzywa ich osobno przy rysowaniu kart.
    mocProjektowa: mocProjektowa,
    parametryDoboru: parametryDoboru,
    wymiaryDolnegoZrodla: wymiaryDolnegoZrodla,
    bazaMocy: bazaMocy,
    dobierzModel: dobierzModel,
    specW: specW,
    snapshot: snapshot,
    snapshotJakoNotatka: snapshotJakoNotatka,
    identyfikatorWyceny: identyfikatorWyceny,
    get wersja() { return CENNIK && CENNIK.wersja; },
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  globalny.DEWAX_CORE = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
