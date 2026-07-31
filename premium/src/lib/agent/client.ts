/**
 * Cliente Oficial del Agente Antigravity Administrado (PR 7)
 * Cumple con la Sección 4.3 y 11 del Plan Maestro.
 * Configura agent ID inmutable: agenda-clinical-v2-2026-08
 */

import { agentConfig, featureFlags } from './config';
import { callAntigravityAgent } from '@/lib/ai/antigravityClient';
import { deidentifyText } from './deidentify';

// El identificador enviado a Google debe ser el agente publicado, no un alias
// interno de la plataforma. El alias puede conservarse en los metadatos del run.
export const ACTIVE_AGENT_VERSION_ID =
  process.env.ANTIGRAVITY_AGENT_ID || agentConfig.base_agent;

export async function runAgentInteraction(prompt: string, context?: any, teacherCalibration?: { preferredTone?: string }) {
  if (!featureFlags.agentShadowMode && !featureFlags.agentWriteEnabled) {
    console.log('[PR7 Client] Interaction skipped: featureFlags.agentShadowMode & agentWriteEnabled are false.');
    return {
      status: 'skipped',
      message: 'Agente en modo inactivo por feature flags de seguridad (PR0/PR7).',
      agentVersion: ACTIVE_AGENT_VERSION_ID,
    };
  }

  const toneInstruction = teacherCalibration?.preferredTone
    ? `\nPreferencias del Docente: Utilizar un tono ${teacherCalibration.preferredTone} y conciso.`
    : '';

  const deidentifiedContext = context ? deidentifyText(JSON.stringify(context)) : '';
  const finalPrompt = `
[Versión Agente: ${ACTIVE_AGENT_VERSION_ID}]${toneInstruction}
Contexto Clínico Desidentificado:
${deidentifiedContext}

Instrucción de Análisis:
${prompt}
  `;

  try {
    const interaction = await callAntigravityAgent({
      agent: ACTIVE_AGENT_VERSION_ID,
      systemInstruction: agentConfig.system_instruction,
      prompt: finalPrompt,
    });

    return {
      status: 'success',
      agentVersion: ACTIVE_AGENT_VERSION_ID,
      interactionId: interaction.id,
      result: interaction.textOutput,
      thoughts: interaction.thoughts,
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
