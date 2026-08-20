import { requireTeacher } from '@/lib/server/firebaseAdmin';
import { stationApiError, stationApiSuccess } from '@/lib/simulador-estaciones/api';
import { evaluateStationSession } from '@/lib/simulador-estaciones/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await requireTeacher(request.headers.get('authorization'));
    const { sessionId } = await context.params;
    const session = await evaluateStationSession(sessionId, auth.uid);
    return stationApiSuccess({ session });
  } catch (error) {
    return stationApiError(error);
  }
}
