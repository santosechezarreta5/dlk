// Base de la TNA elegible: según cupón (default), 180/360, 90/360 o plazo remanente.
//
// Correr:  node --test "tests/**/*.test.mjs"      (desde web/)
//
// La TIR no depende de la base; la TNA sí. Cada base tiene que ser la inversa exacta de sí
// misma (TNA → TIR → TNA), porque Tasa → Precio y la TNA manual de la ficha usan tnaToTIR.

import { test, before, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { cargar } from './extract.mjs';

let B;
before(async () => { B = await cargar(); });
afterEach(() => B.setModoTNA('cupon'));

const casi = (a, b, tol, msg) => assert.ok(Math.abs(a - b) < tol, `${msg}: ${a} vs ${b}`);

test('según cupón (default): igual que antes de agregar el selector', () => {
  casi(B.tirToTNA(8, 6, 182), 2 * (Math.sqrt(1.08) - 1) * 100, 1e-4, 'semestral');
  casi(B.tirToTNA(8, 3, 91), 4 * (Math.pow(1.08, .25) - 1) * 100, 1e-4, 'trimestral');
  casi(B.tirToTNA(8, 3, 91, 233), 4 * (Math.pow(1.08, .25) - 1) * 100, 1e-4, 'los días al vto no cambian nada');
  assert.equal(B.tnaBase(3, 91), '90/360');
});

test('180/360 y 90/360: misma base para todas las frecuencias', () => {
  B.setModoTNA('180');
  casi(B.tirToTNA(8, 3, 91), B.tirToTNA(8, 6, 182), 1e-9, 'trimestral y semestral iguales');
  casi(B.tirToTNA(8, 3, 91), 7.8461, 1e-3, 'valor 180/360');
  assert.equal(B.tnaBase(3, 91), '180/360');
  B.setModoTNA('90');
  casi(B.tirToTNA(8, 6, 182), 7.7706, 1e-3, 'semestral expresado en 90/360');
  assert.equal(B.tnaBase(6, 182), '90/360');
});

test('plazo remanente: tasa al plazo, anualizada lineal en 365', () => {
  B.setModoTNA('plazo');
  // DHSMO a la par limpia el 07/10/2026: TIR 7,180% a 233 días
  casi(B.tirToTNA(7.180, 3, 88, 233), (Math.pow(1.0718, 233 / 365) - 1) * 365 / 233 * 100, 1e-4, 'fórmula');
  casi(B.tirToTNA(7.180, 3, 88, 233), 7.089, 2e-3, 'DHSMO');
  // a un año exacto, la tasa al plazo coincide con la TIR efectiva
  casi(B.tirToTNA(8, 6, 182, 365), 8, 1e-4, '365 días');
  assert.equal(B.tnaBase(3, 91), 'plazo remanente');
  // sin días al vencimiento no se inventa un plazo: cae a la base del cupón
  casi(B.tirToTNA(8, 3, 91), 4 * (Math.pow(1.08, .25) - 1) * 100, 1e-4, 'sin diasVto');
});

test('cada base es su propia inversa (TNA → TIR → TNA)', () => {
  for (const m of ['cupon', '180', '90', 'plazo']) {
    B.setModoTNA(m);
    for (const [per, dp, dv] of [[3, 91, 233], [6, 182, 1500], [12, 365, 90], [0, 365, 400]]) {
      const tir = B.tnaToTIR(0.075, per, dp, dv);
      casi(B.tirToTNA(tir, per, dp, dv), 7.5, 1e-3, `modo ${m}, per ${per}`);
    }
  }
});
