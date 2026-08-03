/**
 * Script ejecutor de Cron para la censo y síntesis nocturna del Agente de Antigravity.
 * Invocado por la GitHub Action (.github/workflows/antigravity-super-profile-cron.yml).
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://agendapoli.vercel.app';
const AGENT_SECRET = process.env.AGENT_MCP_SECRET;

function santiagoDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function previousIsoDate(isoDate) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function scheduledSlot() {
  if (process.env.GITHUB_EVENT_NAME !== 'schedule') return null;

  const { year, month, day, hour } = santiagoDateParts();
  const localDate = `${year}-${month}-${day}`;
  const localHour = Number(hour);
  const expression = process.env.GITHUB_EVENT_SCHEDULE || '';
  const isMorningExpression = expression.includes('30 10 ') || expression.includes('30 11 ');
  const period = isMorningExpression ? 'morning' : 'evening';

  // Una ejecución nocturna puede ser iniciada con retraso después de medianoche.
  const slotDate = period === 'evening' && localHour < 6
    ? previousIsoDate(localDate)
    : localDate;
  return `${slotDate}-${period}`;
}

function shouldSkipEarlyFallback() {
  if (process.env.GITHUB_EVENT_NAME !== 'schedule') return false;
  const { hour } = santiagoDateParts();
  const localHour = Number(hour);
  const expression = process.env.GITHUB_EVENT_SCHEDULE || '';
  const isMorningExpression = expression.includes('30 10 ') || expression.includes('30 11 ');

  // Del par invierno/verano, el respaldo que cae antes de la hora objetivo se
  // omite. Una ejecución tardía sí se acepta y queda deduplicada por turno.
  return isMorningExpression
    ? localHour >= 5 && localHour < 7
    : localHour >= 6 && localHour < 21;
}

const wait = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

function isNonRetryableQuotaError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('resource_exhausted') || message.includes('quota exceeded');
}

async function runCron() {
  console.log(`[Antigravity Cron] Iniciando censo y síntesis nocturna en: ${APP_URL}`);

  if (!AGENT_SECRET) {
    throw new Error('AGENT_MCP_SECRET no está configurado en GitHub Actions.');
  }

  if (shouldSkipEarlyFallback()) {
    console.log('[Antigravity Cron] Respaldo DST anterior a la hora objetivo; se usará el siguiente turno programado.');
    return;
  }

  const scheduleSlot = scheduledSlot();
  if (scheduleSlot) console.log(`[Antigravity Cron] Turno durable: ${scheduleSlot}`);

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
          sync: true,
          scheduledSlot: scheduleSlot || undefined,
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
      if (isNonRetryableQuotaError(err)) {
        console.error('[Antigravity Cron] Firebase agotó la cuota diaria; no se repetirán lecturas inútiles.');
        break;
      }
      if (attempt < 3) await wait(attempt * 15000);
    }
  }
  throw lastError;
}

runCron().catch(error => {
  console.error('[Antigravity Cron Error] Fallo definitivo:', error.message);
  process.exit(1);
});
