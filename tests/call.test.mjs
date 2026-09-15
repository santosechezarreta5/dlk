// Tests de regresión del pricing de bonos, con foco en el rescate anticipado (call).
//
// Correr:  node --test tests/          (desde web/)
//
// Todos los casos son sintéticos y deterministas: no tocan la red ni la base. Los números
// esperados están calculados a mano en los comentarios, así que si un test falla se puede
// decidir si cambió el código o si cambió la convención a propósito.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { cargar } from './extract.mjs';

let B;
before(async () => { B = await cargar(); });

const d = s => new Date(s + 'T12:00:00');
const iso = x => x.toISOString().slice(0, 10);
/** Compara con tolerancia: los flujos se redondean a 4-6 decimales. */
const cerca = (a, e, tol = 1e-4, msg = '') =>
  assert.ok(Math.abs(a - e) <= tol, `${msg} esperado ${e}, obtenido ${a}`);

// Bono de referencia: 8% semestral, 30/360, bullet, 15/01/2024 → 15/01/2031.
const REF = { em: '2024-01-15', ii: '2024-01-15', vd: '2031-01-15', cupon: 8, per: 6, base: '30/360', dev: 'ajustado' };
const SETT = '2026-09-15';
const cf = (vd, amort = [], devengo = REF.dev) =>
  B.buildSchedule(d(REF.em), d(REF.ii), d(vd), REF.cupon, REF.per, REF.base, amort, devengo);
const call = (fecha, precio, amort = [], per = REF.per) =>
  B.buildCallCF(d(REF.em), d(REF.ii), d(fecha), REF.cupon, per, REF.base, amort, REF.dev, precio, d(SETT));

describe('cronograma base', () => {
  test('bullet semestral: 14 cupones y 100 de amortización al final', () => {
    // 15/01/2024 → 15/01/2031 son 7 años × 2 pagos.
    const s = cf(REF.vd).filter(x => x.interes > 0 || x.amort > 0);
    assert.equal(s.length, 14);
    cerca(s.at(-1).amort, 100, 1e-4, 'amortización final');
    assert.equal(s.slice(0, -1).every(x => x.amort === 0), true, 'no debe amortizar antes del vto');
  });

  test('devengo teórico: todos los cupones son exactamente 8%/2', () => {
    cf(REF.vd, [], 'teorico')
      .filter(x => x.interes > 0)
      .forEach(x => cerca(x.interes, 4, 1e-4, 'cupón teórico'));
  });

  test('devengo ajustado: el corrimiento a día hábil redistribuye, no crea interés', () => {
    // El cupón teórico del 15/01/2028 cae sábado y se paga el lunes 17: devenga 182/360
    // en vez de 180/360 → 4.0444. El período siguiente arranca más tarde y devenga menos.
    const s = cf(REF.vd);
    cerca(s.find(x => iso(x.fecha) === '2028-01-17').interes, 4.0444, 1e-4, 'cupón corrido');
    cerca(s.find(x => iso(x.fecha) === '2029-01-15').interes, 3.9556, 1e-4, 'el siguiente compensa');
  });

  test('el interés total de la vida del bono no depende de la convención', () => {
    const suma = a => a.reduce((t, x) => t + x.interes, 0);
    cerca(suma(cf(REF.vd)), suma(cf(REF.vd, [], 'teorico')), 1e-6, 'ajustado vs teórico');
    cerca(suma(cf(REF.vd)), 56, 1e-6, '14 cupones × 4');
  });

  test('el interés nunca es negativo aunque las fechas vengan inconsistentes', () => {
    // inicio_int ANTERIOR a la emisión (dato mal cargado): antes devengaba negativo.
    const s = B.buildSchedule(d('2025-10-12'), d('2025-01-13'), d('2026-10-12'), 1, 3, 'act365', [], 'ajustado');
    assert.ok(s.every(x => x.interes >= 0), 'ningún flujo debe tener interés negativo');
  });
});

