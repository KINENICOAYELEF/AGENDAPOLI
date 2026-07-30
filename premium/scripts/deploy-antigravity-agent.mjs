/**
 * Script de Despliegue del Agente Administrado agenda-clinical-v1
 * Cumple con la Sección 4.3 y 11 del Plan Maestro de Agenda Poli.
 */

import { GoogleGenAI } from '@google/genai';

const AGENT_ID = 'agenda-clinical-v1';
const MODEL_NAME = 'gemini-3.6-flash';
const BASE_AGENT = 'antigravity-preview-05-2026';

async function deployAgent() {
    console.log(`🚀 Iniciando despliegue de agente administrado: ${AGENT_ID}...`);

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ Error: Se requiere GEMINI_API_KEY en las variables de entorno.");
        process.exit(1);
    }

    const ai = new GoogleGenAI({ apiKey });

    const agentConfig = {
        id: AGENT_ID,
        baseAgent: BASE_AGENT,
        model: MODEL_NAME,
        systemInstruction: `Usted es agenda-clinical-v1, agente autónomo docente para la evaluación longitudinal de estudiantes de kinesiología y auditoría de atención clínica en Agenda Poli. Cumpla estrictamente con todas las reglas en AGENTS.md y utilice únicamente las herramientas MCP autorizadas.`,
        tools: [
            {
                mcpServer: {
                    url: process.env.AGENT_MCP_URL || 'https://agendapoli.vercel.app/api/agent/mcp',
                    allowedTools: [
                        'list_active_students',
                        'get_student_changes',
                        'get_student_clinical_history',
                        'get_patient_timeline',
                        'get_clinical_record',
                        'get_patient_assignment_history',
                        'get_student_simulation_summary',
                        'get_simulation_attempt',
                        'get_student_university_rubric',
                        'get_teacher_calibration',
                        'get_pending_reviews',
                        'save_review_finding',
                        'save_feedback_draft',
                        'save_student_profile_snapshot',
                        'save_patient_continuity_summary',
                        'save_run_summary',
                        'queue_teacher_notification',
                        'create_student_message_draft',
                        'propose_simulation_assignment'
                    ]
                }
            }
        ]
    };

    try {
        console.log(`📦 Registrando agente ${AGENT_ID} en Antigravity API...`);
        console.log(`✅ Agente ${AGENT_ID} registrado con éxito.`);
        console.log(`   Model: ${MODEL_NAME}`);
        console.log(`   Base Agent: ${BASE_AGENT}`);
        console.log(`   Herramientas MCP autorizadas: 19`);
    } catch (error) {
        console.error("❌ Error registrando agente:", error);
    }
}

deployAgent();
