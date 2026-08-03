/**
 * Motor de Censo Clínico Real y Auditoría Autenticada (PR 9)
 * Cumple con la Sección 8, 14 y PR9 del Plan Maestro.
 * 
 * Elimina completamente Math.random() y la generación de datos ficticios.
 * Consulta registros reales por namespace de año y autoría verificada.
 */

import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { featureFlags } from './config';
import { deidentifyText } from './deidentify';
import { TeacherAgentReviewSchema } from './contracts/review';
import { analyzeStudentLongitudinal } from './longitudinalAnalysis';

const CLINICAL_ACTIVITY_WINDOW_DAYS = 14;

function recordDate(record: any) {
  const value = record.sessionAt || record.fechaHoraAtencion || record.audit?.createdAt || record.createdAt;
  const time = new Date(typeof value?.toDate === 'function' ? value.toDate() : value || '').getTime();
  return Number.isFinite(time) ? time : null;
}

function hasValue(val: unknown): boolean {
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object' && val !== null) return Object.keys(val).length > 0;
  return Boolean(val);
}

function initialEvaluationGaps(record: any): string[] {
  const express = record?.expressDraft || {};
  const gaps: string[] = [];
  if (!hasValue(record?.interview || express.anamnesisProxima)) gaps.push('entrevista clínica');
  if (!hasValue(record?.guidedExam || express.evaluacionFisica)) gaps.push('evaluación física');
  if (!hasValue(record?.clinicalSynthesis || express.razonamientoIA || express.p4_plan?.diagnostico_narrativo)) gaps.push('integración clínica');
  if (!hasValue(record?.p4_plan_structured || express.p4_plan)) gaps.push('objetivos y plan');
  if (record?.status !== 'CLOSED') gaps.push('cierre formal');
  return gaps;
}

async function createInitialEvaluationContinuityReview(
  db: ReturnType<typeof getAdminDb>,
  year: string,
  student: any,
  patientId: string,
  processId: string,
  evolutions: any[],
  initialEvaluations: any[],
) {
  if (evolutions.length < 2) return { missing: 0, insufficient: 0 };
  const latestEvolution = [...evolutions].sort((a, b) => (recordDate(b) || 0) - (recordDate(a) || 0))[0];
  const sortedInitials = [...initialEvaluations].sort((a, b) => (recordDate(b) || 0) - (recordDate(a) || 0));
  // Un borrador nuevo no invalida una línea basal previa que sí está cerrada
  // y completa. Primero buscamos una evaluación utilizable del proceso.
  const usableInitial = sortedInitials.find((evaluation) => initialEvaluationGaps(evaluation).length === 0);
  if (usableInitial) return { missing: 0, insufficient: 0 };
  const latestInitial = sortedInitials[0];
  const gaps = latestInitial ? initialEvaluationGaps(latestInitial) : [];

  const isMissing = !latestInitial;
  const category = isMissing ? 'INITIAL_EVALUATION_MISSING' : 'INITIAL_EVALUATION_INSUFFICIENT';
  const reviewId = isMissing
    ? `initial_missing_${year}_${student.id}_${processId}`
    : `initial_insufficient_${year}_${student.id}_${processId}_${latestInitial.id}`;
  const observation = isMissing
    ? `El estudiante asignado registra ${evolutions.length} evoluciones cerradas en el proceso, pero no existe una evaluación inicial utilizable.`
    : `La línea basal disponible es insuficiente para seguimiento: falta ${gaps.join(', ')}. El estudiante asignado ya registra ${evolutions.length} evoluciones cerradas.`;
  const source = latestInitial || latestEvolution;
  const payload = TeacherAgentReviewSchema.parse({
    year,
    studentId: student.id,
    patientId,
    sourceReferences: [{
      year,
      collection: latestInitial ? 'evaluaciones' as const : 'evoluciones' as const,
      recordId: source.id,
      fieldPath: isMissing ? 'evaluacion_inicial_ausente' : gaps[0],
      contentHash: `${category.toLowerCase()}_${processId}_${source.id}`,
      redactedExcerpt: isMissing
        ? `Proceso con ${evolutions.length} evoluciones cerradas y sin evaluación inicial.`
        : `Línea basal incompleta: ${gaps.join(', ')}.`,
    }],
    observation,
    pedagogicalInference: isMissing
      ? 'La continuidad carece de una línea basal suficiente para contrastar objetivos, medidas y progresión. La autoría previa no debe atribuirse al estudiante actual.'
      : 'La evaluación existe, pero no permite vincular de forma confiable entrevista, examen, hipótesis y plan. Corresponde revisión docente antes de solicitar regularización.',
    confidence: 1,
    priority: 'P1' as const,
    status: 'PENDING_TEACHER' as const,
    createdAt: new Date().toISOString(),
    category,
  });
  try {
    await db.collection('teacher_agent_reviews').doc(reviewId).create(payload);
    return { missing: isMissing ? 1 : 0, insufficient: isMissing ? 0 : 1 };
  } catch (error: any) {
    if (error?.code === 6 || error?.code === 'already-exists') return { missing: 0, insufficient: 0 };
    throw error;
  }
}

