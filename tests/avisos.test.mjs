// Documentos de las licitaciones del MAE y lo que los avisos aportan a un borrador.
//
// Correr:  node --test "tests/**/*.test.mjs"      (desde web/)

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { cargar } from './extract.mjs';

let B;
before(async () => { B = await cargar(); });

test('docTipoMae clasifica los documentos por el nombre (igual que avisos.tipo_doc)', () => {
  assert.equal(B.docTipoMae('MPA3-ANU-ON EF PLAZA LOGISTICA CLASE 4-Aviso de Suscripcion 27-02-26.pdf'), 'suscripcion');
  assert.equal(B.docTipoMae('MPA3-RES-ON EF PLAZA LOGISTICA CLASE 4- Aviso de Rdos 02-03-26.pdf'), 'resultados');
  assert.equal(B.docTipoMae('MPA3-ADE-ON YPF - Aviso de Resultados Complementario 19-02-26.pdf'), 'resultados_compl');
  assert.equal(B.docTipoMae('MPA3-ADE-ON EF PLAZA LOGISTICA CLASE 4-Aviso Complementario 27-02-26.pdf'), 'complementario');
  assert.equal(B.docTipoMae('MP A3-ANU-ON EF YPF Suplemento de Prospecto 06-02-26.pdf'), 'suplemento');
  assert.equal(B.docTipoMae('2026-03-02 RESUMEN ON PLAZA LOGISTICA CLASE 4.pdf'), 'resumen');
  assert.equal(B.docTipoMae('MPA3-ANU-Comunicado Llamado.pdf'), 'otro');
});

test('docsMaeOrdenados: resultados primero, sin enlaces vacíos', () => {
  const docs = [{ tipo: 'prospecto', url: 'p' }, { tipo: 'suscripcion', url: 's' }, { tipo: 'resultados', url: 'r' }, { tipo: 'otro' }];
  assert.deepEqual(B.docsMaeOrdenados(docs).map(d => d.url), ['r', 's', 'p']);
  assert.deepEqual(B.docsMaeOrdenados(null), []);
});

test('valorAvisoTxt muestra lo leído de los avisos', () => {
  assert.equal(B.valorAvisoTxt('periodicidad', { valor: 3 }), '3 meses');
  assert.equal(B.valorAvisoTxt('periodicidad', { valor: 1 }), '1 mes');
  assert.equal(B.valorAvisoTxt('fecha_inicio_int', { valor: '2027-04-22' }), '22/04/2027');
  assert.equal(B.valorAvisoTxt('fecha_inicio_int', { valor: '2027-04-22', calculado: true }), '22/04/2027 (calculada)');
  assert.equal(B.valorAvisoTxt('base_dias', { valor: '180_360' }), '30/360');
  assert.equal(B.valorAvisoTxt('callable', { valor: 'Si', sched: [{ desde: '2028-05-03', precio: 101 }] }), 'sí: desde 03/05/2028 a 101%');
  assert.equal(B.valorAvisoTxt('callable', { valor: 'Si' }), 'sí (sin fechas ni precios)');
  assert.equal(B.valorAvisoTxt('amort', { valor: 'cuotas', sched: [{ pct: 50, fecha: '2028-10-22' }] }), 'cuotas: 50% 22/10/2028');
});