describe('devengo con amortización intra-período', () => {
  // Cupón 15/01/2027 → 15/07/2027 con una cuota del 20% el 01/03/2027.
  // El capital es 100 los primeros 46 días (30/360) y 80 los 134 restantes:
  //   8% × (100 × 46/360 + 80 × 134/360) = 8% × 42.5556 = 3.4044
  // Antes se devengaba todo el período sobre el capital ya reducido: 8% × 80 × 180/360 = 3.2000
  test('prorratea por tramos de capital, no usa el capital posterior', () => {
    const c = cf(REF.vd, [{ fecha: '2027-03-01', pct: 20 }]).find(x => iso(x.fecha) === '2027-07-15');
    cerca(c.interes, 3.4044, 1e-4, 'interés del cupón');
  });

  test('si la cuota coincide con un cupón el resultado no cambia', () => {
    const conCuota = cf(REF.vd, [{ fecha: '2027-01-15', pct: 20 }]);
    const c = conCuota.find(x => iso(x.fecha) === '2027-07-15');
    cerca(c.interes, 3.2, 1e-4, 'interés sobre el capital ya reducido');
  });
});

describe('cashflow al call', () => {
  test('call entre cupones: stub de interés corrido exacto + rescate', () => {
    // 15/01/2027 → 15/04/2027 son 90/360: 8% × 0.25 × 100 = 2.0000
    const u = call('2027-04-15', 104).cf.at(-1);
    cerca(u.interes, 2, 1e-4, 'stub');
    cerca(u.amort, 104, 1e-4, 'rescate');
  });

  test('el precio de call se aplica sobre el capital VIGENTE', () => {
    // Cuota del 20% el 01/03 (lejos del call) → rescate = 104% de 80
    const u = call('2027-04-15', 104, [{ fecha: '2027-03-01', pct: 20 }]).cf.at(-1);
    cerca(u.amort, 83.2, 1e-4, 'rescate sobre el remanente');
    cerca(u.interes, 1.8044, 1e-4, 'interés prorrateado');
  });

  test('las cuotas posteriores al call no se pagan', () => {
    const u = call('2027-04-15', 104, [{ fecha: '2027-06-01', pct: 20 }]).cf.at(-1);
    cerca(u.amort, 104, 1e-4, 'se rescata el 100% del capital');
  });
});

describe('cuota que cae en la fecha de rescate', () => {
  // Convención: es un pago contractual de capital en su fecha, no un rescate anticipado.
  // Se paga a la PAR y el call redime sólo el remanente.
  test('se paga a la par y el call redime el resto', () => {
    // 20 a la par + 104% de 80 = 20 + 83.20 = 103.20   (no 104% de 100 = 104.00)
    const u = call('2027-04-15', 104, [{ fecha: '2027-04-12', pct: 20 }]).cf.at(-1);
    cerca(u.amort, 103.2, 1e-4, 'cuota a la par + remanente al call');
  });

  test('sin cuota cerca no cambia nada', () => {
    cerca(call('2027-04-15', 104).cf.at(-1).amort, 104, 1e-4);
  });

  test('con call a la par da lo mismo pagarla o absorberla', () => {
    const conCuota = call('2027-04-15', 100, [{ fecha: '2027-04-12', pct: 20 }]).cf.at(-1).amort;
    cerca(conCuota, 100, 1e-4, 'sin prima, el reparto no cambia el total');
  });

  test('el feriado no cambia el resultado (se comparan fechas ajustadas)', () => {
    // 12/10/2026 es feriado: cuota y cupón caen ahí y ambos se corren al 13/10. Comparando
    // la cuota sin ajustar contra el call ya ajustado, parecía anterior al rescate.
    const em = d('2024-10-12'), ii = d('2024-10-12'), vd = d('2028-10-12');
    const amort = [{ fecha: '2026-10-12', pct: 10 }];
    const cupones = B.buildSchedule(em, ii, vd, 8, 3, '30/360', amort, 'ajustado').map(x => x.fecha);
    const esc = B.activeCallScenarios([{ desde: '2025-01-01', precio: 102 }], cupones, d('2026-09-16'), vd);
    assert.equal(esc.length, 1);
    assert.equal(iso(esc[0].callDate), '2026-10-13', 'el ancla se corre al día hábil');
    const r = B.buildCallCF(em, ii, esc[0].callDate, 8, 3, '30/360', amort, 'ajustado', 102, d('2026-09-16'));
    // 10 a la par + 102% de 90 = 10 + 91.8 = 101.80
    cerca(r.cf.reduce((s, x) => s + x.amort, 0), 101.8, 1e-3, 'total amortizado');
  });
});

