/**
 * Route de Ejecución Autónoma en Segundo Plano del Agente (PR 8)
 * Cumple con la Sección 4.3 y 12 del Plan Maestro.
 * Inicia la ejecución background sin bloquear la respuesta Vercel/serverless.
 */

import { NextResponse, after } from 'next/server';
import { ACTIVE_AGENT_VERSION_ID } from '@/lib/agent/client';
import { featureFlags } from '@/lib/agent/config';
import { requireTeacher } from '@/lib/server/firebaseAdmin';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { runCensusEngine } from '@/lib/agent/censusEngine';
import { notifyTeacherOfCensus } from '@/lib/agent/notificationTriage';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const secret = process.env.AGENT_MCP_SECRET;
    const token = authHeader ? authHeader.replace('Bearer ', '') : '';

    if (!secret || token !== secret) {
      // If not matching agent secret, require valid teacher token
      await requireTeacher(authHeader);
    }

    const payload = await req.json().catch(() => ({}));
    const { triggeredBy, sync } = payload || {};

    if (!featureFlags.agentWriteEnabled) {
      return NextResponse.json(
        {
          success: false,
          code: 'AGENT_CENSUS_DISABLED',
          error: 'El censo está deshabilitado por seguridad. Configura FF_AGENT_WRITE_ENABLED=true cuando la credencial Firebase Admin esté instalada.',
        },
        { status: 409 },
      );
    }

    const db = getAdminDb();

    const runRef = await db.collection('agent_runs').add({
      triggeredBy: triggeredBy || 'manual',
      status: 'running',
      startedAt: new Date().toISOString(),
      agentVersion: ACTIVE_AGENT_VERSION_ID,
      promptVersion: 'v2-2026',
    });
    const runId = runRef.id;

    // Background execution task wrapper
    const executeBackgroundRun = async () => {
      try {
        const censusResult = await runCensusEngine();
        const notification = await notifyTeacherOfCensus({
          runId,
          triggeredBy: triggeredBy || 'manual',
          ...censusResult,
        });
        await runRef.update({
          status: 'completed',
          finishedAt: new Date().toISOString(),
          censusResult,
          notification,
        });
      } catch (err: any) {
        console.error(`[Background Run Error ${runId}]:`, err);
        await runRef.update({
          status: 'failed',
          finishedAt: new Date().toISOString(),
          errorMessage: err.message || 'Error en ejecución background',
        });
      }
    };

    if (sync) {
      await executeBackgroundRun();
    } else {
      // Ensure background task completes even after response is sent on Vercel
      after(executeBackgroundRun);
    }

    return NextResponse.json({
      success: true,
      runId,
      agentVersion: ACTIVE_AGENT_VERSION_ID,
      status: 'background_triggered',
    });
  } catch (error: any) {
    console.error('Error triggering background agent run:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
