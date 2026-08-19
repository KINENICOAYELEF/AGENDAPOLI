import { NextResponse } from 'next/server';
import { jsonrepair } from 'jsonrepair';
import { callGeminiCascade } from '@/lib/ai/modelQuotas';
import { requireWorkshopStaff } from '@/lib/server/adultoMayor';

export const maxDuration = 120;

const asText = (value: unknown, max = 5000) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export async function POST(req: Request) {
  try {
    await requireWorkshopStaff(req.headers.get('authorization'));
    const body = await req.json().catch(() => ({}));
    const audioBase64 = asText(body?.audioBase64, 25_000_000);
    const mimeType = asText(body?.mimeType, 100) || 'audio/webm';
    if (!audioBase64) return NextResponse.json({ ok: false, error: 'No se recibió audio.' }, { status: 400 });

    const response = await callGeminiCascade({
      systemInstruction: 'Transcribes y estructuras registros grupales de un taller de ejercicio para personas mayores. No inventas información ni agregas inferencias clínicas.',
      userPrompt: `Escucha este registro dictado después de un Taller de Adulto Mayor. Ordena únicamente lo dicho.

Devuelve SOLO JSON válido:
{
  "summary": "síntesis breve del taller",
  "activities": "actividades realizadas",
  "dosage": "duración, series, repeticiones, descansos o intensidad mencionada",
  "adaptations": "variantes, apoyos o modificaciones realizadas",
  "groupResponse": "respuesta general, tolerancia y participación observada",
  "incidents": "síntomas, eventos o incidentes; vacío si no fueron mencionados",
  "nextPlan": "qué se propone para la próxima sesión; vacío si no fue mencionado",
  "transcription": "transcripción completa"
}

Reglas:
- No inventes dosis, incidentes ni respuestas.
- No conviertas el registro grupal en una evolución individual.
- Conserva nombres solo si fueron dictados; no deduzcas identidades.
- Si una sección no fue mencionada, déjala vacía.`,
      audioData: { data: audioBase64, mimeType },
      temperature: 0,
      responseMimeType: 'application/json',
      maxOutputTokens: 3500,
    });

    const match = String(response.text || '').match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(jsonrepair(match[0])) : null;
    if (!parsed) return NextResponse.json({ ok: false, error: 'No se pudo interpretar el audio.' }, { status: 422 });

    return NextResponse.json({
      ok: true,
      data: {
        summary: asText(parsed.summary, 2500),
        activities: asText(parsed.activities, 3000),
        dosage: asText(parsed.dosage, 2000),
        adaptations: asText(parsed.adaptations, 2000),
        groupResponse: asText(parsed.groupResponse, 2000),
        incidents: asText(parsed.incidents, 2000),
        nextPlan: asText(parsed.nextPlan, 2000),
        transcription: asText(parsed.transcription, 8000),
        model: response.modelo,
      },
    });
  } catch (error: any) {
    console.error('[adulto-mayor/transcribe]', error);
    const message = error?.message || 'No se pudo procesar el audio.';
    const status = message.includes('Unauthorized') ? 401 : message.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

