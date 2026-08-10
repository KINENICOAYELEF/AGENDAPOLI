/**
 * Cliente Oficial del Agente Antigravity Administrado (PR 7)
 * Cumple con la Sección 4.3 y 11 del Plan Maestro.
 * Configura agent ID inmutable: agenda-clinical-v2-2026-08
 */

import { agentConfig, featureFlags } from './config';
import { callAntigravityAgent } from '@/lib/ai/antigravityClient';
import { callGemini } from '@/lib/ai/geminiClient';
import { deidentifyText } from './deidentify';

/**
 * Modelos de respaldo, del más capaz al más disponible.
 *
 * Antigravity es preview y su cuota se agota: cuando fallaba, el censo entero
 * terminaba "exitoso" sin haber analizado nada, y nadie se enteraba. Bajar por
 * esta escalera convierte una caída total en una degradación anunciada.
 */
const FALLBACK_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
];

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

  let engineNote = '';

  try {
    const interaction = await callAntigravityAgent({
      agent: ACTIVE_AGENT_VERSION_ID,
      systemInstruction: agentConfig.system_instruction,
      prompt: finalPrompt,
    });

    if (!interaction.textOutput?.trim()) {
      throw new Error('Antigravity respondió sin texto utilizable.');
    }

    return {
      status: 'success',
      agentVersion: ACTIVE_AGENT_VERSION_ID,
      engine: 'antigravity',
      model: ACTIVE_AGENT_VERSION_ID,
      interactionId: interaction.id,
      result: interaction.textOutput,
      thoughts: interaction.thoughts,
    };
  } catch (error: any) {
    // El motivo del fallo viaja en la respuesta y termina en el resumen del
    // censo y en Telegram: un Antigravity caído deja de disfrazarse de "todo
    // en orden" y se ve como lo que es.
    engineNote = `Antigravity falló (${String(error?.message || error).slice(0, 160)})`;
    console.warn('[Agente]', engineNote);
  }

  for (const model of FALLBACK_MODELS) {
    try {
      const text = await callGemini({
        systemInstruction: agentConfig.system_instruction,
        userPrompt: finalPrompt,
        modelId: model,
        temperature: 0.2,
        responseMimeType: 'application/json',
        maxOutputTokens: 8192,
      });
      if (!text?.trim()) throw new Error('Respuesta vacía.');

      return {
        status: 'success',
        agentVersion: ACTIVE_AGENT_VERSION_ID,
        engine: 'gemini',
        model,
        result: text,
        engineNote: `${engineNote} — se analizó con ${model} de respaldo`,
      };
    } catch (error: any) {
      // Cuota agotada o modelo no disponible: probamos el siguiente.
      console.warn(`[Agente] Respaldo ${model} no disponible:`, error?.message || error);
      engineNote = `${engineNote}; ${model}: ${String(error?.message || error).slice(0, 80)}`;
    }
  }

  return {
    status: 'error',
    agentVersion: ACTIVE_AGENT_VERSION_ID,
    message: engineNote || 'Ningún motor de análisis quedó disponible.',
  };
}

export const runAgent = runAgentInteraction;
