import { NextResponse } from 'next/server';
import { updateAgentRun } from '@/lib/agent/runManager';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { runId, status, result } = payload;
    
    if (!runId || !status) {
      return NextResponse.json({ error: 'runId and status are required' }, { status: 400 });
    }
    
    await updateAgentRun(runId, status, result);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
