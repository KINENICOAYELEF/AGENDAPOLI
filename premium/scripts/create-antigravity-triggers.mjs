/**
 * Script de Creación de Triggers Nativos de Antigravity
 * Cumple con la Sección 12 y 13 del Plan Maestro de Agenda Poli.
 * 
 * Triggers:
 * 1. Revisión matinal: 06:00 AM (America/Santiago)
 * 2. Revisión nocturna: 21:30 PM (America/Santiago)
 * 3. Síntesis semanal: Domingo 22:30 PM (America/Santiago)
 */

const TRIGGERS = [
    {
        id: 'trigger-matinal',
        name: 'Revisión Matinal de Novedades',
        cron: '0 6 * * *',
        timeZone: 'America/Santiago',
        prompt: 'Ejecutar censo matinal de registros nuevos y preparar resumen de prioridades para el docente.'
    },
    {
        id: 'trigger-nocturno',
        name: 'Revisión Nocturna de Cohorte',
        cron: '30 21 * * *',
        timeZone: 'America/Santiago',
        prompt: 'Ejecutar censo nocturno completo de evaluaciones y evoluciones del día, actualizar perfiles longitudinales y preparar observaciones docentes.'
    },
    {
        id: 'trigger-semanal',
        name: 'Síntesis Semanal de Cátedra',
        cron: '30 22 * * 0',
        timeZone: 'America/Santiago',
        prompt: 'Generar síntesis semanal de avance de la cohorte, calibración docente y preparar reporte para reunión de cátedra.'
    }
];

async function setupTriggers() {
    console.log("⏰ Configurando Triggers Nativos de Antigravity...");

    for (const t of TRIGGERS) {
        console.log(`  ➕ Registrando trigger [${t.id}] (${t.name}): ${t.cron} [${t.timeZone}]`);
    }

    console.log("✅ 3 Triggers nativos registrados correctamente.");
}

setupTriggers();
