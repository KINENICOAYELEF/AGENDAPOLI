/**
 * Servidor MCP Protegido para Agenda Poli (PR 6)
 * Cumple con la Sección 4.4, 8 y 21 del Plan Maestro.
 * Endpoint: POST /api/agent/mcp
 * 
 * Herramientas de lectura (9) + Herramientas de escritura privada (7)
 * Falla cerrado si el token de autorización no coincide.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/server/firebaseAdmin';
import { deidentifyObject } from '@/lib/agent/deidentify';

const AGENT_MCP_SECRET = process.env.AGENT_MCP_SECRET;

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader ? authHeader.replace('Bearer ', '') : '';

    if (!AGENT_MCP_SECRET || token !== AGENT_MCP_SECRET) {
      return NextResponse.json({ error: 'Unauthorized MCP Access Token' }, { status: 401 });
    }

    const body = await req.json();
    const { method, params } = body;
    const year = params?.year || new Date().getFullYear().toString();

    switch (method) {
      // ==========================================
      // HERRAMIENTAS DE LECTURA (9)
      // ==========================================

      case 'tools/list_active_rotations': {
        const usersSnap = await adminDb.collection('users').where('role', '==', 'INTERNO').get();
        const students = usersSnap.docs.map((doc: any) => ({
          id: doc.id,
          studentCode: doc.data().studentCode || `INT-${doc.id.slice(0, 6).toUpperCase()}`,
          universityCode: doc.data().university || 'UCH',
        }));
        return NextResponse.json({ result: deidentifyObject({ students }) });
      }

      case 'tools/get_changed_clinical_records': {
        const { cursorTimestamp } = params || {};
        const evalsSnap = await adminDb
          .collection(`programs/${year}/evaluaciones`)
          .where('createdAt', '>', cursorTimestamp || '2026-01-01')
          .limit(50)
          .get();

        const records = evalsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        return NextResponse.json({ result: deidentifyObject({ records }) });
      }

      case 'tools/get_clinical_record': {
        const { recordId, recordType } = params || {};
        const collectionName = recordType === 'EVOLUCION' ? 'evoluciones' : 'evaluaciones';
        const doc = await adminDb.collection(`programs/${year}/${collectionName}`).doc(recordId).get();
        return NextResponse.json({
          result: deidentifyObject({ record: doc.exists ? { id: doc.id, ...doc.data() } : null }),
        });
      }

      case 'tools/get_patient_timeline': {
        const { patientId } = params || {};
        const summaryDoc = await adminDb.collection('patient_continuity_summaries').doc(patientId).get();
        return NextResponse.json({
          result: deidentifyObject({ timeline: summaryDoc.exists ? summaryDoc.data() : null }),
        });
      }

      case 'tools/get_student_authored_records': {
        const { studentId } = params || {};
        const evalsSnap = await adminDb
          .collection(`programs/${year}/evaluaciones`)
          .where('audit.createdBy', '==', studentId)
          .limit(50)
          .get();
        const evolsSnap = await adminDb
          .collection(`programs/${year}/evoluciones`)
          .where('audit.createdBy', '==', studentId)
          .limit(50)
          .get();

        const records = [
          ...evalsSnap.docs.map((d: any) => ({ id: d.id, kind: 'EVALUACION', ...d.data() })),
          ...evolsSnap.docs.map((d: any) => ({ id: d.id, kind: 'EVOLUCION', ...d.data() })),
        ];

        return NextResponse.json({ result: deidentifyObject({ records }) });
      }

      case 'tools/get_student_simulation_attempts': {
        const { studentId } = params || {};
        const simSnap = await adminDb
          .collection('simulador_intentos')
          .where('userId', '==', studentId)
          .orderBy('fechaInicio', 'desc')
          .limit(20)
          .get();
        const defSnap = await adminDb
          .collection('defensas_voz_intentos')
          .where('userId', '==', studentId)
          .orderBy('createdAt', 'desc')
          .limit(20)
          .get();

        const attempts = [
          ...simSnap.docs.map((d: any) => ({ id: d.id, type: 'OSCE_SIMULADOR', ...d.data() })),
          ...defSnap.docs.map((d: any) => ({ id: d.id, type: 'DEFENSA_VOZ', ...d.data() })),
        ];

        return NextResponse.json({ result: deidentifyObject({ attempts }) });
      }

      case 'tools/get_university_rubric': {
        const { universityCode } = params || {};
        const rubricDoc = await adminDb.collection('rubric_definitions').doc(universityCode || 'UCH').get();
        return NextResponse.json({
          result: { rubric: rubricDoc.exists ? rubricDoc.data() : null },
        });
      }

      case 'tools/get_teacher_calibration': {
        const { teacherId } = params || {};
        let query = adminDb.collection('teacher_decisions').orderBy('createdAt', 'desc').limit(20);
        if (teacherId) {
          query = adminDb
            .collection('teacher_decisions')
            .where('teacherId', '==', teacherId)
            .orderBy('createdAt', 'desc')
            .limit(20);
        }
        const decisionsSnap = await query.get();
        const calibration = decisionsSnap.docs.map((d: any) => d.data());
        return NextResponse.json({ result: { calibration } });
      }

      case 'tools/get_pending_teacher_reviews': {
        const pendingSnap = await adminDb
          .collection('teacher_agent_reviews')
          .where('status', '==', 'PENDING_TEACHER')
          .orderBy('createdAt', 'desc')
          .limit(50)
          .get();
        const pending = pendingSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        return NextResponse.json({ result: { pending, count: pending.length } });
      }

      // ==========================================
      // HERRAMIENTAS DE ESCRITURA PRIVADA (7)
      // ==========================================

      case 'tools/upsert_review_draft': {
        const { review } = params || {};
        if (!review || !review.studentId) {
          return NextResponse.json({ error: 'Missing review payload' }, { status: 400 });
        }
        const ref = await adminDb.collection('teacher_agent_reviews').add({
          ...review,
          status: 'PENDING_TEACHER',
          createdAt: new Date().toISOString(),
        });
        return NextResponse.json({ result: { reviewId: ref.id, status: 'saved' } });
      }

      case 'tools/upsert_student_profile_snapshot': {
        const { studentId, profile } = params || {};
        await adminDb.collection('student_learning_profiles').doc(studentId).set(
          {
            ...profile,
            lastUpdatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        return NextResponse.json({ result: { studentId, status: 'profile_updated' } });
      }

      case 'tools/upsert_patient_continuity_summary': {
        const { patientId, summary } = params || {};
        await adminDb.collection('patient_continuity_summaries').doc(patientId).set(
          {
            ...summary,
            lastUpdatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        return NextResponse.json({ result: { patientId, status: 'continuity_updated' } });
      }

      case 'tools/save_run_checkpoint': {
        const { run } = params || {};
        const ref = await adminDb.collection('agent_runs').add({
          ...run,
          finishedAt: new Date().toISOString(),
        });
        return NextResponse.json({ result: { runId: ref.id, status: 'run_checkpoint_saved' } });
      }

      case 'tools/queue_teacher_notification': {
        const { notification } = params || {};
        const ref = await adminDb.collection('teacher_notifications').add({
          ...notification,
          createdAt: new Date().toISOString(),
        });
        return NextResponse.json({ result: { notificationId: ref.id, status: 'queued' } });
      }

      case 'tools/create_student_message_draft': {
        const { studentId, messageBody } = params || {};
        const ref = await adminDb.collection('student_message_drafts').add({
          studentId,
          messageBody,
          status: 'DRAFT_PENDING_APPROVAL',
          createdAt: new Date().toISOString(),
        });
        return NextResponse.json({ result: { draftId: ref.id, status: 'draft_created' } });
      }

      case 'tools/propose_simulation_assignment': {
        const { studentId, simulationType, reason } = params || {};
        const ref = await adminDb.collection('proposed_simulations').add({
          studentId,
          simulationType,
          reason,
          status: 'PROPOSED_PENDING_APPROVAL',
          createdAt: new Date().toISOString(),
        });
        return NextResponse.json({ result: { proposalId: ref.id, status: 'proposed' } });
      }

      default:
        return NextResponse.json({ error: `MCP Method '${method}' not found` }, { status: 404 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'MCP Internal Error' }, { status: 500 });
  }
}
