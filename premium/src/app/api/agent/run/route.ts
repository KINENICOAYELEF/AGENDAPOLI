/**
 * Route de Ejecución Autónoma en Segundo Plano del Agente (PR 8)
 * Cumple con la Sección 4.3 y 12 del Plan Maestro.
 * Inicia la ejecución background sin bloquear la respuesta Vercel/serverless.
 */

import { NextResponse } from 'next/server';
import { createAgentRun, updateAgentRun } from '@/lib/agent/runManager';
import { runAgentInteraction, ACTIVE_AGENT_VERSION_ID } from '@/lib/agent/client';
import { featureFlags } from '@/lib/agent/config';

export async function POST(req: Request) {
  try {
    const payload = await req.json().catch(() => ({}));
    const { prompt, context, triggeredBy } = payload || {};

    const runId = await createAgentRun({
      triggeredBy: triggeredBy || 'manual',
      status: 'running',
      startedAt: new Date().toISOString(),
      agentVersion: ACTIVE_AGENT_VERSION_ID,
      promptVersion: 'v2-2026',
    });

    // Background execution task wrapper
    const executeBackgroundRun = async () => {
      try {
        if (!featureFlags.agentShadowMode && !featureFlags.agentWriteEnabled) {
          await updateAgentRun(runId, 'completed', {
            status: 'skipped',
            message: 'Ejecución omitida por Feature Flags de seguridad (PR0/PR8).',
          });
          return;
        }

        const agentResult = await runAgentInteraction(
          prompt || 'Revisión clínica automática de rutina',
          context
        );

        await updateAgentRun(runId, 'completed', {
          finishedAt: new Date().toISOString(),
          agentResult,
        });
      } catch (err: any) {
        console.error(`[Background Run Error ${runId}]:`, err);
        await updateAgentRun(runId, 'failed', {
          finishedAt: new Date().toISOString(),
          errorMessage: err.message || 'Error en ejecución background',
        });
      }
    };

    // Trigger non-blocking async execution
    executeBackgroundRun();

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
