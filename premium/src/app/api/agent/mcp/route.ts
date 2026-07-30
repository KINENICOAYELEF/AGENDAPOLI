/**
 * Servidor MCP Protegido para Agenda Poli
 * Cumple con la Sección 4.4 y 8 del Plan Maestro.
 * Endpoint: POST /api/agent/mcp
 *
 * 11 herramientas de lectura + 8 herramientas de escritura privada = 19 total.
 * NUNCA permite modificar fichas clínicas, poner notas ni enviar mensajes automáticos.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/server/firebaseAdmin';

// Token estático de autorización de alta entropía para llamadas del agente
const AGENT_MCP_SECRET = process.env.AGENT_MCP_SECRET || 'agenda-poli-mcp-secure-token-2026';

export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('authorization');
        const token = authHeader ? authHeader.replace('Bearer ', '') : '';

        if (token !== AGENT_MCP_SECRET && process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: 'Unauthorized MCP Access Token' }, { status: 401 });
        }

        const body = await req.json();
        const { method, params } = body;

        switch (method) {
            // ==========================================
            // HERRAMIENTAS DE LECTURA (11)
            // ==========================================

            // 1. Listar estudiantes activos (rol INTERNO)
            case 'tools/list_active_students': {
                const usersSnap = await adminDb.collection('users').get();
                const students = usersSnap.docs
                    .map((doc: any) => ({ id: doc.id, ...doc.data() }))
                    .filter((u: any) => u.role === 'INTERNO');
                return NextResponse.json({ result: { students } });
            }

            // 2. Obtener cambios recientes (cursor-based)
            case 'tools/get_student_changes': {
                const { cursorTimestamp } = params || {};
                const reviewsSnap = await adminDb.collection('agent_reviews')
                    .where('createdAt', '>', cursorTimestamp || '2026-01-01')
                    .get();
                const changes = reviewsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
                return NextResponse.json({ result: { changes } });
            }

            // 3. Historial clínico de un estudiante
            case 'tools/get_student_clinical_history': {
                const { studentId } = params || {};
                const snapshot = await adminDb.collection('agent_reviews')
                    .where('studentId', '==', studentId)
                    .get();
                const history = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
                return NextResponse.json({ result: { history } });
            }

            // 4. Timeline de un paciente
            case 'tools/get_patient_timeline': {
                const { patientId } = params || {};
                const summaryDoc = await adminDb.collection('patient_continuity_summaries').doc(patientId).get();
                return NextResponse.json({ result: { timeline: summaryDoc.data() || null } });
            }

            // 5. Registro clínico individual
            case 'tools/get_clinical_record': {
                const { recordId, year } = params || {};
                const doc = await adminDb.collection('programs').doc(year || '2026').collection('usuarias').doc(recordId).get();
                return NextResponse.json({ result: { record: doc.data() || null } });
            }

            // 6. Resumen de simulaciones de un estudiante
            case 'tools/get_student_simulation_summary': {
                const { studentId } = params || {};
                const spDoc = await adminDb.collection('super_profiles').doc(studentId).get();
                return NextResponse.json({ result: { profile: spDoc.data() || null } });
            }

            // 7. Calibración del docente (historial de decisiones)
            case 'tools/get_teacher_calibration': {
                const { teacherId } = params || {};
                let query = adminDb.collection('teacher_decisions')
                    .orderBy('createdAt', 'desc')
                    .limit(20);
                if (teacherId) {
                    query = adminDb.collection('teacher_decisions')
                        .where('teacherId', '==', teacherId)
                        .orderBy('createdAt', 'desc')
                        .limit(20);
                }
                const decisionsSnap = await query.get();
                const calibration = decisionsSnap.docs.map((d: any) => d.data());
                return NextResponse.json({ result: { calibration } });
            }

            // 8. Historial de asignaciones de un paciente a diferentes estudiantes
            case 'tools/get_patient_assignment_history': {
                const { patientId, year } = params || {};
                // Busca en la colección de asignaciones del programa
                const assignSnap = await adminDb.collection('programs')
                    .doc(year || '2026')
                    .collection('assignments')
                    .where('patientId', '==', patientId)
                    .get();
                const assignments = assignSnap.docs.map((d: any) => ({
                    id: d.id,
                    ...d.data(),
                }));
                return NextResponse.json({ result: { assignments } });
            }

            // 9. Detalle de un intento de simulación
            case 'tools/get_simulation_attempt': {
                const { attemptId, studentId } = params || {};
                if (attemptId) {
                    const doc = await adminDb.collection('simulation_attempts').doc(attemptId).get();
                    return NextResponse.json({ result: { attempt: doc.exists ? { id: doc.id, ...doc.data() } : null } });
                }
                // Fallback: todas las simulaciones de un estudiante
                const snap = await adminDb.collection('simulation_attempts')
                    .where('studentId', '==', studentId)
                    .orderBy('date', 'desc')
                    .limit(10)
                    .get();
                const attempts = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
                return NextResponse.json({ result: { attempts } });
            }

            // 10. Rúbrica universitaria específica del estudiante
            case 'tools/get_student_university_rubric': {
                const { studentId } = params || {};
                // Busca el perfil del estudiante para obtener su universidad
                const profileDoc = await adminDb.collection('student_learning_profiles').doc(studentId).get();
                const rubricDoc = await adminDb.collection('rubric_evaluations').doc(studentId).get();
                return NextResponse.json({
                    result: {
                        profile: profileDoc.data() || null,
                        rubricEvaluation: rubricDoc.data() || null,
                    }
                });
            }

            // 11. Revisiones pendientes de aprobación docente
            case 'tools/get_pending_reviews': {
                const { limit: resultLimit } = params || {};
                const pendingSnap = await adminDb.collection('agent_reviews')
                    .where('status', '==', 'PENDIENTE')
                    .orderBy('createdAt', 'desc')
                    .limit(resultLimit || 50)
                    .get();
                const pending = pendingSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
                return NextResponse.json({ result: { pending, total: pending.length } });
            }

            // ==========================================
            // HERRAMIENTAS DE ESCRITURA PRIVADA (8)
            // ==========================================

            // W1. Guardar hallazgo de revisión
            case 'tools/save_review_finding': {
                const { review } = params || {};
                if (!review || !review.studentId) {
                    return NextResponse.json({ error: 'Missing review payload' }, { status: 400 });
                }
                const ref = await adminDb.collection('agent_reviews').add({
                    ...review,
                    status: 'PENDIENTE',
                    createdAt: new Date().toISOString()
                });
                return NextResponse.json({ result: { reviewId: ref.id, status: 'saved' } });
            }

            // W2. Guardar borrador de feedback
            case 'tools/save_feedback_draft': {
                const { studentId, feedbackDraft, socraticQuestion } = params || {};
                await adminDb.collection('intern_expedientes').doc(studentId).set({
                    studentId,
                    feedbackDraft,
                    socraticQuestion,
                    status: 'DRAFT_PENDING_APPROVAL',
                    updatedAt: new Date().toISOString()
                }, { merge: true });
                return NextResponse.json({ result: { studentId, status: 'draft_saved' } });
            }

            // W3. Guardar snapshot de perfil estudiantil
            case 'tools/save_student_profile_snapshot': {
                const { studentId, profile } = params || {};
                await adminDb.collection('student_learning_profiles').doc(studentId).set({
                    ...profile,
                    lastUpdatedAt: new Date().toISOString()
                }, { merge: true });
                return NextResponse.json({ result: { studentId, status: 'profile_updated' } });
            }

            // W4. Guardar resumen de continuidad del paciente
            case 'tools/save_patient_continuity_summary': {
                const { patientId, summary } = params || {};
                await adminDb.collection('patient_continuity_summaries').doc(patientId).set({
                    ...summary,
                    lastUpdatedAt: new Date().toISOString()
                }, { merge: true });
                return NextResponse.json({ result: { patientId, status: 'continuity_updated' } });
            }

            // W5. Guardar resumen de ejecución del agente
            case 'tools/save_run_summary': {
                const { run } = params || {};
                if (!run) {
                    return NextResponse.json({ error: 'Missing run payload' }, { status: 400 });
                }
                const runRef = await adminDb.collection('agent_runs').add({
                    ...run,
                    finishedAt: new Date().toISOString(),
                });
                return NextResponse.json({ result: { runId: runRef.id, status: 'run_saved' } });
            }

            // W6. Encolar notificación para el docente
            case 'tools/queue_teacher_notification': {
                const { notification } = params || {};
                if (!notification || !notification.title) {
                    return NextResponse.json({ error: 'Missing notification payload' }, { status: 400 });
                }
                const notifRef = await adminDb.collection('teacher_notifications').add({
                    ...notification,
                    status: 'queued',
                    createdAt: new Date().toISOString(),
                });
                return NextResponse.json({ result: { notificationId: notifRef.id, status: 'queued' } });
            }

            // W7. Crear borrador de mensaje al estudiante (NUNCA se envía sin aprobación docente)
            case 'tools/create_student_message_draft': {
                const { studentId, messageBody, context } = params || {};
                if (!studentId || !messageBody) {
                    return NextResponse.json({ error: 'Missing studentId or messageBody' }, { status: 400 });
                }
                const draftRef = await adminDb.collection('student_message_drafts').add({
                    studentId,
                    messageBody,
                    context: context || '',
                    status: 'DRAFT_PENDING_TEACHER_APPROVAL',
                    createdAt: new Date().toISOString(),
                });
                return NextResponse.json({ result: { draftId: draftRef.id, status: 'draft_created' } });
            }

            // W8. Guardar evaluación de rúbrica
            case 'tools/save_rubric_evaluation': {
                const { studentId, evaluation } = params || {};
                if (!studentId || !evaluation) {
                    return NextResponse.json({ error: 'Missing studentId or evaluation' }, { status: 400 });
                }
                await adminDb.collection('rubric_evaluations').doc(studentId).set({
                    ...evaluation,
                    studentId,
                    evaluatedAt: new Date().toISOString(),
                }, { merge: true });
                return NextResponse.json({ result: { studentId, status: 'rubric_saved' } });
            }

            default:
                return NextResponse.json({ error: `Method '${method}' not found` }, { status: 404 });
        }
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'MCP Internal Error' }, { status: 500 });
    }
}
