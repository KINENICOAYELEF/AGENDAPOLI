import { getRequestId, apiSuccess, handleApiError } from '@/lib/server/apiResponse';
import { requireTeacher } from '@/lib/server/firebaseAdmin';
import { ACTIVE_AGENT_VERSION_ID } from '@/lib/agent/client';
import { featureFlags } from '@/lib/agent/config';

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  try {
    const authHeader = req.headers.get('authorization');
    await requireTeacher(authHeader);

    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
    const hasAgentSecret = Boolean(process.env.AGENT_MCP_SECRET);

    return apiSuccess({
      service: 'antigravity-agent',
      agentVersion: ACTIVE_AGENT_VERSION_ID,
      antigravityApiStatus: hasGeminiKey ? 'configured' : 'missing_api_key',
      mcpSecretStatus: hasAgentSecret ? 'configured' : 'missing_secret',
      featureFlags,
      timestamp: new Date().toISOString(),
    }, requestId);
  } catch (error: any) {
    return handleApiError(error, requestId);
  }
}
