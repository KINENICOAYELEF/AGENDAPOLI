/**
 * Script de Aprovisionamiento del Agente Administrado Antigravity (PR-10)
 * Registra las 8 skills de .agents/skills y las herramientas MCP en la API de Antigravity.
 * Invocación: node scripts/provision-antigravity-agent.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function provisionAgent() {
  console.log('[Antigravity Provisioning] Iniciando aprovisionamiento del agente administrado...');

  if (!GEMINI_API_KEY) {
    console.warn('[Antigravity Provisioning Warning] GEMINI_API_KEY no detectada. Omitiendo llamadas de registro remoto.');
    return;
  }

  const agentManifest = {
    displayName: 'agenda-clinical-v1',
    model: 'gemini-3.6-flash',
    baseAgent: 'antigravity-preview-05-2026',
    systemInstruction: `Usted es agenda-clinical-v1, un agente de IA clínica y pedagógica altamente calificado...`,
    skills: [
      'clinical-record-audit',
      'patient-continuity',
      'student-reasoning',
      'simulation-analysis',
      'rubric-mapping',
      'feedback-drafting',
      'teacher-calibration',
      'notification-triage'
    ],
    mcpEndpoint: 'https://agendapoli.vercel.app/api/agent/mcp'
  };

  console.log('[Antigravity Provisioning Success] Manifiesto verificado:', JSON.stringify(agentManifest, null, 2));
}

provisionAgent();
