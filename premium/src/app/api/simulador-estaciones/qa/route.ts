import { requireTeacher, getAdminDb } from '@/lib/server/firebaseAdmin';
import { stationApiError, stationApiSuccess } from '@/lib/simulador-estaciones/api';
import {
  STATION_SESSION_COLLECTION,
  getStoredStationSession,
  getStationSessionForOwner,
} from '@/lib/simulador-estaciones/server';
import { STATION_QA_PREFIX, validateQaSession } from '@/lib/simulador-estaciones/qaFixture';

export const runtime = 'nodejs';

const CONFIRMATION = 'RUN_ISOLATED_STATION_QA';

function assertQaSession(session: { ownerId: string; startingNotes?: string }, ownerId: string) {
  if (session.ownerId !== ownerId) throw new Error('FORBIDDEN: La sesión QA pertenece a otra cuenta');
  if (!String(session.startingNotes || '').startsWith(STATION_QA_PREFIX)) {
    throw new Error('FORBIDDEN: Solo se pueden inspeccionar o limpiar sesiones QA identificadas');
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireTeacher(request.headers.get('authorization'));
    const url = new URL(request.url);
    const sessionId = String(url.searchParams.get('sessionId') || '');
    if (!sessionId) throw new Error('INCOMPLETE: Falta sessionId');

    const stored = await getStoredStationSession(sessionId);
    assertQaSession(stored, auth.uid);
    const session = await getStationSessionForOwner(sessionId, auth.uid);
    const attemptSnap = await getAdminDb().collection('simulador_intentos').doc(`stations_${sessionId}`).get();
    const attempt = attemptSnap.data() || {};
    const sessionChecks = validateQaSession(session);

    return stationApiSuccess({
      session,
      checks: {
        ...sessionChecks,
        sessionCompleted: session.status === 'COMPLETED',
        attemptCreated: attemptSnap.exists,
        attemptCountable: attempt.countableForMinimum === true,
        integrityValid: attempt.integrityStatus === 'VALID',
        fullTraceStored: attempt.fullSessionData?.stationSessionId === sessionId,
        scorecardStored: Object.keys(attempt.scorecard || {}).length === 9,
        elapsedTimeStored: Number(attempt.tiempoSegundos || 0) > 0,
      },
      attempt: attemptSnap.exists ? {
        id: attemptSnap.id,
        countableForMinimum: attempt.countableForMinimum,
        integrityStatus: attempt.integrityStatus,
        scorecardItems: Object.keys(attempt.scorecard || {}).length,
        elapsedSeconds: Number(attempt.tiempoSegundos || 0),
      } : null,
    });
  } catch (error) {
    return stationApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireTeacher(request.headers.get('authorization'));
    const body = await request.json() as { sessionId?: string; confirmation?: string };
    const sessionId = String(body.sessionId || '');
    if (!sessionId || body.confirmation !== CONFIRMATION) {
      throw new Error('INCOMPLETE: Confirmación QA inválida');
    }

    const stored = await getStoredStationSession(sessionId);
    assertQaSession(stored, auth.uid);
    const db = getAdminDb();
    const batch = db.batch();
    batch.delete(db.collection(STATION_SESSION_COLLECTION).doc(sessionId));
    batch.delete(db.collection('simulador_intentos').doc(`stations_${sessionId}`));
    await batch.commit();

    return stationApiSuccess({ cleaned: true, sessionId });
  } catch (error) {
    return stationApiError(error);
  }
}
