import { NextResponse } from 'next/server';
import { getAgentRun } from '@/lib/agent/runManager';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const runId = searchParams.get('runId');
    
    if (!runId) {
      return NextResponse.json({ error: 'runId is required' }, { status: 400 });
    }
    
    const runData = await getAgentRun(runId);
    if (!runData) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, run: runData });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
