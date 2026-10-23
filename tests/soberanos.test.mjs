// Soberanos en dólares: cupones step-up y cronogramas de amortización.
//
// Correr:  node --test "tests/**/*.test.mjs"      (desde web/)
//
// Los valores esperados salen del prospecto (ficha técnica de BYMA) y coinciden con los
// flujos que publica MAE en "flujo de fondos" (consultado el 23/10/2026): GD30 paga 0,24 de
// renta en ene-27 y 0,42 en ene-28, y AE38 2,50 en ene-27 y 2,39 en ene-28.

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { cargar } from './extract.mjs';

let B;
before(async () => { B = await cargar(); });

const D = s => new Date(s + 'T12:00:00');
const iso = d => d.toISOString().slice(0, 10);
const casi = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) < tol, `${a} ≠ ${b}`);

const sob = tk => {
  const b = B.SOBERANOS.find(x => x.ticker === tk);
  assert.ok(b, `falta ${tk} en SOBERANOS`);
  return b;
};
// Cronograma completo, igual que buildCFEntry: cupón step-up vía cuponDe, cuotas o bullet.
const cronograma = tk => {
  const b = sob(tk), vd = D(b.venc);
  const amort = b.amortSched.length ? b.amortSched : [{ fecha: b.venc, pct: 100 }];
  return B.buildSchedule(D(b.fecha_emision), D(b.fecha_inicio_int), vd, B.cuponDe(b),
                         b.periodicidad, b.base_dias, amort, b.devengo);
};
// Flujo de una fecha de pago teórica (el 9 de julio es feriado: se paga el hábil siguiente)
const flujo = (cf, teorica) => {
  const f = iso(B.adjustDate(D(teorica)));
  const x = cf.find(y => iso(y.fecha) === f);
  assert.ok(x, `no hay flujo el ${f}`);
  return x;
};

test('tasaCupon: cada tasa rige desde su fecha inclusive', () => {
  const t = B.tasaCupon([{ desde: '2023-07-09', tasa: 0.75 }, { desde: '2027-07-09', tasa: 1.75 }]);
  casi(t(D('2027-07-08')), 0.0075, 1e-12);
  casi(t(D('2027-07-09')), 0.0175, 1e-12);
  casi(B.tasaCupon(6.5)(D('2030-01-01')), 0.065, 1e-12);       // tasa fija: igual que antes
});

test('GD30: step-up de 0,75% a 1,75% en jul-27 sobre el capital que queda', () => {
  const cf = cronograma('GD30');
  // capital 64 (ya pagó 4% + 4 cuotas de 8%); 0,75%/2 × 64 = 0,24
  casi(flujo(cf, '2027-01-09').interes, 0.24);  casi(flujo(cf, '2027-01-09').amort, 8);
  casi(flujo(cf, '2027-07-09').interes, 0.21);  // 0,75%/2 × 56
  casi(flujo(cf, '2028-01-09').interes, 0.42);  // 1,75%/2 × 48: el tramo arranca el 09/07/2027
  casi(cf.reduce((s, x) => s + x.amort, 0), 100);
  assert.equal(sob('GD30').cupon, 0.75, 'la tasa que se muestra es la vigente hoy');
});

test('AE38: 5% y 22 cuotas iguales desde jul-27', () => {
  const cf = cronograma('AE38');
  casi(flujo(cf, '2027-01-09').interes, 2.5);
  casi(flujo(cf, '2027-07-09').amort, 4.5455, 1e-4);
  casi(flujo(cf, '2028-01-09').interes, 2.3864, 1e-3);          // 5%/2 × 95,4545
  casi(cf.reduce((s, x) => s + x.amort, 0), 100);
  assert.equal(cf.at(-1).capital > 0 && iso(cf.at(-1).fecha), iso(B.adjustDate(D('2038-01-09'))));
});

test('GD35 y GD41: los saltos de tasa que todavía faltan', () => {
  const c35 = cronograma('GD35');
  casi(flujo(c35, '2027-07-09').interes, 2.0625);   // 4,125%/2
  casi(flujo(c35, '2028-01-09').interes, 2.375);    // 4,75%/2
  casi(flujo(c35, '2029-01-09').interes, 2.5);      // 5%/2
  const c41 = cronograma('GD41');
  // 28 cuotas desde ene-28. El cupón de jul-29 devenga 3,5%/2 sobre lo que quedaba el 09/01/2029
  // (pagadas ene-28, jul-28 y ene-29): 1,75% × 89,29 = 1,5625. El de ene-30 ya va al 4,875%/2
  // sobre 85,71 (pagada también jul-29) = 2,0893.
  casi(flujo(c41, '2029-07-09').interes, 0.0175 * (100 - 3 * 100 / 28), 2e-3);
  casi(flujo(c41, '2030-01-09').interes, 0.024375 * (100 - 4 * 100 / 28), 2e-3);
});

test('GD46: 44 cuotas desde ene-25, la última absorbe el redondeo', () => {
  const b = sob('GD46');
  assert.equal(b.amortSched.length, 44);
  assert.equal(b.amortSched[0].fecha, '2025-01-09');
  assert.equal(b.amortSched.at(-1).fecha, '2046-07-09');
  casi(b.amortSched.reduce((s, a) => s + a.pct, 0), 100, 1e-9);
});

test('Ley y jurisdicción: Globales en NY, Bonares locales', () => {
  for (const tk of ['GD29', 'GD30', 'GD35', 'GD38', 'GD41', 'GD46']) {
    assert.equal(sob(tk).leg, 'Nueva York'); assert.equal(sob(tk).jur, 'Estados Unidos');
  }
  for (const tk of ['AL29', 'AL30', 'AL35', 'AE38', 'AL41', 'AN29', 'AO27', 'AO28', 'AO29']) {
    assert.equal(sob(tk).leg, 'Argentina'); assert.equal(sob(tk).jur, 'Argentina');
  }
  assert.ok(B.SOBERANOS.every(b => b.soberano && b.moneda === 'USD' && b.base_dias === '30_360'));
});

test('AN29: 6,5% semestral los 30/05 y 30/11', () => {
  const cf = cronograma('AN29');
  casi(flujo(cf, '2026-11-30').interes, 3.25);
  casi(flujo(cf, '2029-11-30').total, 103.25);
});

test('AO28: 6% mensual a fin de mes, 0,5 por mes en 30/360', () => {
  const cf = cronograma('AO28');
  casi(flujo(cf, '2027-04-30').interes, 0.5);
  casi(flujo(cf, '2027-09-30').interes, 0.5);
  const ult = cf.at(-1);
  assert.equal(iso(ult.fecha), iso(B.adjustDate(D('2028-10-31'))));
  casi(ult.total, 100.5);
});
