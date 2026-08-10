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
import { notifyTeacherOfCensus, sendCriticalAlerts, sendDailyRotationDigest } from '@/lib/agent/notificationTriage';

const SCHEDULE_SLOT_PATTERN = /^\d{4}-\d{2}-\d{2}-(morning|evening)$/;
const SCHEDULE_LEASE_MS = 45 * 60 * 1000;

function isAlreadyExistsError(error: any) {
  return error?.code === 6 || error?.code === 'already-exists' || error?.code === 'ALREADY_EXISTS';
}

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
    const { triggeredBy, sync, scheduledSlot } = payload || {};

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

    const normalizedScheduledSlot = triggeredBy === 'cron_github_action'
      && typeof scheduledSlot === 'string'
      && SCHEDULE_SLOT_PATTERN.test(scheduledSlot)
      ? scheduledSlot
      : null;
    const slotRef = normalizedScheduledSlot
      ? db.collection('agent_schedule_slots').doc(normalizedScheduledSlot)
      : null;

    if (slotRef) {
      const nowIso = new Date().toISOString();
      try {
        await slotRef.create({
          slot: normalizedScheduledSlot,
          status: 'running',
          triggeredBy,
          startedAt: nowIso,
          updatedAt: nowIso,
        });
      } catch (slotError: any) {
        if (!isAlreadyExistsError(slotError)) throw slotError;

        const existingSnapshot = await slotRef.get();
        const existing = existingSnapshot.data() || {};
        const startedAtMs = Date.parse(existing.startedAt || '');
        const leaseIsFresh = existing.status === 'running'
          && Number.isFinite(startedAtMs)
          && Date.now() - startedAtMs < SCHEDULE_LEASE_MS;

        if (existing.status === 'completed' || leaseIsFresh) {
          return NextResponse.json({
            success: true,
            status: 'completed',
            deduplicated: true,
            scheduleStatus: existing.status,
            scheduledSlot: normalizedScheduledSlot,
            runId: existing.runId || null,
            agentVersion: ACTIVE_AGENT_VERSION_ID,
          });
        }

        // Permite recuperar un turno fallido o abandonado sin esperar al día siguiente.
        await slotRef.update({
          status: 'running',
          startedAt: nowIso,
          updatedAt: nowIso,
          retryCount: Number(existing.retryCount || 0) + 1,
          errorMessage: null,
        });
      }
    }

    const runRef = await db.collection('agent_runs').add({
      triggeredBy: triggeredBy || 'manual',
      status: 'running',
      startedAt: new Date().toISOString(),
      agentVersion: ACTIVE_AGENT_VERSION_ID,
      promptVersion: 'v2-2026',
      ...(normalizedScheduledSlot ? { scheduledSlot: normalizedScheduledSlot } : {}),
    });
    const runId = runRef.id;
    if (slotRef) {
      await slotRef.update({ runId, updatedAt: new Date().toISOString() });
    }

    // Background execution task wrapper
    const executeBackgroundRun = async () => {
      try {
        const censusResult = await runCensusEngine();
        let notification: unknown;
        try {
          notification = await notifyTeacherOfCensus({
            runId,
            triggeredBy: triggeredBy || 'manual',
            ...censusResult,
          });
        } catch (notificationError: any) {
          // El censo es válido aunque Telegram esté temporalmente caído.
          // El fallo queda trazable sin convertir una revisión clínica en error.
          console.error(`[Telegram Notification Error ${runId}]:`, notificationError);
          notification = { delivered: false, reason: notificationError?.message || 'telegram_delivery_failed' };
        }

        // El riesgo clínico sale primero y por separado: no puede esperar al
        // resumen de la noche ni competir con avisos administrativos.
        try {
          await sendCriticalAlerts();
        } catch (criticalError: any) {
          console.error(`[Critical Alert Error ${runId}]:`, criticalError);
        }

        // Resumen diario de la rotación: se envía una sola vez al día, aunque el
        // cron corra cuatro veces. Su fallo nunca invalida el censo.
        try {
          await sendDailyRotationDigest(new Date().getFullYear().toString());
        } catch (digestError: any) {
          console.error(`[Rotation Digest Error ${runId}]:`, digestError);
        }
        await runRef.update({
          status: 'completed',
          finishedAt: new Date().toISOString(),
          censusResult,
          notification,
        });
        if (slotRef) {
          await slotRef.update({
            status: 'completed',
            runId,
            finishedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (err: any) {
        console.error(`[Background Run Error ${runId}]:`, err);
        await runRef.update({
          status: 'failed',
          finishedAt: new Date().toISOString(),
          errorMessage: err.message || 'Error en ejecución background',
        });
        if (slotRef) {
          await slotRef.update({
            status: 'failed',
            runId,
            finishedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            errorMessage: err.message || 'Error en ejecución background',
          });
        }
        throw err;
      }
    };

    let censusResult: unknown;
    let notification: unknown;

    if (sync) {
      await executeBackgroundRun();
      const completedRun = await runRef.get();
      const completedData = completedRun.data() || {};
      censusResult = completedData.censusResult || null;
      notification = completedData.notification || null;
    } else {
      // Ensure background task completes even after response is sent on Vercel
      after(async () => {
        await executeBackgroundRun().catch((error) => {
          console.error(`[Deferred Background Run Error ${runId}]:`, error);
        });
      });
    }

    return NextResponse.json({
      success: true,
      runId,
      agentVersion: ACTIVE_AGENT_VERSION_ID,
      status: sync ? 'completed' : 'background_triggered',
      ...(normalizedScheduledSlot ? { scheduledSlot: normalizedScheduledSlot } : {}),
      ...(sync ? { censusResult, notification } : {}),
    });
  } catch (error: any) {
    console.error('Error triggering background agent run:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
