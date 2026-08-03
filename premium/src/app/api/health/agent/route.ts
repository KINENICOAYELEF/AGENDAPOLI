import { getRequestId, apiSuccess, handleApiError } from '@/lib/server/apiResponse';
import { requireTeacher, getAdminDb } from '@/lib/server/firebaseAdmin';
import { ACTIVE_AGENT_VERSION_ID } from '@/lib/agent/client';
import { featureFlags } from '@/lib/agent/config';

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  try {
    const authHeader = req.headers.get('authorization');
    await requireTeacher(authHeader);

    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
    const hasAgentSecret = Boolean(process.env.AGENT_MCP_SECRET);
    const db = getAdminDb();
    const [runSnap, notificationSnap] = await Promise.all([
      db.collection('agent_runs').orderBy('startedAt', 'desc').limit(1).get(),
      db.collection('teacher_notifications').orderBy('createdAt', 'desc').limit(1).get(),
    ]);
    const lastRun = runSnap.empty ? null : { id: runSnap.docs[0].id, ...runSnap.docs[0].data() };
    const lastNotification = notificationSnap.empty ? null : { id: notificationSnap.docs[0].id, ...notificationSnap.docs[0].data() };
    const lastRunAt = new Date((lastRun as any)?.finishedAt || (lastRun as any)?.startedAt || 0).getTime();

    return apiSuccess({
      service: 'antigravity-agent',
      agentVersion: ACTIVE_AGENT_VERSION_ID,
      antigravityApiStatus: hasGeminiKey ? 'configured' : 'missing_api_key',
      mcpSecretStatus: hasAgentSecret ? 'configured' : 'missing_secret',
      featureFlags,
      automation: {
        expectedLocalTimes: ['07:30', '21:30'],
        timezone: 'America/Santiago',
        stale: !lastRunAt || Date.now() - lastRunAt > 16 * 60 * 60 * 1000,
        lastRun,
        lastTelegramNotification: lastNotification,
      },
      timestamp: new Date().toISOString(),
    }, requestId);
  } catch (error: any) {
    return handleApiError(error, requestId);
  }
}
