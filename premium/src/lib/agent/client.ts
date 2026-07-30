/**
 * Cliente Oficial del Agente Antigravity Administrado (PR 7)
 * Cumple con la Sección 4.3 y 11 del Plan Maestro.
 * Configura agent ID inmutable: agenda-clinical-v2-2026-08
 */

import { agentConfig, featureFlags } from './config';
import { GoogleGenAI } from '@google/genai';
import { deidentifyText } from './deidentify';

export const ACTIVE_AGENT_VERSION_ID = process.env.ANTIGRAVITY_AGENT_ID || 'agenda-clinical-v2-2026-08';

const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export async function runAgentInteraction(prompt: string, context?: any) {
  if (!featureFlags.agentShadowMode && !featureFlags.agentWriteEnabled) {
    console.log('[PR7 Client] Interaction skipped: featureFlags.agentShadowMode & agentWriteEnabled are false.');
    return {
      status: 'skipped',
      message: 'Agente en modo inactivo por feature flags de seguridad (PR0/PR7).',
      agentVersion: ACTIVE_AGENT_VERSION_ID,
    };
  }

  const deidentifiedContext = context ? deidentifyText(JSON.stringify(context)) : '';
  const finalPrompt = `
[Versión Agente: ${ACTIVE_AGENT_VERSION_ID}]
Contexto Clínico Desidentificado:
${deidentifiedContext}

Instrucción de Análisis:
${prompt}
  `;

  try {
    const response = await ai.models.generateContent({
      model: agentConfig.model,
      contents: finalPrompt,
      config: {
        systemInstruction: agentConfig.system_instruction,
      },
    });

    return {
      status: 'success',
      agentVersion: ACTIVE_AGENT_VERSION_ID,
      result: response.text,
    };
  } catch (error: any) {
    console.error('Antigravity Agent execution error:', error);
    return {
      status: 'error',
      agentVersion: ACTIVE_AGENT_VERSION_ID,
      message: error.message || 'Error executing agent interaction',
    };
  }
}

export const runAgent = runAgentInteraction;

