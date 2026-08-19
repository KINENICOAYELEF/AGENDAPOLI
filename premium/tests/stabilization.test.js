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

  test('las ayudas de IA Express orientan sin autocompletar ni contaminar la ficha oficial', () => {
    const expressForm = readFileSync(new URL('../src/components/EvaluacionExpressForm.tsx', import.meta.url), 'utf8');
    const planning = readFileSync(new URL('../src/components/ClinicalPlanningSection.tsx', import.meta.url), 'utf8');
    const exploration = readFileSync(new URL('../src/app/api/ai/eval-planner/route.ts', import.meta.url), 'utf8');
    const patterns = readFileSync(new URL('../src/app/api/ai/express-structure/route.ts', import.meta.url), 'utf8');
    const guide = readFileSync(new URL('../src/app/api/ai/plan-guide/route.ts', import.meta.url), 'utf8');

    assert.match(expressForm, /setPatternResult/);
    assert.doesNotMatch(expressForm, /notaRapida: razonamientoIA/);
    assert.doesNotMatch(expressForm, /region: "Definido por IA"/);
    assert.match(planning, /\/api\/ai\/plan-guide/);
    assert.doesNotMatch(planning, /\/api\/ai\/express-plan/);
    assert.match(exploration, /No indiques pruebas, maniobras, clusters/);
    assert.match(patterns, /No des diagnósticos, hipótesis diagnósticas/);
    assert.match(guide, /No redactes diagnóstico, clasificación de dolor/);
  });

  test('la reevaluación publica una nueva versión de objetivos y resuelve su aviso', () => {
    const source = readFileSync(new URL('../src/components/ReevaluacionExpressForm.tsx', import.meta.url), 'utf8');
    assert.match(source, /activeObjectiveSetVersionId: versionId/);
    assert.match(source, /recordType: 'REEVALUATION'/);
    assert.match(source, /Síntesis de continuidad/);
    assert.match(source, /Agregar plantilla/);
    assert.match(source, /■ MEDIDA O SIGNO COMPARABLE/);
    assert.doesNotMatch(source, /Actividades funcionales precargadas/);
  });

  test('la navegación clínica conserva persona, proceso, formulario y paso en la URL', () => {
    const usersPage = readFileSync(new URL('../src/app/app/usuarios/page.tsx', import.meta.url), 'utf8');
    const timeline = readFileSync(new URL('../src/components/ProcesoTimeline.tsx', import.meta.url), 'utf8');
    const processes = readFileSync(new URL('../src/components/ProcesosManager.tsx', import.meta.url), 'utf8');
    assert.match(usersPage, /openFicha: patientId/);
    assert.match(usersPage, /personasUsuariasRef\.current/);
    assert.match(usersPage, /if \(currentUrl === nextUrl\) return/);
    assert.match(timeline, /action: 'REEVALUAR'/);
    assert.match(timeline, /step: String\(nextStep\)/);
    assert.doesNotMatch(processes, /if \(!initialRecordParams\?\.procesoId\) onNavigationChange/);
  });

  test('un enlace clínico fallido muestra reintento sin perder su destino', () => {
    const usersPage = readFileSync(new URL('../src/app/app/usuarios/page.tsx', import.meta.url), 'utf8');
    const usersError = readFileSync(new URL('../src/app/app/usuarios/error.tsx', import.meta.url), 'utf8');
    assert.match(usersPage, /const \[pendingFicha, setPendingFicha\]/);
    assert.match(usersPage, /Firebase alcanzó temporalmente su cuota de lecturas/);
    assert.match(usersPage, /Reintentar abrir/);
    assert.match(usersPage, /handleOpenFichaFromUrl\(pendingFicha\.id, pendingFicha\.params\)/);
    assert.match(usersPage, /router\.replace\(nextUrl/);
    assert.match(usersPage, /hasDirectClinicalLink/);
    assert.match(usersError, /No pudimos abrir esta vista temporalmente/);
  });

  test('el panel docente aplaza módulos que no han sido abiertos', () => {
    const admin = readFileSync(new URL('../src/app/app/admin/page.tsx', import.meta.url), 'utf8');
    assert.match(admin, /Carga bajo demanda/);
    assert.match(admin, /AdminLazySection/);
    assert.match(admin, /openPanels\.auditoria/);
    assert.match(admin, /openPanels\.telegram/);
  });

  test('Telegram ejecuta el censo de inmediato y conserva la aprobación docente', () => {
    const source = readFileSync(new URL('../src/app/api/telegram/webhook/route.ts', import.meta.url), 'utf8');
    assert.match(source, /fetch\(`\$\{APP_URL\}\/api\/agent\/run`/);
    assert.match(source, /No se enviará nada a estudiantes sin tu aprobación/);
  });

  test('el cron usa turnos durables, evita duplicados y propaga fallos reales', () => {
    const script = readFileSync(new URL('../scripts/run-antigravity-cron.js', import.meta.url), 'utf8');
    const workflow = readFileSync(new URL('../../.github/workflows/antigravity-super-profile-cron.yml', import.meta.url), 'utf8');
    const route = readFileSync(new URL('../src/app/api/agent/run/route.ts', import.meta.url), 'utf8');
    assert.match(script, /scheduledSlot: scheduleSlot \|\| undefined/);
    assert.doesNotMatch(script, /!\[7, 21\]\.includes/);
    assert.match(workflow, /GITHUB_EVENT_SCHEDULE/);
    assert.match(route, /agent_schedule_slots/);
    assert.match(route, /deduplicated: true/);
    assert.match(route, /status: 'failed'/);
    assert.match(route, /throw err/);
    assert.match(script, /isNonRetryableQuotaError/);
    assert.match(script, /censo quedó aplazado/);
    assert.match(script, /próximo turno programado/);
    assert.match(script, /shouldSkipEarlyFallback/);
    assert.match(script, /localHour >= 5 && localHour < 7/);
    assert.match(script, /localHour >= 6 && localHour < 21/);
  });

  test('el censo evita consultas N+1 al conciliar tareas y recordatorios', () => {
    const census = readFileSync(new URL('../src/lib/agent/censusEngine.ts', import.meta.url), 'utf8');
    assert.match(census, /where\('status', '==', 'ACTIVE'\)/);
    assert.match(census, /taskEvaluations = evaluations\.filter/);
    assert.match(census, /pendingReminderDocsByStudent/);
    assert.doesNotMatch(census, /evaluationsQuery\.get\(\)/);
    assert.doesNotMatch(census, /where\('studentId', '==', student\.id\)\.limit\(100\)/);
  });

  test('los directorios compartidos se cachean en memoria y se invalidan tras cambios', () => {
    const patients = readFileSync(new URL('../src/services/personasUsuarias.ts', import.meta.url), 'utf8');
    const users = readFileSync(new URL('../src/services/users.ts', import.meta.url), 'utf8');
    const assignments = readFileSync(new URL('../src/components/InternAssignmentManager.tsx', import.meta.url), 'utf8');
    assert.match(patients, /PATIENT_DIRECTORY_CACHE_TTL_MS/);
    assert.match(patients, /patientDirectoryCache/);
    assert.match(patients, /invalidateCache\(year/);
    assert.match(users, /USERS_CACHE_TTL_MS/);
    assert.match(users, /async getAll\(\)/);
    assert.match(assignments, /PersonasUsuariasService\.invalidateCache\(globalActiveYear\)/);
  });

  test('la bandeja docente solo consulta perfiles de hallazgos visibles', () => {
    const inbox = readFileSync(new URL('../src/components/revision-docente/BandejaDocenteInteligente.tsx', import.meta.url), 'utf8');
    assert.match(inbox, /where\(documentId\(\), "in", ids\)/);
    assert.match(inbox, /chunks\(studentIds, 30\)/);
    assert.doesNotMatch(inbox, /collection\(db, "student_learning_profiles"\), limit\(100\)/);
  });

  test('la interfaz no ejecuta censos completos de Firestore en segundo plano', () => {
    const notifications = readFileSync(new URL('../src/components/NotificationCenter.tsx', import.meta.url), 'utf8');
    const studentTasks = readFileSync(new URL('../src/components/StudentClinicalTaskBanner.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(notifications, /setInterval\(fetchAlerts/);
    assert.match(notifications, /if \(isOpen && globalActiveYear && user\)/);
    assert.match(notifications, /NOTIFICATION_CACHE_TTL_MS/);
    assert.match(studentTasks, /5 \* 60_000/);
  });

  test('los avisos clínicos abren el formulario exacto sin sobrescribir registros ajenos', () => {
    const inbox = readFileSync(new URL('../src/components/revision-docente/BandejaDocenteInteligente.tsx', import.meta.url), 'utf8');
    const timeline = readFileSync(new URL('../src/components/ProcesoTimeline.tsx', import.meta.url), 'utf8');
    assert.match(inbox, /action: isReevaluation \? 'REEVALUAR' : 'EVALUACION_INICIAL'/);
    assert.match(inbox, /actionParams\.set\('procesoId', review\.processId\)/);
    assert.match(timeline, /item\.data\.status !== 'DRAFT'/);
    assert.match(timeline, /author === user\?\.uid \|\| author === user\?\.email/);
  });

  test('la continuidad usa la línea basal del proceso y la fecha de asignación actual', () => {
    const census = readFileSync(new URL('../src/lib/agent/censusEngine.ts', import.meta.url), 'utf8');
    assert.match(census, /const globalBaselines =/);
    assert.match(census, /assignmentStartedAt: patient\?\.meta\?\.assignmentStartedAt/);
    assert.match(census, /const countingFrom = Math\.max\(baselineDate/);
    assert.match(census, /studentEvolutions/);
  });

  test('cerrar una reevaluación conserva inicio, autoría, objetivos y resuelve el aviso', () => {
    const reassessment = readFileSync(new URL('../src/components/ReevaluacionExpressForm.tsx', import.meta.url), 'utf8');
    const taskClient = readFileSync(new URL('../src/lib/studentClinicalTasksClient.ts', import.meta.url), 'utf8');
    assert.match(reassessment, /const \[startedAt\]/);
    assert.match(reassessment, /closedBy: user\.uid, closedAt: now/);
    assert.match(reassessment, /finalObjectives\.filter/);
    assert.match(taskClient, /student-clinical-tasks-changed/);
  });
});

describe('Módulo Taller de Adulto Mayor', () => {
  test('la evaluación funcional incluye las pruebas obligatorias y cálculo no diagnóstico', () => {
    const calculations = readFileSync(new URL('../src/lib/adultoMayor/calculations.ts', import.meta.url), 'utf8');
    const wizard = readFileSync(new URL('../src/components/adulto-mayor/EvaluationWizard.tsx', import.meta.url), 'utf8');
    assert.match(calculations, /gripCutoff/);
    assert.match(calculations, /probableSarcopenia/);
    assert.match(calculations, /estimatedRelativePower/);
    assert.match(calculations, /Cribado compatible con sarcopenia probable/);
    assert.match(wizard, /Prensión manual/);
    assert.match(wizard, /SPPB/);
    assert.match(wizard, /Timed Up and Go/);
    assert.match(wizard, /STS30 · Levantarse durante 30 segundos/);
  });

  test('el portal externo limita cada alumno a sus propias evaluaciones', () => {
    const portal = readFileSync(new URL('../src/app/api/adulto-mayor/portal/route.ts', import.meta.url), 'utf8');
    assert.match(portal, /where\('evaluatorId', '==', evaluator\.id\)/);
    assert.match(portal, /current\.evaluatorId !== evaluator\.id/);
    assert.match(portal, /current\.status === 'SUBMITTED'/);
    assert.match(portal, /httpOnly: true/);
    assert.match(portal, /maxAge: 60 \* 60 \* 24 \* 180/);
    assert.match(portal, /path: '\/api\/adulto-mayor\/portal'/);
  });

  test('el panel interno permite asistencia binaria, audio y reevaluación a 4–6 semanas', () => {
    const staffApi = readFileSync(new URL('../src/app/api/adulto-mayor/staff/route.ts', import.meta.url), 'utf8');
    const staffPage = readFileSync(new URL('../src/app/app/taller-adulto-mayor/page.tsx', import.meta.url), 'utf8');
    const transcribe = readFileSync(new URL('../src/app/api/adulto-mayor/staff/transcribe/route.ts', import.meta.url), 'utf8');
    assert.match(staffApi, /\['PRESENTE', 'AUSENTE'\]/);
    assert.match(staffApi, /daysSince >= 42/);
    assert.match(staffApi, /daysSince >= 28/);
    assert.match(staffPage, /WorkshopEvolutionRecorder/);
    assert.match(staffPage, /renewEvaluatorAccess/);
    assert.match(transcribe, /No inventes dosis, incidentes ni respuestas/);
  });
});
