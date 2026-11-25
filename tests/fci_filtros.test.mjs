// Filtros de ON en Movimientos de FCI: vencimiento mes-año (árbol tipo Excel) y orden de ratings.
//
// Correr:  node --test "tests/**/*.test.mjs"      (desde web/)

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { cargar } from './extract.mjs';

let B;
before(async () => { B = await cargar(); });

const VALS = ['2028-06', '2027-01', '2027-06', '2027-06', '2029-11', 'basura', ''];

test('mesesPorAnio agrupa por año, sin repetidos y en orden', () => {
  assert.deepEqual(B.mesesPorAnio(VALS), [
    { anio: '2027', meses: ['2027-01', '2027-06'] },
    { anio: '2028', meses: ['2028-06'] },
    { anio: '2029', meses: ['2029-11'] },
  ]);
  assert.deepEqual(B.mesesPorAnio(null), []);
});

test('estadoAnio: todo, parte o nada', () => {
  const m = ['2027-01', '2027-06'];
  assert.equal(B.estadoAnio(m, new Set(['2027-01', '2027-06', '2028-06'])), 'todo');
  assert.equal(B.estadoAnio(m, new Set(['2027-06'])), 'parte');
  assert.equal(B.estadoAnio(m, new Set(['2028-06'])), 'nada');
});

test('resumenMeses: años completos como año, meses sueltos como mes-año', () => {
  assert.equal(B.resumenMeses(['2027-01', '2027-06'], VALS), '2027');
  assert.equal(B.resumenMeses(['2027-06', '2028-06', '2029-11'], VALS), 'jun-27, 2028, 2029');
  assert.equal(B.resumenMeses([], VALS), '');
  assert.equal(B.resumenMeses(['2031-03'], VALS), '');     // lo que ya no es opción no cuenta
});

test('ordenRatings: de mejor a peor, lo desconocido y "Sin rating" al final', () => {
  assert.deepEqual(B.ordenRatings(['A(arg)', 'Sin rating', 'AAA(arg)', 'BBB-(arg)', 'AA-(arg)', 'raro']),
    ['AAA(arg)', 'AA-(arg)', 'A(arg)', 'BBB-(arg)', 'raro', 'Sin rating']);
});
