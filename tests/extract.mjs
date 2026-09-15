// Extrae del index.html las funciones de cálculo y las devuelve como un módulo.
//
// La calculadora es un único index.html de ~500 KB sin build ni imports, así que no hay
// forma de importar sus funciones directamente. En vez de duplicarlas acá —que sería
// testear una copia y no el código real— se recortan del archivo contando llaves y se
// importan como un módulo en memoria (data: URL, sin archivos temporales).
//
// Si alguien renombra o borra una de estas funciones, la extracción falla con un error
// claro en vez de dejar los tests pasando sobre nada.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const INDEX = join(AQUI, '..', 'index.html');

/** Recorta `function nombre(...){...}` contando llaves hasta balancear. */
function func(src, nombre) {
  const m = new RegExp('^function ' + nombre + '\\s*\\(', 'm').exec(src);
  if (!m) throw new Error(`extract: no encontré la función ${nombre}() en index.html`);
  let i = src.indexOf('{', m.index);
  if (i < 0) throw new Error(`extract: ${nombre}() sin cuerpo`);
  for (let j = i, prof = 0; j < src.length; j++) {
    if (src[j] === '{') prof++;
    else if (src[j] === '}' && --prof === 0) return src.slice(m.index, j + 1);
  }
  throw new Error(`extract: llaves sin balancear en ${nombre}()`);
}

/** Primera línea que empieza con `prefijo` (para one-liners y constantes). */
function linea(src, prefijo) {
  const l = src.split('\n').find(x => x.startsWith(prefijo));
  if (!l) throw new Error(`extract: no encontré la línea que empieza con ${JSON.stringify(prefijo)}`);
  return l;
}

const EXPORTA = [
  'buildSchedule', 'activeCallScenarios', 'buildCallCF', 'applySettlement',
  'calcTIR', 'tirToTNA', 'adjustDate', 'yearFrac', 'callYield', '_rankYTC',
];

export async function cargar() {
  const src = readFileSync(INDEX, 'utf8');
  const partes = [
    'const PERF = null;',
    'let _CF_EPOCH = 0;',
    linea(src, 'let HOLIDAYS='),
    func(src, 'dkey'),
    'const HOLIDAY_SET = new Set(HOLIDAYS.map(dkey));',
    func(src, 'isHoliday'),
    linea(src, 'function adjustDate(dt){'),
    func(src, 'yearFrac'),
    func(src, 'buildSchedule'),
    func(src, 'activeCallScenarios'),
    func(src, 'buildCallCF'),
    func(src, 'applySettlement'),
    func(src, 'calcTIR'),
    func(src, 'tirToTNA'),
    linea(src, 'const YTC_DIAS_CORTO ='),
    func(src, 'callYield'),
    func(src, '_rankYTC'),
    `export { ${EXPORTA.join(', ')}, YTC_DIAS_CORTO };`,
  ];
  const mod = partes.join('\n\n');
  const abre = (mod.match(/{/g) || []).length, cierra = (mod.match(/}/g) || []).length;
  if (abre !== cierra) throw new Error(`extract: llaves desbalanceadas (${abre} vs ${cierra})`);
  return import('data:text/javascript;base64,' + Buffer.from(mod, 'utf8').toString('base64'));
}
