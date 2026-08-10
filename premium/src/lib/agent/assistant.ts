/**
 * ASISTENTE CONVERSACIONAL DOCENTE
 *
 * Convierte al bot de un menú de botones en algo con lo que se puede hablar.
 *
 * El flujo es de dos pasos a propósito, en vez de function-calling nativo:
 *   1. Un modelo decide QUÉ consulta hace falta y con qué argumentos.
 *   2. Se ejecuta esa consulta contra Firestore.
 *   3. Un modelo redacta la respuesta usando SOLO esos datos.
 *
 * Dos pasos son más fáciles de depurar y funcionan igual con la cascada de
 * modelos de respaldo que ya existe. Además, el paso intermedio queda
 * registrado: si el bot responde mal, se puede ver qué consultó.
 */

import { runAgentInteraction } from './client';
import {
  censoAsignaciones,
  estadoAgenda,
  estadoRotaciones,
  fichaEstudiante,
  fichaPersona,
  personasAbandonadas,
} from './clinicalQueries';
import { buildRotationSummary } from './rotationSummary';
import { getRecentPendingReviewSummary } from './notificationTriage';

type ToolPlan = { tool: string; args: Record<string, string> };

const TOOL_CATALOG = `
- censo_asignaciones(estudiante?): qué personas tiene asignadas cada interna, con su motivo de ingreso, diagnóstico vigente, objetivos activos, última sesión y las incoherencias que el agente detectó. Si se omite "estudiante", devuelve toda la rotación. ÚSALA cuando pregunten qué pacientes tiene alguien, qué está haciendo con ellos, o cómo va su coherencia clínica.
- ficha_estudiante(estudiante): actividad total de una interna, borradores sin firmar, simulaciones contra el mínimo de 15, hallazgos e incoherencias.
- ficha_persona(persona): una persona atendida — quién la ve, diagnóstico vigente, cuántas sesiones lleva y cuándo fue la última.
- estado_agenda(fecha?): citas del día, cuántas se completaron, cuáles siguen sin evolucionar. Fecha en formato AAAA-MM-DD; si se omite, hoy.
- personas_abandonadas(dias?): procesos activos sin sesión hace al menos N días (por defecto 14).
- estado_rotaciones(): rotaciones configuradas y cuántos días les quedan.
- resumen_rotacion(): quién trabajó, quién está en silencio, borradores sin firmar y evaluaciones incompletas.
- hallazgos_pendientes(): cuántos hallazgos esperan decisión docente, por prioridad.
`.trim();

async function runTool(plan: ToolPlan, year: string): Promise<unknown> {
  const args = plan.args || {};
  switch (plan.tool) {
    case 'censo_asignaciones':
      return censoAsignaciones(year, args.estudiante || undefined);
    case 'ficha_estudiante':
      return fichaEstudiante(year, args.estudiante || '');
    case 'ficha_persona':
      return fichaPersona(year, args.persona || '');
    case 'estado_agenda':
      return estadoAgenda(year, args.fecha || undefined);
    case 'personas_abandonadas':
      return personasAbandonadas(year, Number(args.dias) || 14);
    case 'estado_rotaciones':
      return estadoRotaciones(year);
    case 'resumen_rotacion':
      return buildRotationSummary(year, 7);
    case 'hallazgos_pendientes':
      return getRecentPendingReviewSummary();
    default:
      return { error: `No existe una consulta llamada "${plan.tool}".` };
  }
}

function parsePlan(raw: string): ToolPlan | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    if (!parsed?.tool || typeof parsed.tool !== 'string') return null;
    return { tool: parsed.tool, args: parsed.args || {} };
  } catch {
    return null;
  }
}

export type AssistantAnswer = {
  text: string;
  toolUsed?: string;
  toolArgs?: Record<string, string>;
  failed?: boolean;
};

/**
 * Responde una pregunta libre del docente con datos reales.
 *
 * `year` acota todas las consultas al año académico en curso, igual que el
 * resto de la plataforma.
 */
export async function answerTeacherQuestion(question: string, year: string): Promise<AssistantAnswer> {
  // ── Paso 1: decidir qué consultar ────────────────────────────────────────
  const planResponse = await runAgentInteraction(
    `Eres el enrutador de un asistente docente de un internado de kinesiología. Tu única tarea es elegir QUÉ consulta ejecutar para responder la pregunta del docente.

Consultas disponibles:
${TOOL_CATALOG}

Pregunta del docente: "${question}"

Responde SOLO un JSON con esta forma exacta, sin texto adicional:
{"tool":"nombre_de_la_consulta","args":{"clave":"valor"}}

Si la pregunta menciona a una persona por su nombre, ponlo tal cual en el argumento correspondiente. Si ninguna consulta encaja, usa {"tool":"resumen_rotacion","args":{}}.`,
  );

  if (planResponse.status !== 'success') {
    return {
      text: 'No pude consultar la base de datos en este momento. Intenta de nuevo en unos minutos o usa los botones del menú.',
      failed: true,
    };
  }

  const plan = parsePlan(planResponse.result || '') || { tool: 'resumen_rotacion', args: {} };

  // ── Paso 2: ejecutar la consulta ─────────────────────────────────────────
  let data: unknown;
  try {
    data = await runTool(plan, year);
  } catch (error: any) {
    console.error('[Asistente] Falló la consulta', plan.tool, error);
    return {
      text: `Quise revisar "${plan.tool}" pero la consulta falló. Reintenta en unos minutos.`,
      toolUsed: plan.tool,
      failed: true,
    };
  }

  // ── Paso 3: redactar la respuesta con esos datos y nada más ──────────────
  const answerResponse = await runAgentInteraction(
    `Eres el asistente de un kinesiólogo docente a cargo de un internado clínico. Responde su pregunta usando EXCLUSIVAMENTE los datos entregados.

REGLAS:
- No inventes nombres, cifras, diagnósticos ni fechas. Si el dato no está, dilo: "no está registrado".
- Responde en español de Chile, directo y breve. Máximo 250 palabras.
- Si los datos revelan algo que él debería atender (alguien sin actividad, una persona abandonada, incoherencias repetidas, borradores acumulados), señálalo aunque no lo haya preguntado.
- No uses encabezados ni tablas: es un mensaje de chat. Puedes usar viñetas simples con "•".
- Nunca sugieras contactar a la estudiante directamente: él decide eso.

Pregunta: "${question}"

Datos consultados (${plan.tool}):
${JSON.stringify(data).slice(0, 24000)}`,
  );

  if (answerResponse.status !== 'success') {
    return {
      text: 'Encontré los datos pero no pude redactar la respuesta. Reintenta en unos minutos.',
      toolUsed: plan.tool,
      toolArgs: plan.args,
      failed: true,
    };
  }

  return {
    text: answerResponse.result || 'Sin respuesta.',
    toolUsed: plan.tool,
    toolArgs: plan.args,
  };
}
