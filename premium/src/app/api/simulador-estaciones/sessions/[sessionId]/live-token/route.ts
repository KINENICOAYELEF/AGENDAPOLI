import { EndSensitivity, GoogleGenAI, Modality, StartSensitivity } from '@google/genai';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb, requireTeacher } from '@/lib/server/firebaseAdmin';
import { stationApiError, stationApiSuccess } from '@/lib/simulador-estaciones/api';
import {
  STATION_LIVE_MODELS,
  STATION_SESSION_COLLECTION,
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
    const excludedModels = new Set(
      Array.isArray(body.excludeModels)
        ? body.excludeModels.map(String).filter((model: string) => STATION_LIVE_MODELS.includes(model as (typeof STATION_LIVE_MODELS)[number]))
        : [],
    );

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
    const preferred = STATION_LIVE_MODELS.filter((model) => !excludedModels.has(model));
    const candidates = preferred.length > 0 ? preferred : [...STATION_LIVE_MODELS];
    let token: Awaited<ReturnType<typeof ai.authTokens.create>> | null = null;
    let selectedModel = candidates[0];
    let lastError: unknown;
    for (const model of candidates) {
      try {
        token = await ai.authTokens.create({
          config: {
            uses: 1,
            expireTime,
            newSessionExpireTime,
            liveConnectConstraints: {
              model,
              config: {
                responseModalities: [Modality.AUDIO],
                temperature: 0.35,
                speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
                },
                systemInstruction,
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                realtimeInputConfig: {
                  automaticActivityDetection: {
                    disabled: false,
                    // Prioriza no perder la voz del estudiante. La cancelación
                    // de eco del navegador controla el audio de los parlantes;
                    // una sensibilidad baja omitía intervenciones normales.
                    startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
                    endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
                    prefixPaddingMs: 100,
                    silenceDurationMs: 650,
                  },
                },
                // Un handle pertenece a la sesión/modelo que lo emitió. Si el
                // cliente pidió cambiar de modelo por falla, reconstruimos el
                // contexto desde el checkpoint en vez de reutilizarlo.
                sessionResumption: resumeHandle && excludedModels.size === 0 ? { handle: resumeHandle } : {},
                contextWindowCompression: {
                  triggerTokens: '12000',
                  slidingWindow: { targetTokens: '8000' },
                },
              },
            },
            lockAdditionalFields: [],
          },
        });
        selectedModel = model;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!token?.name) throw lastError || new Error('Gemini no devolvió un token efímero');
    await getAdminDb().collection(STATION_SESSION_COLLECTION).doc(sessionId).update({
      [`modelTrace.liveByStation.${station}`]: FieldValue.arrayUnion(selectedModel),
    });
    return stationApiSuccess({
      token: token.name,
      model: selectedModel,
      expiresAt: expireTime,
      resumed: Boolean(resumeHandle && excludedModels.size === 0),
      openingInstruction: station === 'DEFENSA'
        ? 'Inicia la defensa ahora con una primera pregunta específica del caso.'
        : '',
    });
  } catch (error) {
    return stationApiError(error);
  }
}
