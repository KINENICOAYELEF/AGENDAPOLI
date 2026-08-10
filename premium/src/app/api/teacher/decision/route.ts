import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/server/firebaseAdmin';
import { recordTeacherDecision } from '@/lib/agent/teacherCalibration';

/**
 * Registra una decisión del docente sobre un hallazgo.
 *
 * Es lo que permite que el agente deje de proponer aquello que él rechaza
 * sistemáticamente. Nunca debe hacer fallar la acción que la originó: si esto
 * falla, la aprobación o el descarte ya quedaron guardados igual.
 */
export async function POST(req: Request) {
  try {
    await requireTeacher(req.headers.get('authorization'));
    const body = await req.json().catch(() => ({}));

    if (!body?.reviewId || !body?.kind) {
      return NextResponse.json({ success: false, error: 'Faltan datos de la decisión.' }, { status: 400 });
    }

    await recordTeacherDecision({
      reviewId: String(body.reviewId),
      kind: body.kind,
      category: body.category,
      coherenceTypes: Array.isArray(body.coherenceTypes) ? body.coherenceTypes : [],
      priority: body.priority,
      originalLength: body.originalLength,
      finalLength: body.finalLength,
      via: body.via === 'telegram' ? 'telegram' : 'web',
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Error interno' },
      { status: 500 },
    );
  }
}
