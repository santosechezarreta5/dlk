// Curva TIR vs duration: curvas por segmento y curva soberana.
//
// Correr:  node --test "tests/**/*.test.mjs"      (desde web/)

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { cargar } from './extract.mjs';

let B;
before(async () => { B = await cargar(); });

const casi = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} ≠ ${b}`);
const on = (tk, o) => ({ ticker: tk, emisor: 'X', venc: '2030-01-01', ...o });
const sob = (tk, leg, dur, tir) => on(tk, { soberano: true, leg, dur, tir });

test('ajusteLog recupera una curva TIR = a + b·ln(dur) exacta', () => {
  const pts = [0.5, 1, 2, 4, 8].map(d => ({ dur: d, tir: 6 + 1.5 * Math.log(d) }));
  const f = B.ajusteLog(pts);
  casi(f.a, 6); casi(f.b, 1.5);
  assert.equal(f.min, 0.5); assert.equal(f.max, 8);
  assert.equal(B.ajusteLog([{ dur: 2, tir: 7 }]), null, 'con un punto no hay curva');
  assert.equal(B.ajusteLog([{ dur: 2, tir: 7 }, { dur: 2, tir: 8 }]), null, 'misma duration: no hay pendiente');
});

test('fuera del tramo con bonos la curva no se extrapola: toma el extremo y lo marca', () => {
  const f = B.ajusteLog([{ dur: 1, tir: 8 }, { dur: 5, tir: 11 }]);
  const corto = B.tirEnCurva(f, 0.2), adentro = B.tirEnCurva(f, 2);
  casi(corto.tir, 8); assert.equal(corto.extrapolado, true);
  assert.equal(adentro.extrapolado, false);
  casi(B.tirEnCurva(f, 30).tir, 11);
});

test('el spread de una ON se mide contra el soberano de su misma legislación', () => {
  const lista = [sob('GD30', 'Nueva York', 1, 8), sob('GD38', 'Nueva York', 4, 10),
                 sob('AL30', 'Argentina', 1, 9), sob('AE38', 'Argentina', 4, 12)];
  const curvas = B.curvasSoberanas(lista);
  assert.deepEqual(Object.keys(curvas).sort(), ['AR', 'NY']);
  const ny = B.spreadSob(on('YMCXO', { leg: 'Nueva York', dur: 1, tir: 7.5 }), curvas);
  assert.deepEqual(ny, { k: 'NY', pb: -50, extrapolado: false });
  const ar = B.spreadSob(on('PNXCO', { leg: 'Argentina', dur: 4, tir: 9.75 }), curvas);
  assert.deepEqual(ar, { k: 'AR', pb: -225, extrapolado: false });
  assert.equal(B.spreadSob(on('X', { leg: 'Nueva York', dur: 1, tir: 7 }), {}), null, 'sin curva no hay spread');
});

test('curvasSoberanas ignora las ONs y los puntos sin TIR o con TIR absurda', () => {
  const c = B.curvasSoberanas([sob('GD30', 'Nueva York', 1, 8), sob('GD35', 'Nueva York', 5, 11),
    sob('GD41', 'Nueva York', 6, 900), sob('GD46', 'Nueva York', null, 9), on('YMCXO', { leg: 'Nueva York', dur: 3, tir: 2 })]);
  assert.equal(c.NY.f.n, 2);
  assert.equal(c.AR, undefined);
});

test('grupos combinando dimensiones, de más a menos bonos', () => {
  const u = [on('A', { leg: 'Nueva York', rating: 'AAA(arg)' }), on('B', { leg: 'Argentina', rating: 'AAA(arg)' }),
             on('C', { leg: 'Argentina', rating: 'AAA(arg)' }), on('D', { leg: 'Argentina', rating: '' })];
  assert.deepEqual(B.ycGrupos(u, ['leg']), [{ clave: 'Argentina', n: 3 }, { clave: 'Nueva York', n: 1 }]);
  assert.deepEqual(B.ycGrupos(u, ['leg', 'rating']).map(g => g.clave),
    ['Argentina · AAA(arg)', 'Argentina · Sin calificación', 'Nueva York · AAA(arg)']);
});

test('colores: la primera vez los 3 grupos más grandes; después cada grupo conserva el suyo', () => {
  const g = n => n.map((clave, i) => ({ clave, n: 10 - i }));
  const a = B.ycActivos(null, g(['AAA', 'AA', 'AA+', 'A+']));
  assert.deepEqual(a, { AAA: 0, AA: 1, 'AA+': 2 });
  assert.ok(B.YC_COL.length === 3, 'la paleta validada tiene 3 colores');
  // El usuario apaga AA y prende A+: toma el color libre, los demás no cambian
  const b = B.ycActivos({ AAA: 0, 'AA+': 2, 'A+': 1 }, g(['AAA', 'AA', 'AA+', 'A+']));
  assert.deepEqual(b, { AAA: 0, 'AA+': 2, 'A+': 1 });
  // Un grupo que desaparece del universo suelta su color; apagar todos no los vuelve a prender
  assert.deepEqual(B.ycActivos({ AAA: 0, ZZZ: 1 }, g(['AAA'])), { AAA: 0 });
  assert.deepEqual(B.ycActivos({}, g(['AAA', 'AA'])), {});
});

test('curva de un grupo: sin curva con menos de 3 bonos, logarítmica de 3 a 9, LOESS con 10 o más', () => {
  const pts = n => Array.from({ length: n }, (_, i) => ({ dur: 0.5 + i, tir: 5 + Math.log(0.5 + i) }));
  assert.deepEqual(B.curvaPuntos(pts(2), true), []);
  const log = B.curvaPuntos(pts(4), true);
  assert.equal(log.length, 41);
  casi(log[0].dur, 0.5); casi(log.at(-1).dur, 3.5);
  casi(log[20].tir, 5 + Math.log(log[20].dur), 1e-9);    // los puntos están sobre la curva exacta
  assert.equal(B.curvaPuntos(pts(9), true).length, 41, 'con 9 bonos todavía es el ajuste logarítmico');
  const loess = B.curvaPuntos(pts(12), true);
  assert.ok(loess.length > 41 && loess.every(p => isFinite(p.tir)));
  // La curva única con pocos puntos sigue uniendo los puntos, como antes
  assert.deepEqual(B.curvaPuntos(pts(3), false).map(p => p.dur), [0.5, 1.5, 2.5]);
});