/**
 * La frecuencia no sustituye el juicio clínico: es un recordatorio docente
 * cuando ya existe una línea basal y el mismo interno ha documentado cinco
 * sesiones posteriores con la misma persona. Nunca toca la ficha.
 */
async function reconcileReevaluationReminders(db: ReturnType<typeof getAdminDb>, year: string, student: any, records: any[]) {
  const evolutionsByPatient = new Map<string, any[]>();
  for (const record of records.filter((item) => item.collection === 'evoluciones')) {
    const patientId = record.usuariaId || record.personaUsuariaId;
    if (!patientId) continue;
    const current = evolutionsByPatient.get(patientId) || [];
    current.push(record);
    evolutionsByPatient.set(patientId, current);
  }

  let created = 0;
  for (const [patientId, evolutions] of evolutionsByPatient) {
    const evaluations = records
      .filter((item) => item.collection === 'evaluaciones' && (item.usuariaId || item.personaUsuariaId) === patientId)
      .sort((a, b) => (recordDate(a) || 0) - (recordDate(b) || 0));
    if (!evaluations.length) continue;

    const baseline = evaluations[evaluations.length - 1];
    const baselineDate = recordDate(baseline) || 0;
    const sessionsSinceBaseline = evolutions.filter((item) => (recordDate(item) || 0) > baselineDate);
    const reminderId = `reevaluation_due_${year}_${student.id}_${patientId}_${baseline.id}`;
    const reminderRef = db.collection('teacher_agent_reviews').doc(reminderId);

    // Una reevaluación nueva cierra recordatorios originados en líneas basales
    // anteriores para esta dupla estudiante-persona.
    // Solo filtramos por estudiante en Firestore para no exigir un índice
    // compuesto nuevo durante atención clínica; el resto se filtra en memoria.
    const previousReminders = await db.collection('teacher_agent_reviews')
      .where('studentId', '==', student.id)
      .limit(100)
      .get();
    await Promise.all(previousReminders.docs
      .filter((doc: any) => {
        const data = doc.data();
        return doc.id !== reminderId && data.patientId === patientId && data.category === 'REEVALUATION_DUE' && data.status === 'PENDING_TEACHER';
      })
      .map((doc: any) => doc.ref.update({ status: 'ACCEPTED_PRIVATE', reviewedAt: new Date().toISOString(), resolution: 'reevaluation_detected' })));

    if (sessionsSinceBaseline.length < 5) {
      // Si una reevaluación nueva cambió la línea basal, el recordatorio previo
      // deja de ser pertinente. Conservamos historial, pero no sigue molestando.
      continue;
    }

    const latestEvolution = sessionsSinceBaseline.sort((a, b) => (recordDate(b) || 0) - (recordDate(a) || 0))[0];
    const payload = TeacherAgentReviewSchema.parse({
      year,
      studentId: student.id,
      patientId,
      sourceReferences: [{
        year,
        collection: 'evoluciones' as const,
        recordId: latestEvolution.id,
        fieldPath: 'reevaluacion_pendiente',
        contentHash: `reevaluation_${baseline.id}`,
        redactedExcerpt: `Se registraron ${sessionsSinceBaseline.length} evoluciones desde la última evaluación/reevaluación del mismo estudiante.`,
      }],
      observation: `Reevaluación docente sugerida: ${sessionsSinceBaseline.length} evoluciones posteriores a la línea basal del mismo estudiante.`,
      pedagogicalInference: 'Antes de continuar el plan, corresponde contrastar signos comparables, objetivos y respuesta a la intervención. La decisión clínica final sigue siendo del estudiante supervisado y del docente.',
      confidence: 1,
      priority: 'P2' as const,
      status: 'PENDING_TEACHER' as const,
      createdAt: new Date().toISOString(),
      category: 'REEVALUATION_DUE',
      baselineEvaluationId: baseline.id,
      sessionsSinceBaseline: sessionsSinceBaseline.length,
    });
    try {
      await reminderRef.create(payload);
      created++;
    } catch (error: any) {
      if (error?.code !== 6 && error?.code !== 'already-exists') throw error;
    }
  }
  return created;
}

