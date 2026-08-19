import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import {
  AM_COLLECTIONS,
  createSecureToken,
  ensurePortalConfig,
  hashToken,
  publicBaseUrl,
  requireWorkshopStaff,
  rotatePortalConfig,
} from '@/lib/server/adultoMayor';
import {
  calculateAge, calculateOlderAdultResults, createEmptyEvaluationData, evaluationCompleteness, normalizeName, normalizeRut,
} from '@/lib/adultoMayor/calculations';
import { sanitizeOlderAdultEvaluation } from '@/lib/adultoMayor/sanitizeEvaluation';
import {
  AttendanceStatus,
  LiteracyAnswer,
  OlderAdultEvaluation,
  OlderAdultParticipant,
  OlderAdultSex,
  WorkshopAttendance,
  WorkshopEvolution,
} from '@/lib/adultoMayor/types';

export const maxDuration = 30;

const asText = (value: unknown, max = 1000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const asEnum = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? value as T : fallback;
const isTestLabel = (value: string) => /^\[PRUEBA E2E\]/i.test(value.trim());

function staffName(user: any): string {
  return String(user?.displayName || user?.name || user?.email || 'Equipo del taller');
}

function serializeDocs<T>(snapshot: any): T[] {
  return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as T));
}

function buildReassessmentStatus(participants: OlderAdultParticipant[], evaluations: OlderAdultEvaluation[]) {
  const latestByParticipant = new Map<string, OlderAdultEvaluation>();
  evaluations.filter(item => item.status === 'SUBMITTED').forEach(item => {
    const existing = latestByParticipant.get(item.participantId);
    if (!existing || (item.submittedAt || item.updatedAt) > (existing.submittedAt || existing.updatedAt)) {
      latestByParticipant.set(item.participantId, item);
    }
  });
  const now = Date.now();
  return participants.map(participant => {
    const latest = latestByParticipant.get(participant.id);
    const lastDate = latest?.submittedAt || latest?.updatedAt || '';
    const daysSince = lastDate ? Math.floor((now - new Date(lastDate).getTime()) / 86_400_000) : null;
    const status = daysSince == null ? 'SIN_EVALUACION' : daysSince >= 42 ? 'VENCIDA' : daysSince >= 28 ? 'PROXIMA' : 'AL_DIA';
    return {
      participantId: participant.id,
      participantName: participant.fullName,
      lastEvaluationAt: lastDate || null,
      daysSince,
      status,
    };
  });
}

async function loadStaffDashboard(req: Request) {
  const db = getAdminDb();
  const portal = await ensurePortalConfig();
  const attendanceCutoff = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const [participantsSnap, evaluationsSnap, attendanceSnap, evolutionsSnap, evaluatorsSnap] = await Promise.all([
    db.collection(AM_COLLECTIONS.participants).get(),
    db.collection(AM_COLLECTIONS.evaluations).get(),
    // La portada solo necesita asistencia reciente; evita releer años completos en cada apertura.
    db.collection(AM_COLLECTIONS.attendance).where('date', '>=', attendanceCutoff).get(),
    db.collection(AM_COLLECTIONS.workshopEvolutions).get(),
    db.collection(AM_COLLECTIONS.evaluators).get(),
  ]);
  const allParticipants = serializeDocs<OlderAdultParticipant>(participantsSnap);
  const participants = allParticipants
    .filter(item => item.active !== false)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
  const archivedParticipants = allParticipants
    .filter(item => item.active === false)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
  const evaluations = serializeDocs<OlderAdultEvaluation>(evaluationsSnap)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const attendance = serializeDocs<WorkshopAttendance>(attendanceSnap)
    .sort((a, b) => b.date.localeCompare(a.date));
  const workshopEvolutions = serializeDocs<WorkshopEvolution>(evolutionsSnap)
    .sort((a, b) => b.date.localeCompare(a.date));
  const evaluators = evaluatorsSnap.docs.map((doc: any) => {
    const data = doc.data();
    return {
      id: doc.id,
      fullName: data.fullName || '',
      email: data.email || '',
      university: data.university || '',
      active: data.active === true,
      createdAt: data.createdAt || '',
      lastAccessAt: data.lastAccessAt || '',
      evaluationCount: evaluations.filter(item => item.evaluatorId === doc.id).length,
    };
  }).sort((a: any, b: any) => a.fullName.localeCompare(b.fullName, 'es'));

  return {
    participants,
    archivedParticipants,
    evaluations,
    attendance,
    workshopEvolutions,
    evaluators,
    reassessment: buildReassessmentStatus(participants, evaluations),
    portalUrl: `${publicBaseUrl(req)}/evaluacion-adulto-mayor?portal=${encodeURIComponent(portal.portalToken)}`,
    schedule: { days: ['MARTES', 'JUEVES'], startTime: '14:30', endTime: '15:45' },
  };
}

