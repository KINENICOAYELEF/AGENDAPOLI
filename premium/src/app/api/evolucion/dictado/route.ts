import { NextResponse } from 'next/server';
import { requireAuthenticated } from '@/lib/server/firebaseAdmin';
import { callGeminiCascade } from '@/lib/ai/modelQuotas';
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

/** Valores exactos que acepta el modelo de datos; un texto libre rompe la ficha. */
const INTERVENTION_CATEGORIES = [
  'Educación', 'Terapia manual', 'Modalidades físicas', 'Vendaje/soporte',
  'Exposición/retorno', 'Respiratorio/relajación', 'Otras',
] as const;

const SESSION_STATUSES = ['Realizada', 'No asiste', 'Cancelada', 'Suspendida por mal estado'] as const;

/**
 * El dictado usa la cascada de alto volumen (ver modelQuotas.ts).
 *
 * Los dos primeros modelos rinden 500 peticiones diarias cada uno; los otros
 * dos, 20, y solo están como red de seguridad. Contra las ~42 evoluciones de
 * una jornada de siete internas, sobra cupo de largo.
 *
 * Si un modelo devuelve algo inservible se pasa al siguiente. Eso protege del
 * fallo duro, aunque no de una cifra mal entendida: para eso está la revisión
 * en pantalla antes de aplicar la propuesta.
 */

/**
 * El guion que la estudiante siguió en pantalla mientras dictaba.
 *
 * La grabación es UNA sola y continua: la pantalla solo le va indicando qué
 * contar. Cortar en cinco audios habría costado cinco llamadas por evolución
 * —210 al día para siete internas, sobre un modelo que rinde 200— y además
 * obliga a parar y arrancar cinco veces por paciente.
 *
 * Conocer el orden en que se le pidió hablar permite separar bien las partes
 * aunque venga todo en un mismo audio.
 */
const GUION_DICTADO = [
  'Con qué molestia llegó y cuánto dolor tenía al empezar',
  'Qué le hizo el profesional: terapia manual, educación, vendaje, modalidades',
  'Qué ejercicios hizo y con qué dosis',
  'Cómo quedó al final y qué viene la próxima sesión',
  'Qué necesita saber otro colega para continuar el caso',
];

