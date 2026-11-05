// Calendario de licitaciones del MAE: fechas en hora argentina, títulos cortos, grilla del mes.
//
// Correr:  node --test "tests/**/*.test.mjs"      (desde web/)

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { cargar } from './extract.mjs';

let B;
before(async () => { B = await cargar(); });

test('licFechaAR pasa el instante UTC del MAE a la fecha y hora argentinas', () => {
  assert.deepEqual(B.licFechaAR('2026-10-15T13:00:00Z'), { dia: '2026-10-15', hora: '10:00' });
  assert.deepEqual(B.licFechaAR('2026-10-15T13:00:00+00:00'), { dia: '2026-10-15', hora: '10:00' });   // como lo devuelve Supabase
  // 02:00 UTC todavía es el día anterior en Argentina
  assert.deepEqual(B.licFechaAR('2026-11-06T02:00:00Z'), { dia: '2026-11-05', hora: '23:00' });
  // Los eventos del cronograma vienen a las 03:00 UTC = medianoche: sin hora
  assert.deepEqual(B.licFechaAR('2026-11-11T03:00:00Z'), { dia: '2026-11-11', hora: null });
  assert.deepEqual(B.licFechaAR(null), { dia: null, hora: null });
});

test('licHorario: apertura a cierre, vacío en los de día completo', () => {
  assert.equal(B.licHorario({ inicio: '2026-10-15T13:00:00Z', fin: '2026-10-15T19:15:00Z' }), '10:00 a 16:15');
  assert.equal(B.licHorario({ inicio: '2026-11-11T03:00:00Z', fin: '2026-11-11T03:00:00Z' }), '');
  assert.equal(B.licHorario({ inicio: '2026-10-15T13:00:00Z', fin: null }), '10:00');
});

test('licEstado: lo guardado manda, si no la fecha', () => {
  const hoy = '2026-11-05';
  assert.equal(B.licEstado({ estado: 'cancelada', inicio: '2026-12-01T13:00:00Z' }, hoy), 'cancelada');
  assert.equal(B.licEstado({ estado: 'finalizada', inicio: '2026-10-15T13:00:00Z' }, hoy), 'finalizada');
  assert.equal(B.licEstado({ estado: 'programada', inicio: '2026-11-12T13:00:00Z' }, hoy), 'programada');
  assert.equal(B.licEstado({ estado: 'activa', inicio: '2026-11-05T13:00:00Z' }, hoy), 'hoy');
  // Activa ayer (la corrida la vio abierta) y ya pasó
  assert.equal(B.licEstado({ estado: 'activa', detalle: true, inicio: '2026-11-04T13:00:00Z' }, hoy), 'finalizada');
  // Solo calendario, de hace meses
  assert.equal(B.licEstado({ estado: null, detalle: false, inicio: '2026-03-10T13:00:00Z' }, hoy), 'realizada');
});

test('licCorto saca el texto que repiten todas', () => {
  const casos = {
    'ON PLAZA LOGISTICA CLASE 6': 'Plaza Logistica Cl. 6',
    'ON YPF SOCIEDAD ANÓNIMA CLASE XLIII ADICIONALES': 'YPF Cl. XLIII Adicionales',
    'ON BAJO IMPACTO ENDANIK SERIE I': 'Endanik S. I',
    'ON PYME CNV MEDIANO IMPACTO SION SERIE VI': 'Sion S. VI',
    'LETRAS DEL TESORO DE LA PROVINCIA DEL CHUBUT SERIE CXXIV': 'Letras Chubut S. CXXIV',
    'LETRAS DE TESORERIA DE LA PROVINCIA DEL CHACO CLASE 12 (REAPERTURA)': 'Letras Chaco Cl. 12 (reapertura)',
    'FF CUOTAS CENCOSUD SERIE LXII': 'Cuotas Cencosud S. LXII',
    'ON TOYOTA COMPAÑÍA FINANCIERA DE ARGENTINA CLASE 40': 'Toyota CF de Argentina Cl. 40',
    'LICITACION DEL MINISTERIO DE ECONOMÍA DE ACUERDO AL CRONOGRAMA DE LICITACIONES PARA EL AÑO 2026': 'Licitación del Tesoro (cronograma)',
    'BONO DEL TESORO NACIONAL EN PESOS A TASA TAMAR CON VTO. 31/08/2028 (TMG28)': 'Bono TMG28',
    'CONVERSIÓN LETRA DEL TESORO NACIONAL VINCULADA AL DÓLAR (D30N6)': 'Canje Letra D30N6',
  };
  for (const [t, esperado] of Object.entries(casos)) assert.equal(B.licCorto(t), esperado, t);
});

test('licCorto: la provincia de Buenos Aires queda como PBA', () => {
  assert.equal(B.licCorto('LETRAS DEL TESORO DE LA PROVINCIA DE BUENOS AIRES EN PESOS A DTO.'), 'Letras PBA en Pesos a Dto.');
  assert.equal(B.licCorto('TÍTULOS DE DEUDA PÚBLICA DE LA PROVINCIA DE BUENOS AIRES A TASA VARIABLE'), 'Títulos PBA a Tasa Variable');
});

test('licSuave pasa a minúsculas el texto del MAE sin tocar siglas ni números', () => {
  assert.equal(B.licSuave('TASA DE CORTE: 7.00%'), 'Tasa de corte: 7.00%');
  assert.equal(B.licSuave('3.36 AÑOS'), '3.36 años');
  assert.equal(B.licSuave('VDF: TIR DE CORTE: 22.42% / CP'), 'VDF: TIR de corte: 22.42% / CP');
  assert.equal(B.licSuave('DESIERTA'), 'Desierta');
  assert.equal(B.licSuave(null), null);
});

test('licSemanas: lunes a viernes, sin semanas que no tocan el mes', () => {
  // Noviembre 2026 empieza domingo: la semana del lunes 26/10 no entra (sin fin de semana)
  const nov = B.licSemanas(2026, 11, false);
  assert.equal(nov[0][0].dia, '2026-11-02');
  assert.equal(nov.at(-1).at(-1).dia, '2026-12-04');
  assert.ok(nov.every(s => s.length === 5));
  assert.equal(nov.flat().filter(c => c.enMes).length, 21);            // días hábiles de la semana en el mes
  // Con fin de semana sí entra, porque el domingo 1/11 es del mes
  const nov7 = B.licSemanas(2026, 11, true);
  assert.equal(nov7[0][0].dia, '2026-10-26');
  assert.equal(nov7[0][6].dia, '2026-11-01');
  assert.ok(nov7[0][6].enMes);
});

test('licMonto y licPlazo', () => {
  assert.equal(B.licMonto(30000000, 'USD'), 'US$ 30 M');
  assert.equal(B.licMonto(10000000000, 'ARS PESOS'), '$ 10.000 M');
  assert.equal(B.licMonto(4757870, 'USD'), 'US$ 4,8 M');
  assert.equal(B.licMonto(1, 'USD LINK'), null);                       // el MAE pone 1 cuando no hay monto
  assert.equal(B.licMonto(null, 'USD'), null);
  assert.equal(B.licPlazo('2026-10-19', '2030-10-19'), '4 años');
  assert.equal(B.licPlazo('2026-10-16', '2026-11-13'), '28 días');
  assert.equal(B.licPlazo(null, '2030-10-19'), null);
});
