import { NextResponse } from 'next/server';
import { getAdminDb, requireTeacher } from '@/lib/server/firebaseAdmin';
import { featureFlags } from '@/lib/agent/config';
import { analyzeNextStudent } from '@/lib/agent/analyzeNext';

/**
 * Analiza a UNA estudiante por llamada.
 *
 * El censo hacía todo el trabajo dentro de una sola petición y la plataforma lo
 * cortaba por tiempo: solo alcanzaba a analizar tres de siete, y el resto
 * quedaba para la corrida siguiente sin garantía de llegar nunca.
 *
 * Partirlo en unidades permite que quien orquesta —GitHub Actions, que no tiene
 * límite de tiempo— repita la llamada hasta cubrir la rotación completa. Cada
 * llamada por separado cabe holgadamente en el límite de la función.
 */
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const secret = process.env.AGENT_MCP_SECRET;
    const token = authHeader ? authHeader.replace('Bearer ', '') : '';
    if (!secret || token !== secret) {
      await requireTeacher(authHeader);
    }

    if (!featureFlags.agentWriteEnabled) {
      return NextResponse.json(
        { success: false, error: 'El censo está deshabilitado por configuración.' },
        { status: 409 },
      );
    }
    if (!featureFlags.agentLlmAnalysisEnabled) {
      return NextResponse.json({
        success: true,
        analyzed: null,
        remaining: 0,
        reason: 'El análisis de razonamiento clínico está desactivado (FF_AGENT_LLM_ANALYSIS).',
      });
    }

    const result = await analyzeNextStudent(new Date().getFullYear().toString());

    // Registrar cada paso permite reconstruir qué pasó una noche concreta.
    try {
      await getAdminDb().collection('agent_runs').add({
        triggeredBy: 'analyze_next',
        status: result.analyzed ? 'completed' : 'idle',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        analyzedStudent: result.analyzed || null,
        remaining: result.remaining,
      });
    } catch { /* el análisis ya se hizo; el registro es secundario */ }

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[analyze-next]', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error interno' },
      { status: 500 },
    );
  }
}
