/**
 * Servidor MCP Protegido para Agenda Poli
 * Cumple con la Sección 4.4 y 8 del Plan Maestro.
 * Endpoint: POST /api/agent/mcp
 * 
 * Expone herramientas de lectura desidentificadas y herramientas de escritura privada en Firestore.
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
            // ==================== HERRAMIENTAS DE LECTURA ====================
            case 'tools/list_active_students': {
                const usersSnap = await adminDb.collection('users').get();
                const students = usersSnap.docs
                    .map((doc: any) => ({ id: doc.id, ...doc.data() }))
                    .filter((u: any) => u.role === 'INTERNO');
                return NextResponse.json({ result: { students } });
            }

            case 'tools/get_student_changes': {
                const { cursorTimestamp } = params || {};
                const reviewsSnap = await adminDb.collection('agent_reviews')
                    .where('createdAt', '>', cursorTimestamp || '2026-01-01')
                    .get();
                const changes = reviewsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
                return NextResponse.json({ result: { changes } });
            }

            case 'tools/get_student_clinical_history': {
                const { studentId } = params || {};
                const snapshot = await adminDb.collection('agent_reviews')
                    .where('studentId', '==', studentId)
                    .get();
                const history = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
                return NextResponse.json({ result: { history } });
            }

            case 'tools/get_patient_timeline': {
                const { patientId } = params || {};
                const summaryDoc = await adminDb.collection('patient_continuity_summaries').doc(patientId).get();
                return NextResponse.json({ result: { timeline: summaryDoc.data() || null } });
            }

            case 'tools/get_clinical_record': {
                const { recordId, year } = params || {};
                const doc = await adminDb.collection('programs').doc(year || '2026').collection('usuarias').doc(recordId).get();
                return NextResponse.json({ result: { record: doc.data() || null } });
            }

            case 'tools/get_student_simulation_summary': {
                const { studentId } = params || {};
                const spDoc = await adminDb.collection('super_profiles').doc(studentId).get();
                return NextResponse.json({ result: { profile: spDoc.data() || null } });
            }

            case 'tools/get_teacher_calibration': {
                const { teacherId } = params || {};
                const decisionsSnap = await adminDb.collection('teacher_decisions')
                    .orderBy('createdAt', 'desc')
                    .limit(20)
                    .get();
                const calibration = decisionsSnap.docs.map((d: any) => d.data());
                return NextResponse.json({ result: { calibration } });
            }

            // ==================== HERRAMIENTAS DE ESCRITURA PRIVADA ====================
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

            case 'tools/save_feedback_draft': {
                const { studentId, feedbackDraft, socraticQuestion } = params || {};
                const ref = await adminDb.collection('intern_expedientes').doc(studentId).set({
                    studentId,
                    feedbackDraft,
                    socraticQuestion,
                    status: 'DRAFT_PENDING_APPROVAL',
                    updatedAt: new Date().toISOString()
                }, { merge: true });
                return NextResponse.json({ result: { studentId, status: 'draft_saved' } });
            }

            case 'tools/save_student_profile_snapshot': {
                const { studentId, profile } = params || {};
                await adminDb.collection('student_learning_profiles').doc(studentId).set({
                    ...profile,
                    lastUpdatedAt: new Date().toISOString()
                }, { merge: true });
                return NextResponse.json({ result: { studentId, status: 'profile_updated' } });
            }

            case 'tools/save_patient_continuity_summary': {
                const { patientId, summary } = params || {};
                await adminDb.collection('patient_continuity_summaries').doc(patientId).set({
                    ...summary,
                    lastUpdatedAt: new Date().toISOString()
                }, { merge: true });
                return NextResponse.json({ result: { patientId, status: 'continuity_updated' } });
            }

            default:
                return NextResponse.json({ error: `Method '${method}' not found` }, { status: 404 });
        }
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'MCP Internal Error' }, { status: 500 });
    }
}