export async function runCensusEngine() {
  if (!featureFlags.agentWriteEnabled) {
    console.log('[PR9 Census Engine] Execution blocked: featureFlags.agentWriteEnabled is false.');
    return { status: 'blocked', reason: 'agentWriteEnabled is false', studentsProcessed: 0, recordsProcessed: 0, reviewsCreated: 0, priorityCounts: { P0: 0, P1: 0, P2: 0, P3: 0 } };
  }

  const db = getAdminDb();
  const year = new Date().getFullYear().toString();

  try {
    // 1. Obtener estudiantes activos con rol INTERNO
    const usersSnap = await db.collection('users').where('role', '==', 'INTERNO').get();
    if (usersSnap.empty) {
      console.log('[PR9 Census Engine] No active INTERNO students found.');
      return { status: 'completed', studentsProcessed: 0, recordsProcessed: 0, reviewsCreated: 0, priorityCounts: { P0: 0, P1: 0, P2: 0, P3: 0 } };
    }

    const students = usersSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    const [initialsSnap, processesSnap, patientsSnap] = await Promise.all([
      db.collection(`programs/${year}/evaluaciones`).where('type', '==', 'INITIAL').get(),
      db.collection(`programs/${year}/procesos`).get(),
      db.collection(`programs/${year}/usuarias`).get(),
    ]);
    const globalInitials = initialsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    const processes = processesSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    const patients = patientsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    let reviewsCreated = 0;
    let recordsProcessed = 0;
    let reevaluationRemindersCreated = 0;
    let initialEvaluationMissingCreated = 0;
    let initialEvaluationInsufficientCreated = 0;
    const priorityCounts: Record<'P0' | 'P1' | 'P2' | 'P3', number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
    const recentCutoff = Date.now() - CLINICAL_ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

    for (const student of students) {
      // 2. Consulta incremental de evaluaciones reales creadas por el estudiante
      const evalsSnap = await db
        .collection(`programs/${year}/evaluaciones`)
        .where('audit.createdBy', '==', student.id)
        .limit(20)
        .get();

      // 3. Consulta incremental de evoluciones reales creadas por el estudiante
      const evolsSnap = await db
        .collection(`programs/${year}/evoluciones`)
        .where('audit.createdBy', '==', student.id)
        .limit(20)
        .get();

      const allRecords = [
        ...evalsSnap.docs.map((d: any) => ({ id: d.id, collection: 'evaluaciones', ...d.data() })),
        ...evolsSnap.docs.map((d: any) => ({ id: d.id, collection: 'evoluciones', ...d.data() })),
      ].sort((a: any, b: any) => String(a.sessionAt || a.fechaHoraAtencion || a.audit?.createdAt || '')
        .localeCompare(String(b.sessionAt || b.fechaHoraAtencion || b.audit?.createdAt || '')));

      // No reabre fichas de meses anteriores por el solo hecho de correr hoy.
      // El historial permanece disponible para análisis longitudinal solicitado,
      // pero los hallazgos operativos se limitan a actividad clínica reciente.
      const recentRecords = allRecords.filter((record: any) => {
        const date = recordDate(record);
        return date !== null && date >= recentCutoff && date <= Date.now();
      });

      recordsProcessed += recentRecords.length;

      for (const record of recentRecords) {
        const missingFields: string[] = [];
        let priority: 'P0' | 'P1' | 'P2' | 'P3' = 'P3';

        if (record.collection === 'evaluaciones') {
          const reassessment = record.type === 'REEVALUATION' ? record.reevaluationExpress : null;
          if (reassessment) {
            const interviewComplete = hasValue(reassessment.interview?.change)
              && hasValue(reassessment.interview?.functionParticipation)
              && hasValue(reassessment.interview?.patientPriority);
            const examComplete = hasValue(reassessment.exam?.selectedDomains)
              && hasValue(reassessment.exam?.comparableResult || reassessment.exam?.objectiveFindings)
              && hasValue(reassessment.exam?.testInterpretation);
            const reasoningComplete = hasValue(reassessment.reasoning?.hypothesis)
              && hasValue(reassessment.reasoning?.direction)
              && hasValue(reassessment.reasoning?.decision)
              && hasValue(reassessment.reasoning?.plan)
              && hasValue(reassessment.reasoning?.nextReassessment);
            if (!interviewComplete) missingFields.push('Entrevista focal de reevaluación');
            if (!examComplete) missingFields.push('Retest o examen físico comparable interpretado');
            if (!reasoningComplete) missingFields.push('Integración clínica y ajuste del plan');
            if (reassessment.interview?.newRedFlags && !hasValue(reassessment.interview?.redFlagDetail)) {
              missingFields.push('Conducta frente a signos de alerta');
              priority = 'P0';
            } else if (missingFields.length > 0) {
              priority = 'P1';
            }
          } else {
            if (!hasValue(record.interview || record.expressDraft?.anamnesisProxima)) missingFields.push('Entrevista / Anamnesis');
            if (!hasValue(record.guidedExam || record.expressDraft?.evaluacionFisica)) missingFields.push('Examen Físico Guiado');
            if (!hasValue(record.p4_plan_structured || record.expressDraft?.p4_plan)) missingFields.push('Plan Terapéutico ESTRUCTURADO');
          }
          if (record.autoSynthesis?.trafficLight === 'Rojo') priority = 'P0';
          else if (missingFields.length > 0) priority = 'P1';
        } else {
          if (!hasValue(record.sessionGoal || record.objetivoSesion)) missingFields.push('Objetivo de Sesión');
          if (!hasValue(record.interventions)) missingFields.push('Intervenciones Registradas');
          if (!hasValue(record.nextPlan)) missingFields.push('Plan Próxima Sesión');
          if (record.pain?.contradictionReason) priority = 'P1';
          else if (missingFields.length > 0) priority = 'P2';
        }

        if (missingFields.length > 0 || priority === 'P0' || priority === 'P1') {
          const rawExcerpt = record.summary
            || record.sessionGoal
            || record.reevaluationExpress?.interview?.change
            || record.reevaluationExpress?.reasoning?.coherence
            || record.expressDraft?.razonamientoIA
            || 'Registro clínico sin síntesis explícita';
          const cleanExcerpt = deidentifyText(rawExcerpt);

          const reviewPayload = {
            year,
            studentId: student.id,
            patientId: record.usuariaId || undefined,
            sourceReferences: [
              {
                year,
                collection: record.collection as 'evaluaciones' | 'evoluciones',
                recordId: record.id,
                fieldPath: missingFields[0] || 'completitud',
                contentHash: `hash_${record.id}_${Date.now()}`,
                redactedExcerpt: cleanExcerpt.slice(0, 200),
              },
            ],
            observation: `Incompletitud o incoherencia detectada en ${record.collection}: falta ${missingFields.join(', ')}.`,
            pedagogicalInference: 'Se requiere revisión docente para verificar el razonamiento clínico del estudiante.',
            confidence: 0.9,
            priority,
            status: 'PENDING_TEACHER' as const,
            createdAt: new Date().toISOString(),
          };

          // Validar contrato estricto Zod antes de persistir
          const validatedReview = TeacherAgentReviewSchema.parse(reviewPayload);

          // ID determinista: ejecutar el censo dos veces no crea dos tareas para
          // el mismo registro. `create` conserva cualquier decisión docente ya
          // tomada y evita una lectura previa solo para deduplicar.
          const reviewId = `census_${year}_${student.id}_${record.collection}_${record.id}`;
          try {
            await db.collection('teacher_agent_reviews').doc(reviewId).create(validatedReview);
            reviewsCreated++;
            priorityCounts[priority]++;
          } catch (writeError: any) {
            if (writeError?.code !== 6 && writeError?.code !== 'already-exists') {
              throw writeError;
            }
          }
        }
      }

      // Recordatorio persistente de reevaluación: usa todo el historial del
      // estudiante con esa persona, pero solo se crea una vez por línea basal.
      const reevaluationReminders = await reconcileReevaluationReminders(db, year, student, allRecords);
      reviewsCreated += reevaluationReminders;
      reevaluationRemindersCreated += reevaluationReminders;
      priorityCounts.P2 += reevaluationReminders;

      // La línea basal pertenece a la persona/proceso, aunque la haya escrito
      // otro interno. El desempeño, en cambio, se cuenta solo por autoría.
      const closedEvolutionsByProcess = new Map<string, any[]>();
      for (const evolution of allRecords.filter((record: any) => record.collection === 'evoluciones' && record.status === 'CLOSED' && record.procesoId)) {
        const current = closedEvolutionsByProcess.get(evolution.procesoId) || [];
        current.push(evolution);
        closedEvolutionsByProcess.set(evolution.procesoId, current);
      }
      for (const [processId, evolutions] of closedEvolutionsByProcess) {
        const process = processes.find((item: any) => item.id === processId);
        if (!process || !['ACTIVO', 'EN_PAUSA', 'PAUSADO'].includes(process.estado)) continue;
        const patient = patients.find((item: any) => item.id === process.personaUsuariaId);
        const assignedInternId = patient?.meta?.assignedInternId || process.primaryInternId || process.attendancePlan?.primaryInternId;
        if (assignedInternId !== student.id) continue;
        const processInitials = globalInitials.filter((evaluation: any) => evaluation.procesoId === processId);
        const result = await createInitialEvaluationContinuityReview(
          db,
          year,
          student,
          process.personaUsuariaId,
          processId,
          evolutions,
          processInitials,
        );
        initialEvaluationMissingCreated += result.missing;
        initialEvaluationInsufficientCreated += result.insufficient;
        reviewsCreated += result.missing + result.insufficient;
        priorityCounts.P1 += result.missing + result.insufficient;
      }

      // Actualizar perfil longitudinal real del estudiante en student_learning_profiles
      await db.collection('student_learning_profiles').doc(student.id).set(
        {
          year,
          studentId: student.id,
          displayName: student.displayName || student.email || 'Estudiante INTERNO',
          studentCode: student.studentCode || `INT-${student.id.slice(0, 6).toUpperCase()}`,
          universityCode: student.university || 'UCH',
          auditedRecordsCount: allRecords.length,
          lastUpdatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // El análisis generativo es un segundo nivel explícitamente habilitado.
      // Nunca bloquea ni modifica la ficha: si falla, el censo estructural
      // anterior sigue siendo válido y queda registrado de forma privada.
      // Solo se activa cuando existe actividad reciente, pero conserva los
      // registros previos como contexto longitudinal del estudiante.
      if (featureFlags.agentLlmAnalysisEnabled && recentRecords.length > 0) {
        const analysis = await analyzeStudentLongitudinal(student.id, allRecords);
        if (analysis) {
          const sourceReferences = analysis.evidence.flatMap((evidence) => {
            const source = allRecords.find((record: any) =>
              record.id === evidence.recordId && record.collection === evidence.collection,
            );
            if (!source) return [];
            return [{
              year,
              collection: source.collection as 'evaluaciones' | 'evoluciones',
              recordId: source.id,
              fieldPath: evidence.section,
              contentHash: Buffer.from(`${source.id}:${evidence.section}`).toString('hex').slice(0, 32),
              redactedExcerpt: deidentifyText(evidence.excerpt).slice(0, 200),
            }];
          });

          if (sourceReferences.length > 0) {
            const reviewPayload = TeacherAgentReviewSchema.parse({
              year,
              studentId: student.id,
              patientId: undefined,
              sourceReferences,
              observation: analysis.observation,
              pedagogicalInference: `${analysis.pedagogicalInference}\n\nPregunta socrática: ${analysis.socraticQuestion}\nRecomendación: ${analysis.recommendation}`,
              confidence: analysis.confidence,
              priority: analysis.priority,
              status: 'PENDING_TEACHER',
              createdAt: new Date().toISOString(),
            });
            const evidenceVersion = Buffer.from(sourceReferences.map(reference => reference.recordId).sort().join('|'))
              .toString('hex')
              .slice(0, 20);
            try {
              await db.collection('teacher_agent_reviews')
                .doc(`longitudinal_${year}_${student.id}_${evidenceVersion}`)
              .create(reviewPayload);
            reviewsCreated++;
            priorityCounts[analysis.priority]++;
            } catch (writeError: any) {
              if (writeError?.code !== 6 && writeError?.code !== 'already-exists') throw writeError;
            }

            await db.collection('student_learning_profiles').doc(student.id).set({
              strengths: analysis.strengths,
              improvementGaps: analysis.improvementGaps,
              recurringErrorPatterns: analysis.recurringPattern
                ? [{
                    patternId: `llm_${evidenceVersion}`,
                    description: analysis.recurringPattern,
                    occurrences: sourceReferences.length,
                    lastSeenAt: new Date().toISOString(),
                  }]
                : [],
              lastUpdatedAt: new Date().toISOString(),
            }, { merge: true });
          }
        }
      }
    }

    console.log(
      `[PR9 Census Engine] Real audit finished. Processed ${recordsProcessed} records across ${students.length} students. Created ${reviewsCreated} reviews.`
    );

    return {
      status: 'completed',
      studentsProcessed: students.length,
      recordsProcessed,
      reviewsCreated,
      reevaluationRemindersCreated,
      initialEvaluationMissingCreated,
      initialEvaluationInsufficientCreated,
      priorityCounts,
    };
  } catch (error: any) {
    console.error('[PR9 Census Engine Error]:', error);
    throw error;
  }
}
