import { Timestamp } from 'firebase-admin/firestore';
import { requireTeacher, getAdminDb } from '@/lib/server/firebaseAdmin';
import { stationApiError, stationApiSuccess } from '@/lib/simulador-estaciones/api';
import {
  STATION_SESSION_COLLECTION,
  getStoredStationSession,
  getStationSessionForOwner,
} from '@/lib/simulador-estaciones/server';
import {
  SessionPatchSchema,
  STATION_KEYS,
  type StationKey,
  type StationProgress,
} from '@/lib/simulador-estaciones/types';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await requireTeacher(request.headers.get('authorization'));
    const { sessionId } = await context.params;
    const session = await getStationSessionForOwner(sessionId, auth.uid);
    return stationApiSuccess({ session });
  } catch (error) {
    return stationApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requireTeacher(request.headers.get('authorization'));
    const { sessionId } = await context.params;
    const input = SessionPatchSchema.parse(await request.json());
    const existing = await getStoredStationSession(sessionId);
    if (existing.ownerId !== auth.uid) throw new Error('FORBIDDEN: Esta sesión pertenece a otra cuenta');
    if (['COMPLETED', 'ABANDONED'].includes(existing.status)) {
      throw new Error('INCOMPLETE: La sesión ya está cerrada y no admite cambios');
    }

    const station = input.station || existing.currentStation;
    if (station !== existing.currentStation) {
      throw new Error('INCOMPLETE: La estación indicada no es la estación activa');
    }

    const current = existing.stations[station] as StationProgress;
    if (current.status === 'COMPLETED') {
      throw new Error('INCOMPLETE: Una estación completada queda bloqueada');
    }
    const patched: StationProgress = {
      ...current,
      ...(input.remainingSeconds !== undefined ? { remainingSeconds: input.remainingSeconds } : {}),
      ...(input.elapsedSeconds !== undefined ? { elapsedSeconds: input.elapsedSeconds } : {}),
      ...(input.transcript ? { transcript: input.transcript } : {}),
      ...(input.semanticSummary !== undefined ? { semanticSummary: input.semanticSummary } : {}),
      ...(input.semanticConfirmation ? { semanticConfirmation: input.semanticConfirmation } : {}),
      ...(input.audioUncertainties ? { audioUncertainties: input.audioUncertainties } : {}),
      ...(input.reconnectCount !== undefined ? { reconnectCount: input.reconnectCount } : {}),
    };

    let status = existing.status;
    let currentStation = existing.currentStation;
    let currentStationIndex = existing.currentStationIndex;

    if (input.action === 'START') {
      patched.status = 'IN_PROGRESS';
      status = 'IN_PROGRESS';
    } else if (input.action === 'PAUSE') {
      patched.status = 'PAUSED';
      status = 'PAUSED';
    } else if (input.action === 'CHECKPOINT') {
      if (patched.status === 'NOT_STARTED' || patched.status === 'PAUSED') patched.status = 'IN_PROGRESS';
      status = 'IN_PROGRESS';
    } else if (input.action === 'ABANDON') {
      patched.status = 'PAUSED';
      status = 'ABANDONED';
    } else if (input.action === 'COMPLETE_STATION') {
      if (station !== 'PLANIFICACION_ESCRITA') {
        const confirmationStatus = patched.semanticConfirmation?.status || 'PENDING';
        if (confirmationStatus === 'PENDING') {
          throw new Error('INCOMPLETE: Espera el cierre de escucha antes de completar la estación');
        }
        const hasStudentEvidence = patched.transcript.some((turn) => turn.role === 'STUDENT' && turn.text.trim().length >= 3);
        if (!hasStudentEvidence && patched.elapsedSeconds < 60) {
          throw new Error('INCOMPLETE: La estación no contiene todavía una respuesta oral recuperable');
        }
      }
      patched.status = 'COMPLETED';
      patched.remainingSeconds = Math.max(0, patched.remainingSeconds);
      const index = STATION_KEYS.indexOf(station as StationKey);
      if (index < STATION_KEYS.length - 1) {
        currentStationIndex = index + 1;
        currentStation = STATION_KEYS[currentStationIndex];
      }
      status = 'IN_PROGRESS';
    }

    const stations = { ...existing.stations, [station]: patched };
    const update: Record<string, unknown> = {
      stations,
      status,
      currentStation,
      currentStationIndex,
      updatedAt: Timestamp.now(),
    };
    if (input.planningDraft) update.planningDraft = input.planningDraft;
    if (input.resumeHandle) {
      update.liveResumeHandles = {
        ...(existing.liveResumeHandles || {}),
        [station]: input.resumeHandle,
      };
    }

    await getAdminDb().collection(STATION_SESSION_COLLECTION).doc(sessionId).update(update);
    const session = await getStationSessionForOwner(sessionId, auth.uid);
    return stationApiSuccess({ session });
  } catch (error) {
    return stationApiError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const auth = await requireTeacher(request.headers.get('authorization'));
    const { sessionId } = await context.params;
    const existing = await getStoredStationSession(sessionId);
    if (existing.ownerId !== auth.uid) throw new Error('FORBIDDEN: Esta sesión pertenece a otra cuenta');
    if (existing.status === 'COMPLETED') {
      throw new Error('INCOMPLETE: Una simulación completada forma parte del historial y no se elimina');
    }
    await getAdminDb().collection(STATION_SESSION_COLLECTION).doc(sessionId).delete();
    return stationApiSuccess({ deleted: true, sessionId });
  } catch (error) {
    return stationApiError(error);
  }
}
