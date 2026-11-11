// Precio promedio operado de la semana en el panel de la calculadora.
//
// Correr:  node --test "tests/**/*.test.mjs"      (desde web/)

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { cargar } from './extract.mjs';

let B;
before(async () => { B = await cargar(); });

test('semanaDesde: 7 días corridos que terminan en la última rueda', () => {
  assert.equal(B.semanaDesde('2026-11-05'), '2026-10-30');
  assert.equal(B.semanaDesde('2026-03-03'), '2026-02-25');
  assert.equal(B.semanaDesde('2027-01-04'), '2026-12-29');
  // Lo que pasaba con la DNCBO: la ventana iba hasta su última operación (23/09).
  // Contada hasta la última rueda cargada (05/11), el 23/09 queda afuera.
  assert.ok('2026-09-23' < B.semanaDesde('2026-11-05'));
});

test('promedioOperado pondera por monto y cuenta los días operados', () => {
  const ops = [
    { fecha: '2026-11-05', precio: 100, monto: 300, tna: 8 },
    { fecha: '2026-11-05', precio: 98, monto: 100, tna: 9 },
    { fecha: '2026-11-03', precio: 99, monto: 0, tna: null },
  ];
  const r = B.promedioOperado(ops, x => x.tna);
  assert.equal(r.vwap, 99.5);   // (100·300 + 98·100) / 400
  assert.equal(r.tna, 8.25);
  assert.equal(r.dias, 2);
  // Sin montos: promedio simple
  assert.equal(B.promedioOperado([{ fecha: 'a', precio: 98 }, { fecha: 'b', precio: 100 }], () => null).vwap, 99);
  assert.equal(B.promedioOperado([], () => null), null);
});