function participantPayload(input: any, staffId: string, existing?: OlderAdultParticipant): OlderAdultParticipant {
  const fullName = asText(input?.fullName, 120).replace(/\s+/g, ' ');
  if (fullName.length < 3) throw new Error('Escribe el nombre completo.');
  const birthDate = asText(input?.birthDate, 10);
  const now = new Date().toISOString();
  return {
    id: existing?.id || randomUUID(),
    fullName,
    rut: asText(input?.rut, 20),
    birthDate,
    age: calculateAge(birthDate),
    sex: asEnum<OlderAdultSex>(input?.sex, ['MUJER', 'HOMBRE', 'NO_ESPECIFICA'] as const, 'NO_ESPECIFICA'),
    nationality: asText(input?.nationality, 80),
    phone: asText(input?.phone, 40),
    emergencyContact: asText(input?.emergencyContact, 160),
    educationLevel: asText(input?.educationLevel, 100),
    occupation: asText(input?.occupation, 120),
    address: asText(input?.address, 180),
    commune: asText(input?.commune, 100),
    supportNetwork: asText(input?.supportNetwork, 300),
    readingAbility: asEnum<LiteracyAnswer>(input?.readingAbility, ['SI', 'CON_DIFICULTAD', 'NO'] as const, 'SI'),
    writingAbility: asEnum<LiteracyAnswer>(input?.writingAbility, ['SI', 'CON_DIFICULTAD', 'NO'] as const, 'SI'),
    linkedClinicalUserId: asText(input?.linkedClinicalUserId, 120),
    createdAt: existing?.createdAt || now,
    createdByType: existing?.createdByType || 'STAFF',
    createdById: existing?.createdById || staffId,
    active: input?.active !== false,
    testRecord: existing?.testRecord === true || isTestLabel(fullName),
    archivedAt: existing?.archivedAt || null,
    archivedByUid: existing?.archivedByUid || null,
  };
}

