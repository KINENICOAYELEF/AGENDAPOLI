/**
 * Script ejecutor de Cron para la censo y síntesis nocturna del Agente de Antigravity.
 * Invocado por la GitHub Action (.github/workflows/antigravity-super-profile-cron.yml).
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://agendapoli.vercel.app';
const AGENT_SECRET = process.env.AGENT_MCP_SECRET || process.env.GEMINI_API_KEY;

async function runCron() {
  console.log(`[Antigravity Cron] Iniciando censo y síntesis nocturna en: ${APP_URL}`);

  if (!AGENT_SECRET) {
    console.warn(`[Antigravity Cron Warning] AGENT_MCP_SECRET / GEMINI_API_KEY no detectados. Verifique secretos en GitHub.`);
  }

  try {
    const response = await fetch(`${APP_URL}/api/agent/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AGENT_SECRET || ''}`
      },
      body: JSON.stringify({
        prompt: 'Ejecutar censo clínico nocturno y actualizar perfiles de aprendizaje de la cohorte',
        triggeredBy: 'cron_github_action',
        sync: true
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP Error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    console.log('[Antigravity Cron Success] Resultado de la ejecución:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[Antigravity Cron Error] Fallo en la llamada:', err.message);
    process.exit(1);
  }
}

runCron();
