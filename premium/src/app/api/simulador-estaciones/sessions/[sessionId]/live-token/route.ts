import { GoogleGenAI, Modality } from '@google/genai';
import { requireTeacher } from '@/lib/server/firebaseAdmin';
import { stationApiError, stationApiSuccess } from '@/lib/simulador-estaciones/api';
import {
  STATION_LIVE_MODEL,
  buildStationInstruction,
  getStoredStationSession,
} from '@/lib/simulador-estaciones/server';
import { STATION_KEYS, type VoiceStationKey } from '@/lib/simulador-estaciones/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await requireTeacher(request.headers.get('authorization'));
    const { sessionId } = await context.params;
    const body = await request.json();
    const requestedStation = String(body.station || '');
    if (!STATION_KEYS.includes(requestedStation as (typeof STATION_KEYS)[number]) || requestedStation === 'PLANIFICACION_ESCRITA') {
      throw new Error('validation: Esta estación no admite conexión de voz');
    }
    const station = requestedStation as VoiceStationKey;

    const session = await getStoredStationSession(sessionId);
    if (session.ownerId !== auth.uid) throw new Error('FORBIDDEN: Esta sesión pertenece a otra cuenta');
    if (session.currentStation !== station) throw new Error('INCOMPLETE: La estación solicitada no está activa');
    if (!session.fullCase) throw new Error('INCOMPLETE: El caso todavía no está listo');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY no está configurada en el servidor');
    const now = Date.now();
    const expireTime = new Date(now + 75 * 60 * 1000).toISOString();
    const newSessionExpireTime = new Date(now + 70 * 60 * 1000).toISOString();
    const resumeHandle = session.liveResumeHandles?.[station];
    const systemInstruction = buildStationInstruction(session, station);

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: 'v1alpha' },
    });
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        liveConnectConstraints: {
          model: STATION_LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            temperature: 0.35,
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
            },
            systemInstruction,
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            // `transparent` no está disponible en la API gratuita de Gemini.
            // La reanudación se habilita con un objeto vacío o con el `handle` previo.
            sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
            contextWindowCompression: {
              triggerTokens: '12000',
              slidingWindow: { targetTokens: '8000' },
            },
          },
        },
        lockAdditionalFields: [],
      },
    });

    if (!token.name) throw new Error('Gemini no devolvió un token efímero');
    return stationApiSuccess({
      token: token.name,
      model: STATION_LIVE_MODEL,
      expiresAt: expireTime,
      resumed: Boolean(resumeHandle),
      openingInstruction: station === 'DEFENSA'
        ? 'Inicia la defensa ahora con una primera pregunta específica del caso.'
        : '',
    });
  } catch (error) {
    return stationApiError(error);
  }
}
