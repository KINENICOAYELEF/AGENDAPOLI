/**
 * Script ejecutor de Cron para la censo y síntesis nocturna del Agente de Antigravity.
 * Invocado por la GitHub Action (.github/workflows/antigravity-super-profile-cron.yml).
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://agendapoli.vercel.app';
const AGENT_SECRET = process.env.AGENT_MCP_SECRET;

function santiagoHour() {
  return Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Santiago', hour: '2-digit', hour12: false,
  }).format(new Date()));
}

const wait = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

async function runCron() {
  console.log(`[Antigravity Cron] Iniciando censo y síntesis nocturna en: ${APP_URL}`);

  if (!AGENT_SECRET) {
    throw new Error('AGENT_MCP_SECRET no está configurado en GitHub Actions.');
  }

  if (process.env.GITHUB_EVENT_NAME === 'schedule' && ![7, 21].includes(santiagoHour())) {
    console.log(`[Antigravity Cron] Ventana DST de respaldo omitida. Hora Santiago: ${santiagoHour()}:30.`);
    return;
  }

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8 * 60 * 1000);
    try {
      const response = await fetch(`${APP_URL}/api/agent/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AGENT_SECRET}`
        },
        body: JSON.stringify({
          prompt: 'Ejecutar censo clínico y actualizar perfiles de aprendizaje de la cohorte',
          triggeredBy: 'cron_github_action',
          sync: true
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP Error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      if (!data.success || data.status !== 'completed') throw new Error(`Respuesta incompleta: ${JSON.stringify(data)}`);
      console.log('[Antigravity Cron Success] Resultado de la ejecución:', JSON.stringify(data, null, 2));
      return;
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;
      console.error(`[Antigravity Cron] Intento ${attempt}/3 falló:`, err.message);
      if (attempt < 3) await wait(attempt * 15000);
    }
  }
  throw lastError;
}

runCron().catch(error => {
  console.error('[Antigravity Cron Error] Fallo definitivo:', error.message);
  process.exit(1);
});
