// Curva TIR vs duration: ajuste Nelson-Siegel, curvas por segmento y curva soberana.
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
// Curva Nelson-Siegel de referencia: sube rápido en el corto y se aplana (nivel 12%)
const verdad = () => ({ b: [12, -6, 2], lam: B.NS_LAMBDAS[12] });
const puntos = durs => durs.map(d => ({ dur: d, tir: B.valorNS(verdad(), d) }));
const DURS = [0.3, 0.6, 0.9, 1.2, 1.6, 2, 2.5, 3, 4, 5, 6, 7];

test('ajusteNS recupera una curva Nelson-Siegel conocida', () => {
  const f = B.ajusteNS(puntos(DURS));
  for (const d of [0.4, 1, 2.2, 5.5]) casi(B.valorNS(f, d), B.valorNS(verdad(), d), 1e-6);
  assert.equal(f.min, 0.3); assert.equal(f.max, 7); assert.equal(f.n, 12);
});

test('robusto: un bono que se aparta 6 puntos no mueve la curva', () => {
  const p = puntos(DURS); p[4] = { dur: 1.6, tir: p[4].tir - 6 };   // un AO27: muy por debajo
  const f = B.ajusteNS(p);
  for (const d of [0.6, 1.6, 3, 6]) casi(B.valorNS(f, d), B.valorNS(verdad(), d), 0.02);   // < 2 pb
});

test('con 2 a 5 bonos la curva es monótona (nivel y pendiente, sin joroba)', () => {
  const f = B.ajusteNS([{ dur: 1, tir: 8 }, { dur: 2, tir: 10 }, { dur: 4, tir: 9.5 }, { dur: 6, tir: 11 }]);
  assert.equal(f.b[2], 0);
  const c = B.muestrearNS(f).map(p => p.tir);
  assert.ok(c.every((v, i) => i === 0 || v >= c[i - 1] - 1e-9), 'sube en todo el tramo');
  assert.equal(B.ajusteNS([{ dur: 2, tir: 7 }]), null, 'con un bono no hay curva');
  assert.equal(B.ajusteNS([{ dur: 2, tir: 7 }, { dur: 2, tir: 8 }]), null, 'misma duration: no hay curva');
});

test('la joroba se usa solo si se gana el lugar', () => {
  assert.notEqual(B.ajusteNS(puntos(DURS)).b[2], 0, 'una curva con joroba la usa');
  // 8 ONs dispersas alrededor del 7%: la joroba solo perseguiría puntos
  const disperso = [[0.5, 5], [1, 9], [1.5, 4.5], [2, 9.5], [2.5, 5], [3, 9], [4, 4.5], [5, 9.5]].map(([dur, tir]) => ({ dur, tir }));
  const f = B.ajusteNS(disperso);
  assert.equal(f.b[2], 0);
  const c = B.muestrearNS(f).map(p => p.tir);
  assert.ok(Math.max(...c) - Math.min(...c) < 2, 'la curva no sale a buscar los extremos');
});

test('la curva se dibuja de la menor a la mayor duration, sin extrapolar', () => {
  const f = B.ajusteNS(puntos(DURS)), c = B.muestrearNS(f);
  assert.equal(c.length, 61);
  casi(c[0].dur, 0.3); casi(c.at(-1).dur, 7);
  const corto = B.tirEnCurva(f, 0.1), adentro = B.tirEnCurva(f, 2);
  casi(corto.tir, B.valorNS(f, 0.3)); assert.equal(corto.extrapolado, true);
  assert.equal(adentro.extrapolado, false);
  casi(B.tirEnCurva(f, 30).tir, B.valorNS(f, 7));
});

test('el spread de una ON se mide contra el soberano de su misma legislación', () => {
  const lista = [sob('GD30', 'Nueva York', 1, 8), sob('GD38', 'Nueva York', 4, 10),
                 sob('AL30', 'Argentina', 1, 9), sob('AE38', 'Argentina', 4, 12)];
  const curvas = B.curvasSoberanas(lista);
  assert.deepEqual(Object.keys(curvas).sort(), ['AR', 'NY']);
  // con dos bonos la curva pasa por los dos: el spread en esas durations es exacto
  assert.deepEqual(B.spreadSob(on('YMCXO', { leg: 'Nueva York', dur: 1, tir: 7.5 }), curvas), { k: 'NY', pb: -50, extrapolado: false });
  assert.deepEqual(B.spreadSob(on('PNXCO', { leg: 'Argentina', dur: 4, tir: 9.75 }), curvas), { k: 'AR', pb: -225, extrapolado: false });
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

test('hasta 5 curvas: la primera vez los 5 grupos más grandes; después cada grupo conserva su color', () => {
  const g = n => n.map((clave, i) => ({ clave, n: 10 - i }));
  const todos = ['AAA', 'AA', 'AA+', 'AA-', 'A+', 'A'];
  assert.equal(B.YC_COL.length, 5);
  assert.deepEqual(B.ycActivos(null, g(todos)), { AAA: 0, AA: 1, 'AA+': 2, 'AA-': 3, 'A+': 4 });
  // El usuario apaga AA y prende A: toma el color libre, los demás no cambian
  assert.deepEqual(B.ycActivos({ AAA: 0, 'AA+': 2, 'AA-': 3, 'A+': 4, A: 1 }, g(todos)),
                   { AAA: 0, 'AA+': 2, 'AA-': 3, 'A+': 4, A: 1 });
  // Un grupo que desaparece del universo suelta su color; apagar todos no los vuelve a prender
  assert.deepEqual(B.ycActivos({ AAA: 0, ZZZ: 1 }, g(['AAA'])), { AAA: 0 });
  assert.deepEqual(B.ycActivos({}, g(['AAA', 'AA'])), {});
});

test('cada grupo tiene su forma de punto', () => {
  const formas = [0, 1, 2, 3, 4].map(i => B.marcaSVG(i, 10, 10, 4, 'fill="red"', '<title>t</title>'));
  assert.equal(new Set(formas).size, 5);
  assert.match(formas[0], /^<circle .*<title>t<\/title><\/circle>$/);
  assert.match(formas[1], /^<rect /);
  formas.forEach(f => assert.match(f, /fill="red"/));
});
