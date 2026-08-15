import { callGemini } from './geminiClient';

/**
 * CUOTAS REALES DE ESTA API KEY (proyecto "agenda poli", nivel gratuito).
 *
 * Verificadas en el panel de Google AI Studio → Límite de frecuencia,
 * agosto 2026. Antes había supuestos repartidos por el código —el peor era
 * creer que Gemini 2.5 Flash rendía 200 peticiones diarias— y eso llevó a
 * poner un modelo de 20/día al frente de las tareas de mayor volumen.
 *
 * El resumen que importa: SOLO DOS modelos de texto tienen cupo de verdad.
 * Todo el resto rinde 20 peticiones diarias, que es media mañana de trabajo.
 *
 *   gemini-3.5-flash-lite ..... 500/día   15/min    ← caballo de batalla
 *   gemini-3.1-flash-lite ..... 500/día   15/min    ← caballo de batalla
 *   gemini-2.5-flash-lite ........ 20/día 10/min
 *   gemini-2.5-flash ............. 20/día  5/min
 *   gemini-3-flash ............... 20/día  5/min
 *   gemini-3.5-flash ............. 20/día  5/min
 *   gemini-3.6-flash ............. 20/día  5/min
 *   gemini-3.7-flash ............. 20/día  5/min
 *   Antigravity ................. 100/día  3/min
 *   API en vivo (Live) ....... ilimitado
 *   TTS .......................... 10/día
 *
 * Regla práctica para no volver a equivocarse: si una tarea la puede disparar
 * una estudiante varias veces al día, tiene que empezar por un Lite. Los
 * modelos de 20/día solo sirven donde las llamadas se cuentan con los dedos
 * —el análisis clínico del agente— o como último respaldo.
 */
export const MODEL_RPD: Record<string, number> = {
  'gemini-3.5-flash-lite': 500,
  'gemini-3.1-flash-lite': 500,
  'gemini-3.1-flash-lite-preview': 500,
  'gemini-2.5-flash-lite': 20,
  'gemini-2.5-flash': 20,
  'gemini-3-flash': 20,
  'gemini-3-flash-preview': 20,
  'gemini-3.5-flash': 20,
  'gemini-3.6-flash': 20,
  'gemini-3.7-flash': 20,
};

/**
 * Cascada para tareas de alto volumen: dictado, transcripción, respuestas del
 * bot. Los dos primeros suman 1.000 peticiones diarias; los dos últimos son
 * red de seguridad para el día en que algo raro pase con los Lite.
 */
export const HIGH_VOLUME_CASCADE = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
];

type CascadaParams = Omit<Parameters<typeof callGemini>[0], 'modelId'>;

/**
 * Llama a Gemini recorriendo una cascada de modelos hasta que uno responda.
 *
 * Existe porque el patrón estaba copiado a mano en cuatro archivos, cada uno
 * con su propia lista de modelos y su propia idea de las cuotas. Cuando las
 * cuotas cambian —y cambian— hay que poder corregirlas en un solo lugar.
 *
 * Devuelve además con qué modelo se resolvió, para saber si una función está
 * viviendo permanentemente del respaldo.
 */
export async function callGeminiCascade(
  params: CascadaParams,
  models: string[] = HIGH_VOLUME_CASCADE,
): Promise<{ text: string; modelo: string }> {
  let ultimoError = '';

  for (const modelId of models) {
    try {
      const text = await callGemini({ ...params, modelId });
      if (text?.trim()) return { text, modelo: modelId };
      ultimoError = `${modelId} devolvió una respuesta vacía`;
    } catch (error: any) {
      ultimoError = `${modelId}: ${String(error?.message || error).slice(0, 120)}`;
      console.warn('[cascada IA] modelo no disponible', ultimoError);
    }
  }

  throw new Error(`Ningún modelo disponible. ${ultimoError}`);
}
