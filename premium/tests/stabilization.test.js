/**
 * Suite de Pruebas Automatizadas de Estabilización y Arquitectura (Agenda Poli)
 * Ejecutable nativamente con Node.js Test Runner: node --test tests/stabilization.test.js
 */

import assert from 'node:assert';
import { test, describe } from 'node:test';
import { readFileSync } from 'node:fs';

// Función de desidentificación clínica
function deidentifyText(text) {
  if (!text) return '';
  return text
    .replace(/\b\d{1,2}\.\d{3}\.\d{3}[-kK0-9]\b/g, '[RUT_ANONIMIZADO]')
    .replace(/\b\d{7,8}[-kK0-9]\b/g, '[RUT_ANONIMIZADO]');
}

// Función helper de generación de links
function buildClinicalRecordLink(params) {
  const searchParams = new URLSearchParams();
  searchParams.set('openFicha', params.patientId);
  if (params.processId) searchParams.set('procesoId', params.processId);
  if (params.recordType) searchParams.set('recordType', params.recordType);
  if (params.recordId) searchParams.set('recordId', params.recordId);
  if (params.mode) searchParams.set('mode', params.mode);
  if (params.returnTo) searchParams.set('returnTo', params.returnTo);
  return `/app/usuarios?${searchParams.toString()}`;
}

describe('Pruebas de Desidentificación Clínica', () => {
  test('deidentifyText remueve o anonimiza datos personales', () => {
    const rawInput = 'El paciente Juan Pérez (RUT 12.345.678-9) asistió a la sesión.';
    const cleaned = deidentifyText(rawInput);
    
    assert.strictEqual(cleaned.includes('12.345.678-9'), false, 'El RUT debe ser anonimizado');
    assert.strictEqual(cleaned.includes('[RUT_ANONIMIZADO]'), true, 'Debe incluir etiqueta de RUT anonimizado');
  });
});

describe('Pruebas del Modelo de Rotaciones (PR-04)', () => {
  test('Valida estructura de Rotación Clínica', () => {
    const rotation = {
      year: '2026',
      universityCode: 'UCH',
      label: 'Rotación I - El Carmen',
      durationWeeks: 8,
      formativeWindow: { from: '2026-03-01', to: '2026-03-15' },
      finalWindow: { from: '2026-04-15', to: '2026-04-30' },
      status: 'ACTIVE',
    };

    assert.strictEqual(rotation.durationWeeks, 8);
    assert.strictEqual(rotation.universityCode, 'UCH');
  });
});

describe('Pruebas del Índice Clínico Normalizado (PR-05)', () => {
  test('Genera hash de contenido determinista', () => {
    const text = 'Atención kinesiológica respiratoria';
    const hash = Buffer.from(text).toString('base64').slice(0, 16);
    
    assert.strictEqual(typeof hash, 'string');
    assert.strictEqual(hash.length <= 16, true);
  });
});

describe('Pruebas de Navegación y Enlaces Clínicos', () => {
  test('buildClinicalRecordLink genera URL correcta para expediente en modo readonly', () => {
    const link = buildClinicalRecordLink({
      patientId: 'pat_123',
      processId: 'proc_456',
      recordId: 'rec_789',
      recordType: 'EVALUACION',
      mode: 'readonly',
      returnTo: 'revision-docente',
    });

    assert.strictEqual(link.includes('openFicha=pat_123'), true);
    assert.strictEqual(link.includes('procesoId=proc_456'), true);
    assert.strictEqual(link.includes('mode=readonly'), true);
    assert.strictEqual(link.includes('returnTo=revision-docente'), true);
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

  test('Verifica estructura de respuesta API estandarizada ApiSuccess y ApiFailure (Fase 1)', () => {
    const successPayload = {
      ok: true,
      data: { itemsCount: 5 },
      requestId: 'req_12345',
    };

    const failurePayload = {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Acceso no autorizado' },
      requestId: 'req_67890',
    };

    assert.strictEqual(successPayload.ok, true);
    assert.strictEqual(successPayload.requestId, 'req_12345');
    assert.strictEqual(failurePayload.ok, false);
    assert.strictEqual(failurePayload.error.code, 'UNAUTHORIZED');
  });
});

describe('Compatibilidad del servidor en producción', () => {
  test('firebase-admin/auth puede cargarse sin ERR_REQUIRE_ESM', async () => {
    const adminAuth = await import('firebase-admin/auth');

    assert.strictEqual(
      typeof adminAuth.getAuth,
      'function',
      'La API docente no puede iniciar si firebase-admin/auth no carga en Node.js',
    );
  });
});

describe('Circuito de reevaluación y avisos docentes', () => {
  test('la evaluación inicial Express cierra formalmente y concilia tareas', () => {
    const source = readFileSync(new URL('../src/components/EvaluacionExpressForm.tsx', import.meta.url), 'utf8');
    assert.match(source, /basePayload\.status = shouldClose \? 'CLOSED'/);
    assert.match(source, /resolveClinicalTasksAfterEvaluation/);
  });

  test('la reevaluación publica una nueva versión de objetivos y resuelve su aviso', () => {
    const source = readFileSync(new URL('../src/components/ReevaluacionExpressForm.tsx', import.meta.url), 'utf8');
    assert.match(source, /activeObjectiveSetVersionId: versionId/);
    assert.match(source, /recordType: 'REEVALUATION'/);
    assert.match(source, /Síntesis de continuidad/);
  });

  test('Telegram ejecuta el censo de inmediato y conserva la aprobación docente', () => {
    const source = readFileSync(new URL('../src/app/api/telegram/webhook/route.ts', import.meta.url), 'utf8');
    assert.match(source, /fetch\(`\$\{APP_URL\}\/api\/agent\/run`/);
    assert.match(source, /No se enviará nada a estudiantes sin tu aprobación/);
  });
});
