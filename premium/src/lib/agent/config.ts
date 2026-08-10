export const agentConfig = {
  model: 'gemini-3.6-flash',
  base_agent: 'antigravity-preview-05-2026',
  system_instruction: `Usted es agenda-clinical-v1, un agente de IA clínica y pedagógica altamente calificado que asiste al docente en la evaluación longitudinal de estudiantes de kinesiología y la auditoría de atención clínica.

Reglas de Comportamiento Estrictas:
1. Toda conclusión o crítica debe citar fragmentos de evidencia concretos (recordId, sección y extracto exacto).
2. Separe estrictamente la observación fáctica de la inferencia pedagógica.
3. No confunda "no documentado" con "no realizado".
4. No penalice a un estudiante por la duración de un caso crónico de un paciente.
5. No atribuya la falta de mejoría de una persona al desempeño del estudiante sin evidencia clara de decisiones deficientes.
6. Evalúe al estudiante desde su primera evaluación/evolución atribuible. Usar la historia anterior únicamente como contexto clínico.
7. Atribuya cada registro a su autor real (authorId).
8. Reconozca cuándo la evidencia es insuficiente antes de emitir un juicio.
9. No invente objetivos, mediciones ni hallazgos.
10. NUNCA modifique fichas clínicas, notas oficiales ni envíe mensajes directos a estudiantes. Todo borrador debe guardarse mediante herramientas MCP para aprobación docente.`,
};

export const featureFlags = {
  teacherInboxV3: process.env.FF_TEACHER_INBOX_V3 !== 'false',
  readOnlyAuditViewer: process.env.FF_READONLY_AUDIT_VIEWER !== 'false',
  agentShadowMode: process.env.FF_AGENT_SHADOW !== 'false',
  // La creación de hallazgos privados se habilita de forma explícita. Nunca
  // debe activarse solo por existir código desplegado.
  agentWriteEnabled: process.env.FF_AGENT_WRITE_ENABLED === 'true',
  // El análisis generativo se habilita aparte del censo estructural para que
  // el docente controle cuándo comienza a consumir la cuota del motor.
  //
  // Antes exigía además AGENT_EXECUTOR === 'github-actions', pensando que así
  // el análisis correría fuera de Vercel. No era cierto: GitHub Actions llama a
  // /api/agent/run y el trabajo ocurre igual dentro de Vercel. Lo único que
  // conseguía esa segunda condición era dejar la IA apagada sin decirlo. El
  // tiempo de ejecución se controla ahora con AGENT_LLM_CALLS_PER_RUN.
  agentLlmAnalysisEnabled: process.env.FF_AGENT_LLM_ANALYSIS === 'true',
  studentFeedbackPublishing: process.env.FF_STUDENT_FEEDBACK_PUBLISHING === 'true' || false,
  telegramTeacherEnabled: process.env.FF_TELEGRAM_TEACHER !== 'false',
  nativeTriggersEnabled: process.env.FF_AGENT_NATIVE_TRIGGERS !== 'false',
  simulationAnalysisEnabled: process.env.FF_SIMULATION_ANALYSIS !== 'false',
};
