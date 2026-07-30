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

function hasValue(val: unknown): boolean {
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object' && val !== null) return Object.keys(val).length > 0;
  return Boolean(val);
}

export async function runCensusEngine() {
  if (!featureFlags.agentWriteEnabled) {
    console.log('[PR9 Census Engine] Execution blocked: featureFlags.agentWriteEnabled is false.');
    return { status: 'blocked', reason: 'agentWriteEnabled is false' };
  }

  const db = getAdminDb();
  const year = new Date().getFullYear().toString();

  try {
    // 1. Obtener estudiantes activos con rol INTERNO
    const usersSnap = await db.collection('users').where('role', '==', 'INTERNO').get();
    if (usersSnap.empty) {
      console.log('[PR9 Census Engine] No active INTERNO students found.');
      return { status: 'completed', studentsProcessed: 0, reviewsCreated: 0 };
    }

    const students = usersSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    let reviewsCreated = 0;
    let recordsProcessed = 0;

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
      ];

      recordsProcessed += allRecords.length;

      for (const record of allRecords) {
        const missingFields: string[] = [];
        let priority: 'P0' | 'P1' | 'P2' | 'P3' = 'P3';

        if (record.collection === 'evaluaciones') {
          if (!hasValue(record.interview)) missingFields.push('Entrevista / Anamnesis');
          if (!hasValue(record.guidedExam)) missingFields.push('Examen Físico Guiado');
          if (!hasValue(record.p4_plan_structured)) missingFields.push('Plan Terapéutico ESTRUCTURADO');
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
          const rawExcerpt = record.summary || record.sessionGoal || 'Registro clínico sin síntesis explícita';
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

          await db.collection('teacher_agent_reviews').add(validatedReview);
          reviewsCreated++;
        }
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
    }

    console.log(
      `[PR9 Census Engine] Real audit finished. Processed ${recordsProcessed} records across ${students.length} students. Created ${reviewsCreated} reviews.`
    );

    return {
      status: 'completed',
      studentsProcessed: students.length,
      recordsProcessed,
      reviewsCreated,
    };
  } catch (error: any) {
    console.error('[PR9 Census Engine Error]:', error);
    throw error;
  }
}
