import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import {
  AM_COLLECTIONS,
  createSecureToken,
  EVALUATOR_COOKIE,
  hashToken,
  PORTAL_COOKIE,
  publicBaseUrl,
  publicEvaluator,
  requireExternalEvaluator,
  validatePortalAccess,
} from '@/lib/server/adultoMayor';
import {
  calculateAge,
  calculateOlderAdultResults,
  createEmptyEvaluationData,
  evaluationCompleteness,
  normalizeName,
  normalizeRut,
} from '@/lib/adultoMayor/calculations';
import { sanitizeOlderAdultEvaluation } from '@/lib/adultoMayor/sanitizeEvaluation';
import {
  LiteracyAnswer,
  OlderAdultEvaluation,
  OlderAdultParticipant,
  OlderAdultSex,
  PublicPortalPayload,
} from '@/lib/adultoMayor/types';

export const maxDuration = 30;

const evaluatorCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 180,
};

const portalCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/evaluacion-adulto-mayor',
  maxAge: 60 * 60 * 24 * 30,
};

const asText = (value: unknown, max = 1000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const asEnum = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? value as T : fallback;

const literacyValues = ['SI', 'CON_DIFICULTAD', 'NO'] as const;
const sexValues = ['MUJER', 'HOMBRE', 'NO_ESPECIFICA'] as const;

function sanitizeParticipant(input: any, evaluatorId: string): Omit<OlderAdultParticipant, 'id'> {
  const fullName = asText(input?.fullName, 120).replace(/\s+/g, ' ');
  if (fullName.length < 3) throw new Error('El nombre de la persona debe tener al menos 3 caracteres.');
  const birthDate = asText(input?.birthDate, 10);
  const rut = asText(input?.rut, 20);
  const now = new Date().toISOString();
  return {
    fullName,
    rut,
    birthDate,
    age: calculateAge(birthDate),
    sex: asEnum<OlderAdultSex>(input?.sex, sexValues, 'NO_ESPECIFICA'),
    nationality: asText(input?.nationality, 80),
    phone: asText(input?.phone, 40),
    emergencyContact: asText(input?.emergencyContact, 160),
    educationLevel: asText(input?.educationLevel, 100),
    occupation: asText(input?.occupation, 120),
    address: asText(input?.address, 180),
    commune: asText(input?.commune, 100),
    supportNetwork: asText(input?.supportNetwork, 300),
    readingAbility: asEnum<LiteracyAnswer>(input?.readingAbility, literacyValues, 'SI'),
    writingAbility: asEnum<LiteracyAnswer>(input?.writingAbility, literacyValues, 'SI'),
    linkedClinicalUserId: '',
    createdAt: now,
    createdByType: 'EXTERNAL_EVALUATOR',
    createdById: evaluatorId,
    active: true,
  };
}

function publicParticipant(participant: OlderAdultParticipant) {
  return {
    id: participant.id,
    fullName: participant.fullName,
    age: participant.age ?? null,
    sex: participant.sex,
    commune: participant.commune || '',
  };
}

async function loadPortalPayload(req: Request): Promise<PublicPortalPayload> {
  const { evaluator, rawToken } = await requireExternalEvaluator(req);
  const db = getAdminDb();
  const [participantsSnap, evaluationsSnap] = await Promise.all([
    db.collection(AM_COLLECTIONS.participants).where('active', '==', true).get(),
    db.collection(AM_COLLECTIONS.evaluations).where('evaluatorId', '==', evaluator.id).get(),
  ]);
  const participants = participantsSnap.docs
    .map((doc: any) => publicParticipant({ id: doc.id, ...doc.data() } as OlderAdultParticipant))
    .sort((a: any, b: any) => a.fullName.localeCompare(b.fullName, 'es'));
  const evaluations = evaluationsSnap.docs
    .map((doc: any) => ({ id: doc.id, ...doc.data() } as OlderAdultEvaluation))
    .sort((a: OlderAdultEvaluation, b: OlderAdultEvaluation) => b.updatedAt.localeCompare(a.updatedAt));
  return {
    evaluator: publicEvaluator(evaluator),
    participants,
    evaluations,
    recoveryUrl: `${publicBaseUrl(req)}/evaluacion-adulto-mayor?acceso=${encodeURIComponent(rawToken)}`,
  };
}

export async function GET(req: Request) {
  try {
    const payload = await loadPortalPayload(req);
    return NextResponse.json({ ok: true, data: payload });
  } catch (error: any) {
    if (await validatePortalAccess(req)) {
      return NextResponse.json({ ok: true, data: { needsRegistration: true } });
    }
    return NextResponse.json({ ok: false, error: error?.message || 'Acceso no disponible.' }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = asText(body?.action, 60);
    const db = getAdminDb();

    if (action === 'exchangePortal') {
      const portalToken = asText(body?.portalToken, 200);
      if (!await validatePortalAccess(req, portalToken)) {
        return NextResponse.json({ ok: false, error: 'El enlace de acceso no es válido.' }, { status: 401 });
      }
      const response = NextResponse.json({ ok: true, data: { needsRegistration: true } });
      response.cookies.set(PORTAL_COOKIE, portalToken, portalCookieOptions);
      return response;
    }

    if (action === 'recoverEvaluator') {
      const token = asText(body?.token, 300);
      if (!token) throw new Error('Falta el acceso personal.');
      const snapshot = await db.collection(AM_COLLECTIONS.evaluators)
        .where('tokenHash', '==', hashToken(token))
        .limit(1)
        .get();
      if (snapshot.empty || snapshot.docs[0].data()?.active !== true) {
        return NextResponse.json({ ok: false, error: 'El acceso personal no es válido o fue revocado.' }, { status: 401 });
      }
      const response = NextResponse.json({ ok: true, data: { recovered: true } });
      response.cookies.set(EVALUATOR_COOKIE, token, evaluatorCookieOptions);
      return response;
    }

    if (action === 'registerEvaluator') {
      if (!await validatePortalAccess(req)) {
        return NextResponse.json({ ok: false, error: 'Abre nuevamente el enlace compartido por el taller.' }, { status: 401 });
      }
      const fullName = asText(body?.fullName, 120).replace(/\s+/g, ' ');
      const email = asText(body?.email, 160).toLowerCase();
      const university = asText(body?.university, 120);
      if (fullName.length < 3) throw new Error('Escribe tu nombre completo.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Escribe un correo válido.');

      const existing = await db.collection(AM_COLLECTIONS.evaluators).where('email', '==', email).limit(1).get();
      if (!existing.empty) {
        return NextResponse.json({
          ok: false,
          error: 'Este correo ya tiene un acceso personal. Usa el enlace que guardaste o solicita al equipo que lo renueve.',
          code: 'EVALUATOR_EXISTS',
        }, { status: 409 });
      }

      const id = randomUUID();
      const token = createSecureToken();
      const now = new Date().toISOString();
      await db.collection(AM_COLLECTIONS.evaluators).doc(id).set({
        fullName,
        fullNameNormalized: normalizeName(fullName),
        email,
        university,
        tokenHash: hashToken(token),
        active: true,
        createdAt: now,
        lastAccessAt: now,
      });
      const response = NextResponse.json({
        ok: true,
        data: {
          registered: true,
          recoveryUrl: `${publicBaseUrl(req)}/evaluacion-adulto-mayor?acceso=${encodeURIComponent(token)}`,
        },
      });
      response.cookies.set(EVALUATOR_COOKIE, token, evaluatorCookieOptions);
      return response;
    }

    const { evaluator } = await requireExternalEvaluator(req);

    if (action === 'createParticipant') {
      const participantData = sanitizeParticipant(body?.participant, evaluator.id);
      const rutNormalized = normalizeRut(participantData.rut);
      const fullNameNormalized = normalizeName(participantData.fullName);
      const duplicateQueries: Promise<any>[] = [];
      if (rutNormalized) {
        duplicateQueries.push(db.collection(AM_COLLECTIONS.participants).where('rutNormalized', '==', rutNormalized).limit(1).get());
      }
      duplicateQueries.push(db.collection(AM_COLLECTIONS.participants).where('fullNameNormalized', '==', fullNameNormalized).limit(8).get());
      const duplicateResults = await Promise.all(duplicateQueries);
      const duplicate = duplicateResults.flatMap(snapshot => snapshot.docs).find((doc: any) => {
        const data = doc.data();
        return rutNormalized
          ? data.rutNormalized === rutNormalized
          : data.fullNameNormalized === fullNameNormalized && data.birthDate === participantData.birthDate;
      });
      if (duplicate) {
        return NextResponse.json({
          ok: false,
          error: 'Ya existe una persona con esos datos. Búscala en la lista antes de crearla nuevamente.',
          code: 'POSSIBLE_DUPLICATE',
          existingParticipantId: duplicate.id,
        }, { status: 409 });
      }
      const id = randomUUID();
      await db.collection(AM_COLLECTIONS.participants).doc(id).set({
        ...participantData,
        fullNameNormalized,
        rutNormalized,
      });
      return NextResponse.json({ ok: true, data: { participant: publicParticipant({ id, ...participantData }) } });
    }

    if (action === 'startEvaluation') {
      const participantId = asText(body?.participantId, 100);
      const participantSnap = await db.collection(AM_COLLECTIONS.participants).doc(participantId).get();
      if (!participantSnap.exists || participantSnap.data()?.active !== true) throw new Error('La persona seleccionada no está disponible.');
      const participant = { id: participantSnap.id, ...participantSnap.data() } as OlderAdultParticipant;

      const existing = await db.collection(AM_COLLECTIONS.evaluations)
        .where('evaluatorId', '==', evaluator.id)
        .get();
      const draftDoc = existing.docs.find((doc: any) => {
        const data = doc.data();
        return data.participantId === participantId && data.status === 'DRAFT';
      });
      if (draftDoc) {
        return NextResponse.json({ ok: true, data: { evaluation: { id: draftDoc.id, ...draftDoc.data() } } });
      }

      const id = randomUUID();
      const now = new Date().toISOString();
      const data = createEmptyEvaluationData(participant);
      const evaluation: OlderAdultEvaluation = {
        id,
        participantId,
        evaluatorId: evaluator.id,
        evaluatorName: evaluator.fullName,
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

    if (action === 'saveEvaluation' || action === 'submitEvaluation') {
      const evaluationId = asText(body?.evaluationId, 100);
      const ref = db.collection(AM_COLLECTIONS.evaluations).doc(evaluationId);
      const snapshot = await ref.get();
      if (!snapshot.exists) throw new Error('No se encontró la evaluación.');
      const current = { id: snapshot.id, ...snapshot.data() } as OlderAdultEvaluation;
      if (current.evaluatorId !== evaluator.id) return NextResponse.json({ ok: false, error: 'No puedes editar esta evaluación.' }, { status: 403 });
      if (current.status === 'SUBMITTED') return NextResponse.json({ ok: false, error: 'La evaluación ya fue entregada y está en modo lectura.' }, { status: 409 });

      const participantSnap = await db.collection(AM_COLLECTIONS.participants).doc(current.participantId).get();
      if (!participantSnap.exists) throw new Error('La persona asociada ya no está disponible.');
      const participant = { id: participantSnap.id, ...participantSnap.data() } as OlderAdultParticipant;
      const data = sanitizeOlderAdultEvaluation(body?.data, participant);
      const results = calculateOlderAdultResults(participant, data);
      const now = new Date().toISOString();
      const step = Math.max(1, Math.min(5, Number(body?.step) || current.step || 1));
      const patch: Partial<OlderAdultEvaluation> = { data, results, step, updatedAt: now };

      if (action === 'submitEvaluation') {
        const completeness = evaluationCompleteness(data);
        if (!completeness.complete) {
          return NextResponse.json({
            ok: false,
            error: `Antes de entregar completa: ${completeness.missing.join(', ')}.`,
            missing: completeness.missing,
          }, { status: 422 });
        }
        patch.status = 'SUBMITTED';
        patch.submittedAt = now;
        patch.step = 5;
      }
      await ref.update(patch);
      return NextResponse.json({ ok: true, data: { evaluation: { ...current, ...patch } } });
    }

    if (action === 'logoutEvaluator') {
      const response = NextResponse.json({ ok: true, data: { loggedOut: true } });
      response.cookies.set(EVALUATOR_COOKIE, '', { ...evaluatorCookieOptions, maxAge: 0 });
      return response;
    }

    return NextResponse.json({ ok: false, error: 'Acción no reconocida.' }, { status: 400 });
  } catch (error: any) {
    console.error('[adulto-mayor/portal]', error);
    const message = error?.message || 'No se pudo procesar la solicitud.';
    const status = message.includes('Unauthorized') ? 401 : message.includes('Forbidden') ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
