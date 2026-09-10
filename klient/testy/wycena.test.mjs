import { test } from "node:test";
import assert from "node:assert/strict";
import { policzWidelki, pompaPolecana, mocProjektowa, POMPY } from "../lib/wycena.mjs";

test("dom 150 m2, nowy, podłogówka, odwierty pionowe: widełki mają sens", () => {
  const w = policzWidelki({ m2: 150, stan: "nowy", ogrzewanie: "podlogowe", pompa: "r290_g2s", dz: "pionowe" });
  assert.equal(w.pDesign, 5.7);
  assert.equal(w.polecana, "r290_g2s");
  assert.equal(w.kaskada, false);
  assert.ok(w.od < w.do, "od musi być mniejsze niż do");
  assert.equal(w.od % 1000, 0);
  assert.equal(w.do % 1000, 0);
  // część stała: pompa 23977.61 + montaż 6000 + zasobnik 2600, każda pozycja +8% VAT
  assert.equal(w.czescStala.brutto, 25896 + 6480 + 2808);
  // dolne źródło rośnie przy słabszym gruncie
  assert.ok(w.dz.do.ilosc > w.dz.od.ilosc);
  assert.ok(w.dz.od.otwory >= 1);
});

test("zgodność doboru odwiertu z kreatorem zespołowym (grunt ryczałtowy)", () => {
  // pDesign 5.7 kW, pompa G2S 7.74 kW / COP 4.57:
  // pHeatBase = max(5.7, min(7.74*0.9, 5.7*1.15)) = 6.555
  // reqZ = 6.555 * 3.57/4.57 * 1.15 = 5.889 kW
  // mb = ceil(5889/43.3/10)*10 = 140
  const w = policzWidelki({ m2: 150, stan: "nowy", ogrzewanie: "podlogowe", pompa: "r290_g2s", dz: "pionowe" });
  assert.equal(w.dz.od.ilosc, 140);
  assert.equal(w.dz.od.otwory, 2);
  assert.equal(w.dz.od.netto, 140 * 140);
});

test("HELIX: liczba sond parzysta", () => {
  const w = policzWidelki({ m2: 180, stan: "ocieplony", ogrzewanie: "grzejniki", pompa: "r290_g3s", dz: "koszowe" });
  assert.equal(w.dz.od.ilosc % 2, 0);
  assert.equal(w.dz.do.ilosc % 2, 0);
});

test("kolektor poziomy: metry zaokrąglone do 10", () => {
  const w = policzWidelki({ m2: 120, stan: "nowy", ogrzewanie: "podlogowe", pompa: "r290_g2s", dz: "poziome" });
  assert.equal(w.dz.od.ilosc % 10, 0);
  assert.ok(w.dz.od.powierzchnia > 0);
});

test("duży, nieocieplony dom: kaskada", () => {
  const p = mocProjektowa(300, "bez");
  assert.equal(pompaPolecana(p), null);
  const w = policzWidelki({ m2: 300, stan: "bez", ogrzewanie: "grzejniki", pompa: "r290_g6s", dz: "pionowe" });
  assert.equal(w.kaskada, true);
});

test("za mała pompa jest oznaczona", () => {
  const w = policzWidelki({ m2: 250, stan: "ocieplony", ogrzewanie: "podlogowe", pompa: "r290_g2s", dz: "pionowe" });
  assert.equal(w.zaMala, true);
});

test("odrzuca złe dane", () => {
  assert.throws(() => policzWidelki({ m2: 10, stan: "nowy", ogrzewanie: "podlogowe", pompa: "r290_g2s", dz: "pionowe" }));
  assert.throws(() => policzWidelki({ m2: 150, stan: "xxx", ogrzewanie: "podlogowe", pompa: "r290_g2s", dz: "pionowe" }));
  assert.throws(() => policzWidelki({ m2: 150, stan: "nowy", ogrzewanie: "podlogowe", pompa: "buderus", dz: "pionowe" }));
  assert.throws(() => policzWidelki({ m2: 150, stan: "nowy", ogrzewanie: "podlogowe", pompa: "r290_g2s", dz: "wodawoda" }));
});

test("katalog: cztery pompy TK R290 z cenami netto jak w kreatorze", () => {
  assert.equal(POMPY.length, 4);
  assert.deepEqual(POMPY.map((p) => p.cenaNetto), [23977.61, 26157.46, 27974.93, 30759.16]);
});