export async function POST(req: Request) {
  try {
    await requireAuthenticated(req.headers.get('authorization'));

    const body = await req.json().catch(() => ({}));
    const { audioBase64, mimeType, contexto, paso } = body || {};

    if (!audioBase64) {
      return NextResponse.json({ success: false, error: 'No se recibió audio.' }, { status: 400 });
    }

    const prompt = `Escucha el dictado de una sesión de kinesiología y ordénalo en los campos reales de la evolución.

La estudiante dictó de corrido siguiendo este guion en pantalla, en este orden:
${GUION_DICTADO.map((tema, index) => `${index + 1}. ${tema}`).join('\n')}

Puede haberse saltado partes, haberlas mezclado o haber vuelto atrás. Usa el guion como referencia, no como estructura rígida: lo que importa es lo que efectivamente dijo.

${contexto ? `Contexto de la sesión anterior (por si menciona "lo mismo de la vez pasada"):\n${String(contexto).slice(0, 2000)}\n` : ''}
Devuelve SOLO un JSON con esta forma exacta:
{
  "sessionGoal": "molestia principal u objetivo de la sesión, tal como lo dijo",
  "evaStart": "número 0-10 o vacío",
  "evaEnd": "número 0-10 o vacío",
  "interventions": [{
    "category": "Educación|Terapia manual|Modalidades físicas|Vendaje/soporte|Exposición/retorno|Respiratorio/relajación|Otras",
    "subType": "qué técnica concreta",
    "dose": "tiempo o repeticiones si lo dijo",
    "notes": "detalle adicional si lo dijo"
  }],
  "exercises": [{
    "name": "nombre del ejercicio",
    "sets": "número de series si lo dijo",
    "repsOrTime": "repeticiones o tiempo si lo dijo",
    "loadKg": "carga en kilos si la dijo",
    "rest": "descanso si lo dijo",
    "notes": "aclaración si la dijo"
  }],
  "educationNotes": "lo que le explicó o indicó, si lo mencionó",
  "handoffText": "lo que otro colega necesitaría saber para continuar: implementos, adaptaciones, detalles prácticos",
  "nextPlan": "qué hará la próxima sesión o el hito logrado, si lo mencionó",
  "sessionStatus": "Realizada|No asiste|Cancelada|Suspendida por mal estado",
  "transcripcion": "la transcripción literal completa"
}

REGLAS ESTRICTAS:
- NO inventes. Si algo no se dijo, deja el campo vacío o el arreglo vacío.
- "category" debe ser EXACTAMENTE uno de los siete valores listados. Si no calza ninguno, usa "Otras".
- Las cifras van tal como se dictaron, separadas: "tres por doce con ocho kilos" son sets 3, repsOrTime 12, loadKg 8. No las juntes en un solo texto ni completes una dosis a medias.
- Si el dolor se menciona una sola vez sin decir si es de entrada o salida, ponlo en evaStart y deja evaEnd vacío.
- "sessionStatus" es "Realizada" salvo que diga explícitamente que no asistió, se canceló o se suspendió.
- Conserva el vocabulario clínico que usó; no lo "mejores".
- La transcripción literal es obligatoria: permite revisar si algo se interpretó mal.`;

    let raw = '';
    let modeloUsado = '';

    try {
      const respuesta = await callGeminiCascade({
        systemInstruction: 'Eres un asistente de registro clínico kinesiológico en Chile. Transcribes lo que dicta el profesional y lo ordenas en los campos de una evolución. No agregas nada que no se haya dicho.',
        userPrompt: prompt,
        audioData: { data: audioBase64, mimeType: mimeType || 'audio/webm' },
        temperature: 0,
        responseMimeType: 'application/json',
        maxOutputTokens: 3000,
      });
      raw = respuesta.text;
      modeloUsado = respuesta.modelo;
    } catch (cascadaError: any) {
      return NextResponse.json(
        { success: false, error: `No hay ningún modelo disponible para procesar el dictado. ${cascadaError?.message || ''}` },
        { status: 503 },
      );
    }

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
        // La categoría es un enumerado cerrado en el modelo: un valor libre
        // rompería el selector del formulario.
        interventions: Array.isArray(parsed.interventions)
          ? parsed.interventions
              .filter((item: any) => asText(item?.subType) || asText(item?.notes))
              .slice(0, 12)
              .map((item: any) => ({
                category: INTERVENTION_CATEGORIES.includes(asText(item.category) as any)
                  ? asText(item.category)
                  : 'Otras',
                subType: asText(item.subType) || 'Sin especificar',
                dose: asText(item.dose),
                notes: asText(item.notes),
              }))
          : [],
        // Las dosis van separadas porque así las guarda y las muestra la ficha.
        exercises: Array.isArray(parsed.exercises)
          ? parsed.exercises
              .filter((item: any) => asText(item?.name))
              .slice(0, 15)
              .map((item: any) => ({
                name: asText(item.name),
                sets: asText(item.sets),
                repsOrTime: asText(item.repsOrTime),
                loadKg: asText(item.loadKg),
                rest: asText(item.rest),
                notes: asText(item.notes),
              }))
          : [],
        educationNotes: asText(parsed.educationNotes),
        handoffText: asText(parsed.handoffText),
        nextPlan: asText(parsed.nextPlan),
        sessionStatus: SESSION_STATUSES.includes(asText(parsed.sessionStatus) as any)
          ? asText(parsed.sessionStatus)
          : 'Realizada',
      },
      transcripcion: asText(parsed.transcripcion),
      // Útil para saber si el dictado se está resolviendo con el modelo
      // esperado o si ya está cayendo a los de respaldo.
      modelo: modeloUsado,
    });
  } catch (error: any) {
    console.error('[dictado]', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'No se pudo procesar el dictado.' },
      { status: 500 },
    );
  }
}
