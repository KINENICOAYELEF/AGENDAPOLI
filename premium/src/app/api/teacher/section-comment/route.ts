import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/server/firebaseAdmin';
import { runAgentInteraction } from '@/lib/agent/client';
import { deidentifyText } from '@/lib/agent/deidentify';

/**
 * Redacta el borrador de un comentario sobre UNA sección de la ficha.
 *
 * Es la parte que le quita trabajo al docente: en vez de escribir el comentario
 * desde cero, lee lo que la estudiante puso en esa sección y propone la
 * observación. El docente la edita o la descarta antes de publicarla — este
 * endpoint no escribe nada en ninguna ficha.
 */
export async function POST(req: Request) {
  try {
    await requireTeacher(req.headers.get('authorization'));

    const body = await req.json().catch(() => ({}));
    const { section, content, recordKind, intent } = body || {};

    if (!section || !content) {
      return NextResponse.json({ success: false, error: 'Falta la sección o su contenido.' }, { status: 400 });
    }

    // El comentario terminará visible para la estudiante: el contenido se
    // desidentifica igual que en el resto del agente.
    const safeContent = deidentifyText(
      typeof content === 'string' ? content : JSON.stringify(content),
    ).slice(0, 6000);

    const toneInstruction = intent === 'corregir'
      ? 'Señala con claridad qué está incorrecto o falta, sin ablandarlo. Es una corrección que debe hacer.'
      : intent === 'reforzar'
        ? 'Reconoce lo que hizo bien y explícale por qué está bien, para que lo repita con criterio.'
        : 'Plantea la observación y ayúdala a razonar, sin darle la respuesta hecha.';

    const response = await runAgentInteraction(
      `Eres un kinesiólogo docente comentando UNA sección del registro clínico de tu estudiante de internado.

Sección comentada: "${section}" (de un registro de tipo ${recordKind || 'EVALUACION'}).

Lo que la estudiante escribió en esa sección:
"""
${safeContent}
"""

Escribe un comentario breve dirigido a ella, como una nota al margen.

REGLAS:
- Máximo 60 palabras. Es un comentario, no un informe.
- Español de Chile, tuteando, tono profesional y respetuoso.
- Refiérete SOLO a esta sección. No opines de otras partes que no ves.
- No inventes hallazgos, mediciones ni diagnósticos que no estén en el texto.
- Si el contenido es insuficiente para comentar algo clínico, dilo derechamente: señala qué falta registrar.
- ${toneInstruction}
- No uses encabezados, viñetas ni firma. Solo el texto del comentario.

Responde únicamente con el texto del comentario, sin comillas ni explicaciones.`,
      undefined,
      undefined,
      'short',
    );

    if (response.status !== 'success') {
      return NextResponse.json(
        { success: false, error: (response as any).message || 'El motor de análisis no respondió.' },
        { status: 503 },
      );
    }

    return NextResponse.json({
      success: true,
      draft: String(response.result || '').trim(),
      engine: (response as any).engine || null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Error interno' },
      { status: error?.message?.includes('autoriz') ? 403 : 500 },
    );
  }
}