export async function GET(req: Request) {
  try {
    await requireWorkshopStaff(req.headers.get('authorization'));
    return NextResponse.json({ ok: true, data: await loadStaffDashboard(req) });
  } catch (error: any) {
    console.error('[adulto-mayor/staff:get]', error);
    const message = error?.message || 'No se pudo cargar el taller.';
    const status = message.includes('Unauthorized') ? 401 : message.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const staff = await requireWorkshopStaff(req.headers.get('authorization'));
    const body = await req.json().catch(() => ({}));
    const action = asText(body?.action, 60);
    const db = getAdminDb();

    if (action === 'saveParticipant') {
      const requestedId = asText(body?.participant?.id, 100);
      let existing: OlderAdultParticipant | undefined;
      if (requestedId) {
        const snapshot = await db.collection(AM_COLLECTIONS.participants).doc(requestedId).get();
        if (snapshot.exists) existing = { id: snapshot.id, ...snapshot.data() } as OlderAdultParticipant;
      }
      const participant = participantPayload(body?.participant, staff.uid, existing);
      const rutNormalized = normalizeRut(participant.rut);
      if (rutNormalized) {
        const duplicates = await db.collection(AM_COLLECTIONS.participants).where('rutNormalized', '==', rutNormalized).limit(2).get();
        const duplicate = duplicates.docs.find((doc: any) => doc.id !== participant.id);
        if (duplicate) {
          return NextResponse.json({ ok: false, error: 'Ya existe una persona con ese RUT.', existingParticipantId: duplicate.id }, { status: 409 });
        }
      }
      await db.collection(AM_COLLECTIONS.participants).doc(participant.id).set({
        ...participant,
        fullNameNormalized: normalizeName(participant.fullName),
        rutNormalized,
        updatedAt: new Date().toISOString(),
        updatedByUid: staff.uid,
      }, { merge: true });
      return NextResponse.json({ ok: true, data: { participant } });
    }

    if (action === 'setParticipantActive') {
      const participantId = asText(body?.participantId, 100);
      const active = body?.active === true;
      const ref = db.collection(AM_COLLECTIONS.participants).doc(participantId);
      const snapshot = await ref.get();
      if (!snapshot.exists) throw new Error('No se encontró la persona.');
      const now = new Date().toISOString();
      await ref.update({
        active,
        archivedAt: active ? null : now,
        archivedByUid: active ? null : staff.uid,
        updatedAt: now,
        updatedByUid: staff.uid,
      });
      return NextResponse.json({ ok: true, data: { participantId, active } });
    }

    if (action === 'deleteTestParticipant') {
      const participantId = asText(body?.participantId, 100);
      const ref = db.collection(AM_COLLECTIONS.participants).doc(participantId);
      const snapshot = await ref.get();
      if (!snapshot.exists) throw new Error('No se encontró la persona de prueba.');
      const participant = snapshot.data() || {};
      if (participant.testRecord !== true && !isTestLabel(String(participant.fullName || ''))) {
        return NextResponse.json({ ok: false, error: 'Solo se permite eliminar definitivamente registros marcados como [PRUEBA E2E].' }, { status: 403 });
      }
      const [evaluationsSnap, attendanceSnap] = await Promise.all([
        db.collection(AM_COLLECTIONS.evaluations).where('participantId', '==', participantId).get(),
        db.collection(AM_COLLECTIONS.attendance).where('participantId', '==', participantId).get(),
      ]);
      await Promise.all([
        ...evaluationsSnap.docs.map((doc: any) => doc.ref.delete()),
        ...attendanceSnap.docs.map((doc: any) => doc.ref.delete()),
        ref.delete(),
      ]);
      return NextResponse.json({
        ok: true,
        data: { participantId, deletedEvaluations: evaluationsSnap.size, deletedAttendance: attendanceSnap.size },
      });
    }

    if (action === 'setAttendance') {
      const date = asText(body?.date, 10);
      const participantId = asText(body?.participantId, 100);
      const status = asEnum<AttendanceStatus>(body?.status, ['PRESENTE', 'AUSENTE'] as const, 'AUSENTE');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Fecha de asistencia inválida.');
      const participantSnap = await db.collection(AM_COLLECTIONS.participants).doc(participantId).get();
      if (!participantSnap.exists) throw new Error('No se encontró la persona.');
      const id = `${date}_${participantId}`;
      const attendance: WorkshopAttendance = {
        id,
        date,
        participantId,
        participantName: String(participantSnap.data()?.fullName || ''),
        status,
        registeredByUid: staff.uid,
        registeredByName: staffName(staff.user),
        updatedAt: new Date().toISOString(),
      };
      await db.collection(AM_COLLECTIONS.attendance).doc(id).set(attendance, { merge: true });
      return NextResponse.json({ ok: true, data: { attendance } });
    }

    if (action === 'startStaffEvaluation') {
      const participantId = asText(body?.participantId, 100);
      const participantSnap = await db.collection(AM_COLLECTIONS.participants).doc(participantId).get();
      if (!participantSnap.exists || participantSnap.data()?.active !== true) throw new Error('La persona seleccionada no está disponible.');
      const participant = { id: participantSnap.id, ...participantSnap.data() } as OlderAdultParticipant;
      const existing = await db.collection(AM_COLLECTIONS.evaluations).where('evaluatorId', '==', staff.uid).get();
      const draftDoc = existing.docs.find((doc: any) => {
        const item = doc.data();
        return item.participantId === participantId && item.status === 'DRAFT';
      });
      if (draftDoc) return NextResponse.json({ ok: true, data: { evaluation: { id: draftDoc.id, ...draftDoc.data() } } });

      const id = randomUUID();
      const now = new Date().toISOString();
      const data = createEmptyEvaluationData(participant);
      const evaluation: OlderAdultEvaluation = {
        id,
        participantId,
        evaluatorId: staff.uid,
        evaluatorName: staffName(staff.user),
        participantSnapshot: {
          fullName: participant.fullName,
          birthDate: participant.birthDate || '',
          age: participant.age ?? null,
          sex: participant.sex,
          commune: participant.commune || '',
        },
        status: 'DRAFT',
        step: 1,
        data,
        results: calculateOlderAdultResults(participant, data),
        createdAt: now,
        updatedAt: now,
      };
      await db.collection(AM_COLLECTIONS.evaluations).doc(id).set(evaluation);
      return NextResponse.json({ ok: true, data: { evaluation } });
    }

    if (action === 'saveStaffEvaluation' || action === 'submitStaffEvaluation') {
      const evaluationId = asText(body?.evaluationId, 100);
      const ref = db.collection(AM_COLLECTIONS.evaluations).doc(evaluationId);
      const snapshot = await ref.get();
      if (!snapshot.exists) throw new Error('No se encontró la evaluación.');
      const current = { id: snapshot.id, ...snapshot.data() } as OlderAdultEvaluation;
      if (current.evaluatorId !== staff.uid) {
        return NextResponse.json({ ok: false, error: 'Este borrador pertenece a otro evaluador.' }, { status: 403 });
      }
      if (current.status === 'SUBMITTED') {
        return NextResponse.json({ ok: false, error: 'La evaluación entregada está en modo lectura.' }, { status: 409 });
      }
      const participantSnap = await db.collection(AM_COLLECTIONS.participants).doc(current.participantId).get();
      if (!participantSnap.exists) throw new Error('La persona asociada ya no está disponible.');
      const participant = { id: participantSnap.id, ...participantSnap.data() } as OlderAdultParticipant;
      const data = sanitizeOlderAdultEvaluation(body?.data, participant);
      const now = new Date().toISOString();
      const patch: Partial<OlderAdultEvaluation> = {
        data,
        results: calculateOlderAdultResults(participant, data),
        step: Math.max(1, Math.min(5, Number(body?.step) || current.step || 1)),
        updatedAt: now,
      };
      if (action === 'submitStaffEvaluation') {
        const completeness = evaluationCompleteness(data);
        if (!completeness.complete) {
          return NextResponse.json({ ok: false, error: `Antes de entregar completa: ${completeness.missing.join(', ')}.`, missing: completeness.missing }, { status: 422 });
        }
        patch.status = 'SUBMITTED';
        patch.submittedAt = now;
        patch.step = 5;
      }
      await ref.update(patch);
      return NextResponse.json({ ok: true, data: { evaluation: { ...current, ...patch } } });
    }

    if (action === 'deleteDraftEvaluation') {
      const evaluationId = asText(body?.evaluationId, 100);
      const ref = db.collection(AM_COLLECTIONS.evaluations).doc(evaluationId);
      const snapshot = await ref.get();
      if (!snapshot.exists) throw new Error('No se encontró el borrador.');
      const evaluation = snapshot.data() || {};
      if (evaluation.status !== 'DRAFT') {
        return NextResponse.json({ ok: false, error: 'Las evaluaciones entregadas no se eliminan.' }, { status: 409 });
      }
      const isTeacher = String(staff.user?.role || '') === 'DOCENTE';
      if (evaluation.evaluatorId !== staff.uid && !isTeacher) {
        return NextResponse.json({ ok: false, error: 'Solo el autor o un docente puede descartar este borrador.' }, { status: 403 });
      }
      await ref.delete();
      return NextResponse.json({ ok: true, data: { evaluationId } });
    }

    if (action === 'saveWorkshopEvolution') {
      const input = body?.evolution || {};
      const id = asText(input?.id, 100) || randomUUID();
      const evolution: WorkshopEvolution = {
        id,
        date: asText(input?.date, 10),
        startTime: asText(input?.startTime, 5) || '14:30',
        endTime: asText(input?.endTime, 5) || '15:45',
        summary: asText(input?.summary, 2500),
        activities: asText(input?.activities, 3000),
        dosage: asText(input?.dosage, 2000),
        adaptations: asText(input?.adaptations, 2000),
        groupResponse: asText(input?.groupResponse, 2000),
        incidents: asText(input?.incidents, 2000),
        nextPlan: asText(input?.nextPlan, 2000),
        transcription: asText(input?.transcription, 8000),
        attendanceCount: Math.max(0, Math.min(100, Number(input?.attendanceCount) || 0)),
        createdByUid: staff.uid,
        createdByName: staffName(staff.user),
        createdAt: asText(input?.createdAt, 40) || new Date().toISOString(),
        testRecord: isTestLabel(asText(input?.summary, 2500)),
      };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(evolution.date)) throw new Error('Selecciona la fecha del taller.');
      if (!evolution.summary && !evolution.activities) throw new Error('Registra al menos un resumen o las actividades realizadas.');
      await db.collection(AM_COLLECTIONS.workshopEvolutions).doc(id).set(evolution, { merge: true });
      return NextResponse.json({ ok: true, data: { evolution } });
    }

    if (action === 'deleteTestWorkshopEvolution') {
      const evolutionId = asText(body?.evolutionId, 100);
      const ref = db.collection(AM_COLLECTIONS.workshopEvolutions).doc(evolutionId);
      const snapshot = await ref.get();
      if (!snapshot.exists) throw new Error('No se encontró la sesión de prueba.');
      const evolution = snapshot.data() || {};
      if (evolution.testRecord !== true && !isTestLabel(String(evolution.summary || ''))) {
        return NextResponse.json({ ok: false, error: 'Solo se pueden eliminar definitivamente sesiones marcadas como [PRUEBA E2E].' }, { status: 403 });
      }
      await ref.delete();
      return NextResponse.json({ ok: true, data: { evolutionId } });
    }

    if (action === 'rotatePortal') {
      const portal = await rotatePortalConfig();
      return NextResponse.json({
        ok: true,
        data: { portalUrl: `${publicBaseUrl(req)}/evaluacion-adulto-mayor?portal=${encodeURIComponent(portal.portalToken)}` },
      });
    }

    if (action === 'setEvaluatorActive') {
      const evaluatorId = asText(body?.evaluatorId, 100);
      const active = body?.active === true;
      await db.collection(AM_COLLECTIONS.evaluators).doc(evaluatorId).set({ active, updatedAt: new Date().toISOString() }, { merge: true });
      return NextResponse.json({ ok: true, data: { evaluatorId, active } });
    }

    if (action === 'renewEvaluatorAccess') {
      const evaluatorId = asText(body?.evaluatorId, 100);
      if (!evaluatorId) throw new Error('Falta identificar al evaluador.');
      const evaluatorRef = db.collection(AM_COLLECTIONS.evaluators).doc(evaluatorId);
      const evaluatorSnap = await evaluatorRef.get();
      if (!evaluatorSnap.exists) throw new Error('No se encontró al evaluador.');
      const accessToken = createSecureToken(32);
      await evaluatorRef.set({
        tokenHash: hashToken(accessToken),
        active: true,
        accessRenewedAt: new Date().toISOString(),
        accessRenewedByUid: staff.uid,
      }, { merge: true });
      return NextResponse.json({
        ok: true,
        data: {
          recoveryUrl: `${publicBaseUrl(req)}/evaluacion-adulto-mayor?acceso=${encodeURIComponent(accessToken)}`,
        },
      });
    }

    if (action === 'deleteTestEvaluator') {
      const evaluatorId = asText(body?.evaluatorId, 100);
      const ref = db.collection(AM_COLLECTIONS.evaluators).doc(evaluatorId);
      const snapshot = await ref.get();
      if (!snapshot.exists) throw new Error('No se encontró al evaluador de prueba.');
      const evaluator = snapshot.data() || {};
      const testIdentity = isTestLabel(String(evaluator.fullName || ''))
        && String(evaluator.email || '').toLowerCase().endsWith('@example.com');
      if (evaluator.testRecord !== true && !testIdentity) {
        return NextResponse.json({ ok: false, error: 'Solo se pueden eliminar definitivamente evaluadores marcados como [PRUEBA E2E].' }, { status: 403 });
      }
      const evaluationsSnap = await db.collection(AM_COLLECTIONS.evaluations)
        .where('evaluatorId', '==', evaluatorId)
        .get();
      await Promise.all([
        ...evaluationsSnap.docs.map((doc: any) => doc.ref.delete()),
        ref.delete(),
      ]);
      return NextResponse.json({ ok: true, data: { evaluatorId, deletedEvaluations: evaluationsSnap.size } });
    }

    return NextResponse.json({ ok: false, error: 'Acción no reconocida.' }, { status: 400 });
  } catch (error: any) {
    console.error('[adulto-mayor/staff:post]', error);
    const message = error?.message || 'No se pudo guardar.';
    const status = message.includes('Unauthorized') ? 401 : message.includes('Forbidden') ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
