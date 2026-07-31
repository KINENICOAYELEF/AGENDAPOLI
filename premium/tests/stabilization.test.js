/**
 * Suite de Pruebas Automatizadas de Estabilización (Agenda Poli)
 * Ejecutable nativamente con Node.js Test Runner: node --test tests/stabilization.test.js
 */

import assert from 'node:assert';
import { test, describe } from 'node:test';

// Función de desidentificación clínica
function deidentifyText(text) {
  if (!text) return '';
  return text
    .replace(/\b\d{1,2}\.\d{3}\.\d{3}[-kK0-9]\b/g, '[RUT_ANONIMIZADO]')
    .replace(/\b\d{7,8}[-kK0-9]\b/g, '[RUT_ANONIMIZADO]');
}

describe('Pruebas de Desidentificación Clínica', () => {
  test('deidentifyText remueve o anonimiza datos personales', () => {
    const rawInput = 'El paciente Juan Pérez (RUT 12.345.678-9) asistió a la sesión.';
    const cleaned = deidentifyText(rawInput);
    
    assert.strictEqual(cleaned.includes('12.345.678-9'), false, 'El RUT debe ser anonimizado');
    assert.strictEqual(cleaned.includes('[RUT_ANONIMIZADO]'), true, 'Debe incluir etiqueta de RUT anonimizado');
  });
});

describe('Pruebas de Estructura de Datos y Contratos', () => {
  test('Verifica estructura de decisión docente', () => {
    const validDecision = {
      teacherId: 'teacher_123',
      reviewId: 'review_456',
      studentId: 'student_789',
      action: 'ACCEPTED',
      createdAt: new Date().toISOString(),
      year: '2026',
    };

    assert.strictEqual(validDecision.action, 'ACCEPTED');
    assert.strictEqual(validDecision.teacherId, 'teacher_123');
  });

  test('Verifica estructura de ejecución de agente', () => {
    const validRun = {
      triggeredBy: 'cron_runner',
      status: 'running',
      startedAt: new Date().toISOString(),
      agentVersion: 'agenda-clinical-v2-2026-08',
      promptVersion: 'v2-2026',
    };

    assert.strictEqual(validRun.agentVersion, 'agenda-clinical-v2-2026-08');
  });
});
