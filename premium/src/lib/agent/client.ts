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
 * Cascadas de respaldo según lo que exige cada tarea.
 *
 * Las cuotas reales de esta API key están documentadas en un solo lugar:
 * src/lib/ai/modelQuotas.ts. Lo único que hay que recordar aquí es que SOLO
 * los dos Flash Lite rinden 500 peticiones diarias; todo el resto rinde 20.
 *
 * Usar una sola cascada global gastaba los modelos buenos en tareas triviales
 * —como elegir qué consulta ejecutar— y dejaba sin cupo al análisis clínico,
 * que es lo único que de verdad necesita capacidad de razonamiento.
 */
export type AgentTaskKind = 'deep' | 'routing' | 'conversational' | 'short';

const FALLBACK_BY_TASK: Record<AgentTaskKind, string[]> = {
  // Análisis longitudinal y coherencia clínica: son tres o cuatro llamadas al
  // día y cada una vale mucho. Aquí sí corresponde gastar los modelos de mayor
  // capacidad, que entre los cuatro suman 80 intentos diarios.
  deep: ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3-flash', 'gemini-2.5-flash', 'gemini-3.5-flash-lite'],

  // Elegir el nombre de una consulta no requiere razonamiento clínico. Va
  // directo a los modelos de 500/día para no tocar la cuota escasa.
  routing: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'],

  // Responder al docente con datos ya consultados: es la tarea de mayor volumen
  // del día. Antes encabezaba gemini-2.5-flash creyendo que rendía 200 diarias;
  // rinde 20. Después de la respuesta número 20 el bot pagaba una llamada
  // fallida antes de cada contestación. Ahora encabeza un Lite de 500.
  conversational: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'],

  // Comentarios de una sección: texto corto y acotado, pero se escriben muchos
  // en una misma sesión de revisión. Misma lógica que el conversacional.
  short: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'],
};

// El identificador enviado a Google debe ser el agente publicado, no un alias
// interno de la plataforma. El alias puede conservarse en los metadatos del run.
export const ACTIVE_AGENT_VERSION_ID =
  process.env.ANTIGRAVITY_AGENT_ID || agentConfig.base_agent;

export async function runAgentInteraction(
  prompt: string,
  context?: any,
  teacherCalibration?: { preferredTone?: string },
  // Por defecto 'deep' para no cambiar el comportamiento de quien no lo declare.
  task: AgentTaskKind = 'deep',
) {
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

  // Antigravity rinde 100 peticiones diarias: se reservan para el análisis
  // clínico. Gastarlas enrutando preguntas del chat dejaría el censo sin motor.
  if (task === 'deep') {
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
  }

  for (const model of FALLBACK_BY_TASK[task]) {
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