describe('base de anualización', () => {
  test('diasPeriodo es el período nominal, no el stub', () => {
    // Da lo mismo si el call cae entre cupones o justo en uno ya ajustado.
    assert.equal(call('2027-04-15', 104).diasPeriodo, 183);
    assert.equal(call('2028-01-17', 104).diasPeriodo, 183);
  });

  test('un bono de cupón anual se anualiza en base semestral', () => {
    // 2 × [(1+0.15)^(1/2) − 1] = 14.4761 %   (con diasPeriodo = 0 daba 15.0000)
    const dp = call('2028-01-17', 104, [], 12).diasPeriodo;
    cerca(B.tirToTNA(15, 12, dp), 14.4761, 1e-4);
  });

  test('las demás frecuencias no cambian', () => {
    cerca(B.tirToTNA(15, 6, 183), 14.4761, 1e-4);
    cerca(B.tirToTNA(15, 3, 91), 14.2232, 1e-4);
  });
});

describe('rendimiento del call en horizonte corto', () => {
  const escenario = (sett, precioCall = 100) => {
    const cupones = cf(REF.vd).map(x => x.fecha);
    const esc = B.activeCallScenarios([{ desde: '2025-01-15', precio: precioCall }], cupones, d(sett), d(REF.vd));
    const r = B.buildCallCF(d(REF.em), d(REF.ii), esc[0].callDate, REF.cupon, REF.per, REF.base, [], REF.dev, precioCall, d(sett));
    return r;
  };

  test('devuelve siempre el retorno simple del período', () => {
    const y = B.callYield(escenario('2026-12-15').cf, 112);
    assert.equal(y.dias, 31);
    cerca(y.simple * 100, -7.14, 0.01, 'retorno del período');
    assert.equal(y.corto, true);
  });

  test('a pocos días la TIR no converge, pero el escenario NO se descarta', () => {
    // Antes calcTIR devolvía null y el YTW volvía a la YTM: la alarma se apagaba justo
    // cuando el rescate era inminente.
    const y = B.callYield(escenario('2027-01-13').cf, 112);
    assert.equal(y.dias, 2);
    assert.equal(y.tir, null, 'la TIR anualizada no existe acá');
    assert.ok(y.simple < 0, 'pero el retorno del período sí, y es negativo');
    assert.equal(B._rankYTC(y.tir, y.simple), -Infinity, 'debe poder ganar el YTW');
  });

  test('sin TIR pero con retorno positivo no puede ser el peor escenario', () => {
    assert.equal(B._rankYTC(null, 0.05), null);
  });

  test('con TIR, rankea por la TIR redondeada a 2 decimales', () => {
    assert.equal(B._rankYTC(5.4321, -0.1), 5.43);
  });
});

describe('escenarios de call vigentes', () => {
  const cupones = () => cf(REF.vd).map(x => x.fecha);

  test('ventana futura: usa la fecha declarada', () => {
    const esc = B.activeCallScenarios([{ desde: '2027-11-20', precio: 103 }], cupones(), d(SETT), d(REF.vd));
    assert.equal(esc.length, 1);
    assert.equal(iso(esc[0].callDate), '2027-11-20');
    assert.equal(esc[0].open, false);
  });

  test('ventana abierta: ancla en el próximo cupón', () => {
    const esc = B.activeCallScenarios([{ desde: '2025-01-15', precio: 104 }], cupones(), d(SETT), d(REF.vd));
    assert.equal(esc.length, 1);
    assert.equal(iso(esc[0].callDate), '2027-01-15');
    assert.equal(esc[0].open, true);
  });

  test('descarta la condición superada por una posterior', () => {
    const esc = B.activeCallScenarios(
      [{ desde: '2024-01-15', precio: 105 }, { desde: '2026-01-15', precio: 102 }],
      cupones(), d(SETT), d(REF.vd));
    assert.equal(esc.length, 1, 'la ventana de 2024 ya fue superada por la de 2026');
    assert.equal(esc[0].precio, 102);
  });

  test('ignora condiciones sin precio y posteriores al vencimiento', () => {
    const esc = B.activeCallScenarios(
      [{ desde: '2027-01-15', precio: 0 }, { desde: '2032-01-15', precio: 100 }],
      cupones(), d(SETT), d(REF.vd));
    assert.equal(esc.length, 0);
  });
});
