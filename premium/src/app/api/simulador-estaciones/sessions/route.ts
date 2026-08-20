import { requireTeacher } from '@/lib/server/firebaseAdmin';
import { CreateSessionSchema } from '@/lib/simulador-estaciones/types';
import { createStationSession, getLatestStationSessions } from '@/lib/simulador-estaciones/server';
import { stationApiError, stationApiSuccess } from '@/lib/simulador-estaciones/api';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(request: Request) {
  try {
    const auth = await requireTeacher(request.headers.get('authorization'));
    const sessions = await getLatestStationSessions(auth.uid);
    return stationApiSuccess({ sessions, betaAccess: 'DOCENTE_ONLY' });
  } catch (error) {
    return stationApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireTeacher(request.headers.get('authorization'));
    const input = CreateSessionSchema.parse(await request.json());
    const session = await createStationSession({
      ownerId: auth.uid,
      ownerName: String(auth.user?.displayName || auth.user?.name || auth.user?.email || 'Docente'),
      ownerEmail: String(auth.user?.email || ''),
      ...input,
    });
    return stationApiSuccess({ session }, 201);
  } catch (error) {
    return stationApiError(error);
  }
}
