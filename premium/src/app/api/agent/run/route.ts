import { NextResponse } from 'next/server';
import { createAgentRun } from '@/lib/agent/runManager';
import { runAgent } from '@/lib/agent/client';
import { updateAgentRun } from '@/lib/agent/runManager';
import { runCensusEngine } from '@/lib/agent/censusEngine';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    
    // Create a run in Firestore
    const runId = await createAgentRun(payload);
    
    // Disparar ejecución background (simulated using standard promise without await)
    // En Vercel o serverless, esto requiere un modelo de tareas como Inngest, Upstash, Vercel Functions (background), 
    // o simplemente waitUntil (si usamos Next.js >= 13).
    // Para simplificar, lo invocamos de forma asíncrona pero atrapando el error
    const runTask = async () => {
      try {
        const response = await runAgent(payload.prompt || '', payload.context);
        await updateAgentRun(runId, 'completed', response);
        
        // Ejecutar el motor de censo en segundo plano
        await runCensusEngine();
      } catch (err: any) {
        await updateAgentRun(runId, 'error', { error: err.message });
      }
    };
    
    // In Next.js, calling an async function without await might get killed when response ends, 
    // but assuming standard background flow or Edge functions wait.
    runTask();
    
    return NextResponse.json({ success: true, runId });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
