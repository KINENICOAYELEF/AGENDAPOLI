import { RemoteHistory } from '@/types/personaUsuaria';

export function buildBasalSynthesis(history: RemoteHistory): string {
    if (!history) return 'Sin antecedentes remotos basales registrados.';

    const sections: string[] = [];

    // 1. Historial Médico
    const med = history.medicalHistory;
    if (med) {
        const modifiers = med.criticalModifiers?.join(', ') || 'Ninuno';
        const considers = med.clinicalConsiderations || 'Ninguna explícita';
        const diagnoses = med.diagnoses?.map(d => d.name).join(', ') || 'Normal';
        const surgeries = med.surgeries?.map(s => s.name).join(', ') || 'Ninguna';
        const meds = med.medications?.map(m => m.name).join(', ') || 'Sin información o no relevantes';

        sections.push(`[HISTORIAL MÉDICO] Modificadores Clínicos: ${modifiers}. Consideraciones: ${considers}. Diagnósticos: ${diagnoses}. Cirugías: ${surgeries}. Medicamentos: ${meds}.`);
    }

    // 2. Antecedentes MSK previos
    const msk = history.mskHistory;
    if (msk) {
        const problemRegion = msk.historicalProblemRegion || 'No aplica';
        const recurrences = msk.recurrences || 'No reportadas';
        const uselessTr = msk.uselessTreatments || 'No reportado';
        const usefulTr = msk.usefulTreatments || 'No reportado';

        sections.push(`[MSK PREVIO] Región Histórica: ${problemRegion}. Recurrencias: ${recurrences}. Tratamientos Previos Exitosos: ${usefulTr}. Tratamientos Inútiles/Mal Tolerados: ${uselessTr}.`);
    }

    // 3. Deporte y Carga Basal
    const act = history.baseActivity;
    if (act) {
        const sport = act.primarySport || 'Sedentario';
        const level = act.level || 'N/A';
        const load = act.doubleLoad || 'Sin doble carga física descrita';

        sections.push(`[CARGA BASAL/DEPORTE] Deporte Principal: ${sport} (Nivel: ${level}). Frecuencia/Duración: ${act.weeklyFrequency || '-'} / ${act.typicalDuration || '-'}. Doble Carga Física: ${load}.`);
    }

    // 4. Contexto Ocupacional
    const occ = history.occupationalContext;
    if (occ) {
        const role = occ.mainRole || 'No especificada';
        const barriers = occ.adherenceBarriers?.join(', ') || 'Ninguna descrita';

        sections.push(`[OCUPACIÓN] Rol: ${role}. Jornada: ${occ.shifts || 'Normal'}. Demandas posturales: Sentado(${occ.timeSitting || '-'}), DePie(${occ.timeStanding || '-'}), Carga(${occ.weightLifting || '-'}). Barreras Adherencia Logísticas: ${barriers}.`);
    }

    // 5. Terreno Biopsicosocial y Protectores
    const bps = history.bpsContext;
    if (bps) {
        const sleep = bps.sleepQuality || 'N/A';
        const stress = bps.stressLevel || 'N/A';
        const mood = bps.basalMood || 'N/A';
        const support = bps.socialSupport || 'N/A';
        const smoke = bps.smoking || 'N/A';
        const prot = bps.protectiveFactors || 'Ninguno';

        sections.push(`[BIO-PSICO-SOCIAL BASAL] Calidad Sueño: ${sleep}. Estrés: ${stress}. Ánimo Basal: ${mood}. Apoyo Social: ${support}. Tabaco: ${smoke}. Factores Protectores de Recuperación: ${prot}.`);
    }

    // 6. Notas Basales
    if (history.permanentNotes) {
        sections.push(`[NOTAS CLÍNICAS] ${history.permanentNotes.trim()}`);
    }

    return sections.join('\n');
}
