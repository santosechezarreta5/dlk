// Exportar la tabla de bonos a Excel: celdas tipadas (números, %, fechas) y la hoja de SheetJS.
//
// Correr:  node --test "tests/**/*.test.mjs"      (desde web/)

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { cargar } from './extract.mjs';

let B;
before(async () => { B = await cargar(); });

test('serialExcel: fecha ISO a número de serie de Excel', () => {
  assert.equal(B.serialExcel('1900-03-01'), 61);
  assert.equal(B.serialExcel('2026-11-12'), 46338);
  assert.equal(B.serialExcel('2029-07-03'), 47302);
  assert.equal(B.serialExcel(null), null);
});

test('celdaExcel exporta lo que muestra la fila, como número o fecha', () => {
  const b = {
    ticker: 'DNCBO', emisor: 'Edenor', sector: 'Energía', subsector: '', callable: 'Si',
    fecha_emision: '2026-07-03', venc: '2029-07-03', tir: 8.74, bidTna: 8.56, askTna: null,
    vol: 542502.959, circ: 213462519, dur: 2.3456, leg: 'Argentina', jur: 'Estados Unidos', _rating: 'B-',
    ytwKind: 'YTM', ytwTna: 8.5, _fila: { bid: 99.12, ask: 0, tna: 8.6, pesos: false },
  };
  const c = id => B.celdaExcel(id, b);
  assert.deepEqual(c('ticker'), { v: 'DNCBO' });
  assert.equal(c('subsector'), null);                                   // vacío → celda vacía
  assert.deepEqual(c('bid'), { v: 99.12, z: '#,##0.00' });
  assert.equal(c('ask'), null);                                         // sin offer
  assert.deepEqual(c('bidTna'), { v: 0.0856, z: B.XL_PCT });
  assert.equal(c('askTna'), null);
  assert.ok(Math.abs(c('tir').v - 0.0874) < 1e-12);
  assert.ok(Math.abs(c('tna').v - 0.086) < 1e-12);                      // la TNA de la fila
  assert.deepEqual(c('circ'), { v: 213462519, z: '#,##0' });
  assert.deepEqual(c('dur'), { v: 2.35, z: '0.00' });
  assert.deepEqual(c('venc'), { v: 47302, z: B.XL_FECHA });
  assert.deepEqual(c('callable'), { v: 'Sí' });
  assert.deepEqual(c('rating'), { v: 'B-' });
  assert.equal(c('ytw').v, 0.085);
  // Precio en pesos (dollar linked o vista en pesos): sin decimales
  assert.deepEqual(B.celdaExcel('bid', { _fila: { bid: 152262, pesos: true } }), { v: 152262, z: '#,##0' });
  // YTW a un call cercano: retorno del período sin anualizar → queda como texto
  const corto = { ytwKind: 'call', ytwDias: 20, ytwSimple: 0.012, ytwTna: 25 };
  assert.deepEqual(B.celdaExcel('ytw', corto), { v: '1.20% en 20d' });
});

test('hojaExcel arma títulos, celdas tipadas, rango, autofiltro y anchos', () => {
  const ws = B.hojaExcel(['Ticker', 'Vencimiento', 'TIR %'], [
    [{ v: 'DNCBO' }, { v: 47302, z: B.XL_FECHA }, { v: 0.0874, z: B.XL_PCT }],
    [{ v: 'GD30' }, null, { v: 0.1 }],
  ]);
  assert.deepEqual(ws.A1, { t: 's', v: 'Ticker' });
  assert.deepEqual(ws.B2, { t: 'n', v: 47302, z: B.XL_FECHA });
  assert.deepEqual(ws.C2, { t: 'n', v: 0.0874, z: B.XL_PCT });
  assert.deepEqual(ws.C3, { t: 'n', v: 0.1 });
  assert.equal(ws.B3, undefined);                                       // celda vacía
  assert.equal(ws['!ref'], 'A1:C3');
  assert.deepEqual(ws['!autofilter'], { ref: 'A1:C3' });
  assert.deepEqual(ws['!cols'].map(c => c.wch), [8, 13, 9]);
  // Más de 26 columnas: AA, AB...
  const ancha = B.hojaExcel(Array.from({ length: 28 }, (_, i) => 'c' + i), []);
  assert.equal(ancha['!ref'], 'A1:AB1');
  assert.deepEqual(ancha.AB1, { t: 's', v: 'c27' });
});

test('ruedaDe: hoy si es hábil y ya abrió el mercado; si no, el hábil anterior', () => {
  const r = (y, m, d, h) => B.ruedaDe(new Date(y, m - 1, d, h, 30));
  assert.equal(r(2026, 11, 12, 15), '2026-11-12');   // jueves, rueda abierta o cerrada
  assert.equal(r(2026, 11, 12, 9), '2026-11-11');    // jueves antes de las 11: precios del miércoles
  assert.equal(r(2026, 11, 14, 10), '2026-11-13');   // sábado
  assert.equal(r(2026, 11, 15, 18), '2026-11-13');   // domingo
  assert.equal(r(2026, 11, 23, 15), '2026-11-20');   // lunes feriado
  assert.equal(r(2026, 11, 24, 10), '2026-11-20');   // martes temprano, después del feriado
  assert.equal(r(2026, 12, 9, 9), '2026-12-04');     // después de dos feriados seguidos (7 y 8/12)
});

test('celdaExcel "Precio al": la rueda, la última operación o manual', () => {
  const rueda = '2026-11-12';
  assert.deepEqual(B.celdaExcel('precioAl', { _fila: { bid: 99.1 } }, rueda), { v: B.serialExcel(rueda), z: B.XL_FECHA });
  assert.deepEqual(B.celdaExcel('precioAl', { precio: 99, _fila: {} }, rueda), { v: B.serialExcel(rueda), z: B.XL_FECHA });
  assert.deepEqual(B.celdaExcel('precioAl', { priceSrc: 'hist', histDate: '2026-09-23', precio: 99.12, _fila: {} }, rueda),
    { v: B.serialExcel('2026-09-23'), z: B.XL_FECHA });
  assert.deepEqual(B.celdaExcel('precioAl', { manualOverride: true, precio: 98, _fila: {} }, rueda), { v: 'manual' });
  assert.equal(B.celdaExcel('precioAl', { _fila: {} }, rueda), null);   // sin precio
});

test('hojaExcel con encabezado: título en A1 y la tabla desde la fila 3', () => {
  const ws = B.hojaExcel(['Ticker', 'TIR %'], [[{ v: 'DNCBO' }, { v: 0.0874, z: B.XL_PCT }]],
    'Bonos Hard dollar · precios y tasas al 12/11/2026');
  assert.deepEqual(ws.A1, { t: 's', v: 'Bonos Hard dollar · precios y tasas al 12/11/2026' });
  assert.equal(ws.A2, undefined);
  assert.deepEqual(ws.A3, { t: 's', v: 'Ticker' });
  assert.deepEqual(ws.B4, { t: 'n', v: 0.0874, z: B.XL_PCT });
  assert.equal(ws['!ref'], 'A1:B4');
  assert.deepEqual(ws['!autofilter'], { ref: 'A3:B4' });
  assert.deepEqual(ws['!cols'].map(c => c.wch), [8, 9]);               // el título no ensancha la columna A
});
