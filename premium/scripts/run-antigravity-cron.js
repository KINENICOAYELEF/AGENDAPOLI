/**
 * Script ejecutor de Cron para la síntesis nocturna del Agente de Antigravity.
 * Este script es invocado por la GitHub Action (.github/workflows/antigravity-super-profile-cron.yml).
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://polideportivo.vercel.app';
const API_KEY = process.env.GEMINI_API_KEY;

async function runCron() {
    console.log(`[Antigravity Cron] Iniciando síntesis nocturna en: ${APP_URL}`);
    
    if (!API_KEY) {
        console.warn(`[Antigravity Cron Warning] GEMINI_API_KEY no detectada en secretos. Verifique la configuración de GitHub Secrets.`);
    }

    try {
        const response = await fetch(`${APP_URL}/api/ai/super-profile`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'TEST_ANTIGRAVITY_REST',
                userId: 'cron_system_runner',
                estudianteNombre: 'Evaluación Nocturna Cohorte'
            })
        });

        const data = await response.json();
        console.log('[Antigravity Cron Success] Resultado de la ejecución:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('[Antigravity Cron Error] Fallo en la llamada:', err.message);
        process.exit(1);
    }
}

runCron();
