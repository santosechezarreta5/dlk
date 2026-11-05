// Cronograma de amortización en la ficha de alta: cuotas iguales, resto al vencimiento y
// controles antes de guardar.
//
// Correr:  node --test "tests/**/*.test.mjs"      (desde web/)

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { cargar } from './extract.mjs';

let B;
before(async () => { B = await cargar(); });

const suma = s => s.reduce((t, x) => t + x.pct, 0);

test('cuotasIguales reparte 100% y la última absorbe el redondeo', () => {
  const tres = B.cuotasIguales('2028-10-22', 6, 3);
  assert.deepEqual(tres, [
    { fecha: '2028-10-22', pct: 33.33 }, { fecha: '2029-04-22', pct: 33.33 }, { fecha: '2029-10-22', pct: 33.34 }]);
  const cuatro = B.cuotasIguales('2027-01-16', 3, 4);
  assert.deepEqual(cuatro.map(x => x.pct), [25, 25, 25, 25]);
  assert.deepEqual(cuatro.map(x => x.fecha), ['2027-01-16', '2027-04-16', '2027-07-16', '2027-10-16']);
  // 11 cuotas (como Scania Clase 2): suman exactamente 100
  assert.ok(Math.abs(suma(B.cuotasIguales('2026-07-16', 3, 11)) - 100) < 1e-9);
});

test('cronogramaAmort ordena, descarta filas vacías y paga el resto al vencimiento', () => {
  const filas = [{ fecha: '2029-04-22', pct: 30 }, { fecha: '', pct: 10 }, { fecha: '2028-10-22', pct: 30 }, { fecha: '2028-01-01', pct: NaN }];
  assert.deepEqual(B.cronogramaAmort(filas, '2029-10-22'), [
    { fecha: '2028-10-22', pct: 30 }, { fecha: '2029-04-22', pct: 30 }, { fecha: '2029-10-22', pct: 40 }]);
  // Si ya hay una cuota al vencimiento, el resto se le suma
  assert.deepEqual(B.cronogramaAmort([{ fecha: '2028-10-22', pct: 50 }, { fecha: '2029-10-22', pct: 20 }], '2029-10-22'),
    [{ fecha: '2028-10-22', pct: 50 }, { fecha: '2029-10-22', pct: 50 }]);
  // Sin vencimiento no inventa el resto; sin cuotas, nada
  assert.deepEqual(B.cronogramaAmort([{ fecha: '2028-10-22', pct: 50 }], ''), [{ fecha: '2028-10-22', pct: 50 }]);
  assert.deepEqual(B.cronogramaAmort([], '2029-10-22'), []);
});

test('errorAmort: completo, entre la emisión y el vencimiento', () => {
  const ok = [{ fecha: '2028-10-22', pct: 50 }, { fecha: '2029-10-22', pct: 50 }];
  assert.equal(B.errorAmort(ok, '2026-10-22', '2029-10-22'), '');
  assert.match(B.errorAmort([], '2026-10-22', '2029-10-22'), /elegí Bullet/);
  assert.match(B.errorAmort([{ fecha: '2028-10-22', pct: 60 }, { fecha: '2029-10-22', pct: 50 }], '', '2029-10-22'), /suma 110\.00%/);
  assert.match(B.errorAmort([{ fecha: '2030-01-01', pct: 100 }], '', '2029-10-22'), /después del vencimiento/);
  assert.match(B.errorAmort([{ fecha: '2026-10-22', pct: 100 }], '2026-10-22', '2029-10-22'), /emisión o antes/);
});
