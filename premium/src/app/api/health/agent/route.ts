import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/server/firebaseAdmin';
import { ACTIVE_AGENT_VERSION_ID } from '@/lib/agent/client';
import { featureFlags } from '@/lib/agent/config';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    await requireTeacher(authHeader);

    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
    const hasAgentSecret = Boolean(process.env.AGENT_MCP_SECRET);

    return NextResponse.json({
      status: 'ok',
      service: 'antigravity-agent',
      agentVersion: ACTIVE_AGENT_VERSION_ID,
      antigravityApiStatus: hasGeminiKey ? 'configured' : 'missing_api_key',
      mcpSecretStatus: hasAgentSecret ? 'configured' : 'missing_secret',
      featureFlags,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status: error.message?.includes('Forbidden') ? 403 : 401 }
    );
  }
}
