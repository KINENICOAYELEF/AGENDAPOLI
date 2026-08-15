import { NextResponse } from 'next/server';
import { requireAuthenticated } from '@/lib/server/firebaseAdmin';
import { callGemini } from '@/lib/ai/geminiClient';
import { jsonrepair } from 'jsonrepair';

/**
 * DICTADO DE EVOLUCIÓN
 *
 * Registrar una evolución toma ocho o diez minutos de escritura, al final de
 * una jornada de seis pacientes. Esa fricción es la causa real de los
 * borradores sin firmar: no es desidia, es que cuesta y se posterga.
 *
 * Dictarla toma menos de un minuto, y sobre todo se puede hacer justo después
 * de la sesión en vez de por la noche, que es donde se pierde.
 *
 * Lo que devuelve es una PROPUESTA. La estudiante la revisa y corrige antes de
 * que toque el formulario: un modelo transcribiendo puede equivocarse en una
 * cifra, y una cifra equivocada en una ficha clínica no es un detalle.
 */
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    await requireAuthenticated(req.headers.get('authorization'));

    const body = await req.json().catch(() => ({}));
    const { audioBase64, mimeType, contexto } = body || {};

    if (!audioBase64) {
      return NextResponse.json({ success: false, error: 'No se recibió audio.' }, { status: 400 });
    }

    const raw = await callGemini({
      systemInstruction: 'Eres un asistente de registro clínico kinesiológico en Chile. Transcribes lo que dicta el profesional y lo ordenas en los campos de una evolución. No agregas nada que no se haya dicho.',
      userPrompt: `Escucha el dictado de una sesión de kinesiología y ordénalo en los campos de la evolución.

${contexto ? `Contexto de la sesión (por si menciona "lo mismo de la vez pasada"):\n${String(contexto).slice(0, 2000)}\n` : ''}
Devuelve SOLO un JSON con esta forma exacta:
{
  "sessionGoal": "molestia principal u objetivo de la sesión, tal como lo dijo",
  "evaStart": "número 0-10 o vacío",
  "evaEnd": "número 0-10 o vacío",
  "interventions": [{"category":"tipo de intervención","detail":"lo que hizo"}],
  "exercises": [{"name":"nombre del ejercicio","dose":"series, repeticiones, carga o tiempo tal como lo dijo"}],
  "educationNotes": "lo que le explicó o indicó, si lo mencionó",
  "responseTolerance": "cómo toleró, si lo mencionó",
  "nextPlan": "qué hará la próxima sesión, si lo mencionó",
  "transcripcion": "la transcripción literal completa"
}

REGLAS ESTRICTAS:
- NO inventes. Si algo no se dijo, deja el campo vacío o el arreglo vacío.
- Las cifras van tal como se dictaron. No redondees ni completes una dosis a medias.
- Si el dolor se menciona una sola vez sin decir si es de entrada o salida, ponlo en evaStart y deja evaEnd vacío.
- Conserva el vocabulario clínico que usó; no lo "mejores".
- La transcripción literal es obligatoria: permite revisar si algo se interpretó mal.`,
      audioData: { data: audioBase64, mimeType: mimeType || 'audio/webm' },
      modelId: 'gemini-2.5-flash',
      temperature: 0,
      responseMimeType: 'application/json',
      maxOutputTokens: 3000,
    });

    let parsed: any = null;
    try {
      const match = String(raw || '').match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(jsonrepair(match[0])) : null;
    } catch {
      parsed = null;
    }

    if (!parsed) {
      return NextResponse.json(
        { success: false, error: 'No se pudo interpretar el dictado. Intenta de nuevo hablando más pausado.' },
        { status: 422 },
      );
    }

    const asText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
    const asScore = (value: unknown) => {
      const number = Number(value);
      return Number.isFinite(number) && number >= 0 && number <= 10 ? String(number) : '';
    };

    return NextResponse.json({
      success: true,
      propuesta: {
        sessionGoal: asText(parsed.sessionGoal),
        evaStart: asScore(parsed.evaStart),
        evaEnd: asScore(parsed.evaEnd),
        interventions: Array.isArray(parsed.interventions)
          ? parsed.interventions
              .filter((item: any) => asText(item?.detail) || asText(item?.category))
              .slice(0, 12)
              .map((item: any) => ({
                category: asText(item.category) || 'Intervención',
                detail: asText(item.detail),
              }))
          : [],
        exercises: Array.isArray(parsed.exercises)
          ? parsed.exercises
              .filter((item: any) => asText(item?.name))
              .slice(0, 15)
              .map((item: any) => ({ name: asText(item.name), dose: asText(item.dose) }))
          : [],
        educationNotes: asText(parsed.educationNotes),
        responseTolerance: asText(parsed.responseTolerance),
        nextPlan: asText(parsed.nextPlan),
      },
      transcripcion: asText(parsed.transcripcion),
    });
  } catch (error: any) {
    console.error('[dictado]', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'No se pudo procesar el dictado.' },
      { status: 500 },
    );
  }
}
