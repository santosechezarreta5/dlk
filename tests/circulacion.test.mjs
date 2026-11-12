// Monto en circulación: formato, cruce por ticker y participación de los tenedores.
//
// Correr:  node --test "tests/**/*.test.mjs"      (desde web/)

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { cargar } from './extract.mjs';

let B;
before(async () => { B = await cargar(); });

test('fmtCirc: millones sin decimales desde 10 M, uno debajo, miles abajo de 1 M', () => {
  assert.equal(B.fmtCirc(213462519), '213 M');
  assert.equal(B.fmtCirc(8695955813.76), '8.696 M');
  assert.equal(B.fmtCirc(7216614), '7,2 M');
  assert.equal(B.fmtCirc(850000), '850 k');
  assert.equal(B.fmtCirc(null), '—');
});

test('circDe busca por ticker y si no por el canónico (forma O)', () => {
  const m = { DNCBO: { monto: 1 }, GD30: { monto: 2 } };
  assert.equal(B.circDe(m, 'DNCBD', 'DNCBO').monto, 1);
  assert.equal(B.circDe(m, 'GD30', 'GD30').monto, 2);
  assert.equal(B.circDe(m, 'XXXXO', 'XXXXO'), null);
  assert.equal(B.circDe(null, 'GD30', 'GD30'), null);
});

test('circTitle dice cuánto, lo emitido si difiere y de dónde sale', () => {
  const t = B.circTitle({ monto: 8695955813.76, emitido: 13587430959, fuente: 'byma', fecha: '2026-11-12' });
  assert.match(t, /en circulación: US\$ 8\.695\.955\.814/);
  assert.match(t, /Emitido: US\$ 13\.587\.430\.959/);
  assert.match(t, /BYMA, ficha técnica · 12\/11\/2026/);
  assert.doesNotMatch(B.circTitle({ monto: 5e6, emitido: 5e6, fuente: 'licitacion' }), /Emitido/);
  assert.match(B.circTitle(null), /Sin dato/);
});

test('vrAl: lo que queda sin amortizar a una fecha', () => {
  // GD30: 4% en jul-24 y 8% semestral desde ene-25 → a nov-26 quedan 64%
  const gd30 = [{ fecha: '2024-07-09', pct: 4 }, ...['2025-01-09', '2025-07-09', '2026-01-09', '2026-07-09', '2027-01-09']
    .map(fecha => ({ fecha, pct: 8 }))];
  assert.ok(Math.abs(B.vrAl(gd30, '2026-11-12') - 0.64) < 1e-12);
  assert.equal(B.vrAl([], '2026-11-12'), 1);
  assert.equal(B.vrAl(undefined, '2026-11-12'), 1);
});

test('pctCirculante: tenencia a mercado sobre el circulante a precio de hoy', () => {
  // Bullet a 99: US$ 5,3 M sobre 213,46 M VN → 5,3 / (213,46 × 0,99)
  assert.ok(Math.abs(B.pctCirculante(5.3e6, 213462519, 1, 99) - 5.3e6 / (213462519 * 0.99) * 100) < 1e-9);
  // Amortizable: 8.696 M residual con 64% de VR a 60 por 100 VN original → valor 8.152 M
  const v = 8695955813.76 / 0.64 * 0.60;
  assert.ok(Math.abs(B.pctCirculante(100e6, 8695955813.76, 0.64, 60) - 100e6 / v * 100) < 1e-9);
  // Sin precio: a la par
  assert.equal(B.pctCirculante(10e6, 100e6, 1, null), 10);
  assert.equal(B.pctCirculante(10e6, null, 1, 99), null);
  assert.equal(B.pctCirculante(null, 100e6, 1, 99), null);
});
