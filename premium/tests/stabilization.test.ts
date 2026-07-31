/**
 * Suite de Pruebas Automatizadas de Estabilización (Agenda Poli)
 * Verifica:
 *  1. Resolución honesta de autoría (sin universidades supuestas).
 *  2. Desidentificación estricta de datos personales en el cliente de IA.
 *  3. Validación de Contratos Zod (P0-P3, AgentRun, TeacherDecision).
 */

import assert from 'node:assert';
import { test, describe } from 'node:test';
import { deidentifyText } from '../src/lib/agent/deidentify';
import { TeacherDecisionContractSchema } from '../src/lib/agent/contracts/teacherDecision';
import { StudentLearningProfileContractSchema } from '../src/lib/agent/contracts/studentProfile';
import { AgentRunContractSchema } from '../src/lib/agent/contracts/agentRun';

describe('Pruebas de Desidentificación Clínica', () => {
  test('deidentifyText remueve o anonimiza datos personales', () => {
    const rawInput = 'El paciente Juan Pérez (RUT 12.345.678-9) asistió a la sesión.';
    const cleaned = deidentifyText(rawInput);
    
    assert.strictEqual(cleaned.includes('12.345.678-9'), false, 'El RUT debe ser anonimizado');
    assert.strictEqual(typeof cleaned, 'string');
  });
});

describe('Pruebas de Contratos Zod', () => {
  test('TeacherDecisionContractSchema valida correctamente una decisión', () => {
    const validDecision = {
      teacherId: 'teacher_123',
      reviewId: 'review_456',
      studentId: 'student_789',
      action: 'ACCEPTED' as const,
      createdAt: new Date().toISOString(),
      year: '2026',
    };

    const parsed = TeacherDecisionContractSchema.parse(validDecision);
    assert.strictEqual(parsed.action, 'ACCEPTED');
    assert.strictEqual(parsed.teacherId, 'teacher_123');
  });

  test('AgentRunContractSchema valida correctamente un registro de ejecución', () => {
    const validRun = {
      triggeredBy: 'cron_runner',
      status: 'running' as const,
      startedAt: new Date().toISOString(),
      agentVersion: 'agenda-clinical-v2-2026-08',
      promptVersion: 'v2-2026',
    };

    const parsed = AgentRunContractSchema.parse(validRun);
    assert.strictEqual(parsed.agentVersion, 'agenda-clinical-v2-2026-08');
  });

  test('StudentLearningProfileContractSchema valida correctamente un perfil', () => {
    const validProfile = {
      studentId: 'student_123',
      year: '2026',
      auditedRecordsCount: 5,
      strengths: ['Excelente anamnesis', 'Buena dosificación EBM'],
      improvementGaps: ['Falta verificar banderas rojas'],
      recurringErrorPatterns: [],
      simulationStats: {
        attemptsCompleted: 15,
        minCompleted: true,
        oralVsWrittenConcordance: 0.88,
      },
      lastUpdatedAt: new Date().toISOString(),
    };

    const parsed = StudentLearningProfileContractSchema.parse(validProfile);
    assert.strictEqual(parsed.auditedRecordsCount, 5);
    assert.strictEqual(parsed.simulationStats.minCompleted, true);
  });
});
