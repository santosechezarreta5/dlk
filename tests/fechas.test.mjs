// Fechas de cupón en días 29-31 y base de la TNA.
//
// Correr:  node --test "tests/**/*.test.mjs"      (desde web/)
//
// buildSchedule encadenaba setMonth: 29/11 + 3 meses = "29/02" → 01/03, y desde ahí todas las
// fechas siguientes quedaban en el día 1. Y un bono 30/09 con vencimiento 31/03 pagaba los 30/03
// más un stub de un día al 31/03. Ahora cada fecha se calcula desde inicio_int con el día ancla
// recortado a fin de mes.

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { cargar } from './extract.mjs';

let B;
before(async () => { B = await cargar(); });

const D = s => new Date(s + 'T12:00:00');
const iso = d => d.toISOString().slice(0, 10);
// fechas efectivas esperadas: las teóricas corridas a día hábil, igual que buildSchedule
const esperadas = teoricas => teoricas.map(s => iso(B.adjustDate(D(s))));
const fechas = cf => cf.map(x => iso(x.fecha));

test('addMonths recorta a fin de mes en vez de desbordar', () => {
  assert.equal(iso(B.addMonths(D('2026-01-31'), 1)), '2026-02-28');
  assert.equal(iso(B.addMonths(D('2026-01-31'), 2)), '2026-03-31');
  assert.equal(iso(B.addMonths(D('2026-11-29'), 3)), '2027-02-28');
  assert.equal(iso(B.addMonths(D('2027-11-29'), 3)), '2028-02-29');          // bisiesto
  assert.equal(iso(B.addMonths(D('2026-05-31'), -3)), '2026-02-28');
  assert.equal(iso(B.addMonths(D('2026-02-28'), 6, 31)), '2026-08-31');      // día ancla explícito
});

test('trimestral del 29: febrero no corre las fechas siguientes', () => {
  const cf = B.buildSchedule(D('2026-05-29'), D('2026-08-29'), D('2027-08-29'), 8, 3, 'act365', [], 'ajustado');
  assert.deepEqual(fechas(cf), esperadas(['2026-08-29', '2026-11-29', '2027-02-28', '2027-05-29', '2027-08-29']));
});

test('fin de mes: 30/09 con vencimiento 31/03 paga los 31/03, sin stub de un día', () => {
  const cf = B.buildSchedule(D('2025-03-31'), D('2025-09-30'), D('2028-03-31'), 8, 6, 'act365', [], 'teorico');
  assert.deepEqual(fechas(cf), esperadas(['2025-09-30', '2026-03-31', '2026-09-30', '2027-03-31', '2027-09-30', '2028-03-31']));
  assert.ok(cf.every(x => x.interes > 0), 'no debería haber un flujo de interés cero al final');
});

test('fin de mes: 28/02 con vencimiento 31/08 paga los 31/08 y el 29/02 en bisiesto', () => {
  const cf = B.buildSchedule(D('2026-08-31'), D('2027-02-28'), D('2028-08-31'), 5, 6, 'act365', [], 'teorico');
  assert.deepEqual(fechas(cf), esperadas(['2027-02-28', '2027-08-31', '2028-02-29', '2028-08-31']));
});

test('si inicio_int y vencimiento son el 28 o el 30, el ancla se respeta', () => {
  const c28 = B.buildSchedule(D('2026-08-28'), D('2027-02-28'), D('2028-08-28'), 5, 6, 'act365', [], 'teorico');
  assert.deepEqual(fechas(c28), esperadas(['2027-02-28', '2027-08-28', '2028-02-28', '2028-08-28']));
  const c30 = B.buildSchedule(D('2026-01-15'), D('2026-06-30'), D('2027-12-30'), 5, 6, 'act365', [], 'teorico');
  assert.deepEqual(fechas(c30), esperadas(['2026-06-30', '2026-12-30', '2027-06-30', '2027-12-30']));
});

test('primer cupón derivado del vencimiento (bono sin inicio_int)', () => {
  assert.equal(iso(B.primerCupon(D('2025-06-15'), D('2030-05-31'), 3)), '2025-08-31');
  assert.equal(iso(B.primerCupon(D('2025-06-15'), D('2030-05-29'), 6)), '2025-11-29');
});

test('TNA trimestral: un bono a la par en fecha de cupón da el cupón', () => {
  for (const base of ['30_360', 'act365']) {
    const cf = B.applySettlement(B.buildSchedule(D('2026-01-15'), D('2026-04-15'), D('2031-01-15'), 8, 3, base, [], 'teorico'), D('2026-01-15'));
    const tna = B.tirToTNA(B.calcTIR(cf, 100), 3, 91);
    assert.ok(Math.abs(tna - 8) < 0.01, `${base}: TNA ${tna} debería ser ~8`);
  }
});

test('la etiqueta de la TNA dice la base que realmente usa tirToTNA', () => {
  assert.equal(B.tnaBase(3, 91), '90/360');
  assert.equal(B.tnaBase(1, 30), '30/360');
  assert.equal(B.tnaBase(6, 182), '180/360');
  assert.equal(B.tnaBase(12, 365), '180/360');
  assert.equal(B.tnaBase(0), '180/360');
});
