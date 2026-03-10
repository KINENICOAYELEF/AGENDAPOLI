import { RemoteHistory } from "../types/personaUsuaria";

/**
 * Sintetiza la Anamnesis Remota (P1.5) en un string estructurado diseñado específicamente 
 * para ser consumido por el prompt de la IA de la Anamnesis Próxima (P1).
 * 
 * Regla de negocio estricta: Esta síntesis NO DEBE contener afirmaciones que la IA pueda
 * confundir con síntomas actuales. Su propósito es ser un *modulador* de contexto (precauciones, 
 * demandas físicas, terreno basal de recuperación).
 */
export function extractRemoteClinicalContext(history?: RemoteHistory): string {
    if (!history) return "Sin antecedentes remotos basales registrados.";

    const sections: string[] = [];

    // 1. Modificadores Médicos Relevantes
    if (history.medicalHistory) {
        const mh = history.medicalHistory;
        const medParts: string[] = [];

        if (mh.condicionesClinicasRelevantes?.length) {
            const conds = mh.condicionesClinicasRelevantes.map(c => {
                const parts = [`- ${c.name} (${c.estado || 'Estado desc.'})`];
                if (c.tratamientoActual && c.tratamientoDetalle) parts.push(`[TTO: ${c.tratamientoDetalle}]`);
                if (c.observacionBreve) parts.push(`-> Obs: ${c.observacionBreve}`);
                return parts.join(' ');
            });
            medParts.push(`Condiciones Clínicas Basales:\n${conds.join('\n')}`);
        }

        if (mh.medications?.length) medParts.push(`Fármacos base: ${mh.medications.map(m => m.name).join(', ')}`);
        if (mh.allergies?.length) medParts.push(`Alergias/RAM: ${mh.allergies.map(a => a.name).join(', ')}`);
        if (mh.surgeries?.length) medParts.push(`Cirugías previas: ${mh.surgeries.map(s => s.name).join(', ')}`);

        if (medParts.length > 0) {
            sections.push(`--- TERRENO MÉDICO Y PRECAUCIONES --- \n${medParts.join('\n')}`);
        }
    }

    // 2. Antecedentes Musculoesqueléticos Previos (MSK)
    if (history.mskHistory) {
        const msk = history.mskHistory;
        const mskParts: string[] = [];

        if (msk.historicalProblemRegion) mskParts.push(`Región históricamente problemática: ${msk.historicalProblemRegion}`);
        const mskInj = msk.relevantInjuries || [];
        if (mskInj.length > 0) mskParts.push(`Lesiones históricas: ${mskInj.map(i => `${i.region} (${i.notes})`).join(' | ')}`);

        const mskSurg = msk.mskSurgeries || [];
        if (mskSurg.length > 0) mskParts.push(`Cirugías Traumatológicas: ${mskSurg.map(s => s.name).join(', ')}`);

        if (msk.persistentSequelae) mskParts.push(`Secuelas persistentes: ${msk.persistentSequelae}`);
        if (msk.recurrences) mskParts.push(`Patrón de recurrencia histórico: ${msk.recurrences}`);

        if (mskParts.length > 0) {
            sections.push(`--- TERRENO MUSCULOESQUELÉTICO PREVIO --- \n(Nota para IA: Estos son antecedentes, NO la queja actual)\n${mskParts.join('\n')}`);
        }
    }

    // 3. Carga Ocupacional y Barreras (Socio-Demanda)
    if (history.occupationalContext) {
        const occ = history.occupationalContext;
        const occParts: string[] = [];

        if (occ.mainRole) occParts.push(`Rol/Ocupación: ${occ.mainRole}`);
        if (occ.physicalDemands) occParts.push(`Demanda Física Ocupacional: ${occ.physicalDemands}`);

        const occBarr = occ.adherenceBarriers || [];
        if (occBarr.length > 0) occParts.push(`Barreras de Adherencia: ${occBarr.join(', ')}`);

        if (occ.contextoDomiciliario) {
            const dom = occ.contextoDomiciliario;
            const domBarr = dom.barrerasEntorno || [];
            if (domBarr.length > 0) occParts.push(`Barreras Domiciliarias: ${domBarr.join(', ')}`);
            if (dom.redApoyo) occParts.push(`Red de apoyo para TTO: ${dom.redApoyo}`);
        }

        if (occParts.length > 0) {
            sections.push(`--- DEMANDA OCUPACIONAL Y ADHERENCIA --- \n${occParts.join('\n')}`);
        }
    }

    // 4. Terreno Biopsicosocial y Hábitos Basales (BPS)
    if (history.bpsContext) {
        const bps = history.bpsContext;
        const bpsParts: string[] = [];

        if (bps.sueno) {
            bpsParts.push(`Sueño basal: ${bps.sueno.horasPromedio || '?'} hrs, Hábito reparador: ${bps.sueno.reparador || 'No especificado'}`);
        }
        if (bps.estres) {
            bpsParts.push(`Estrés basal percibido: ${bps.stressLevel || 'No especificado'} (Fuente prioritaria: ${bps.estres.fuentePrincipal || 'N/A'})`);
        }
        if (bps.poorAdherenceHistory) {
            bpsParts.push(`Perfil de adherencia histórica a tratamiento/ejercicio: ${bps.poorAdherenceHistory}`);
        }
        if (bps.protectiveFactors) {
            bpsParts.push(`Factores protectores declarados: ${bps.protectiveFactors}`);
        }

        if (bpsParts.length > 0) {
            sections.push(`--- TERRENO BIO-PSICOSOCIAL DE RECUPERACIÓN --- \n${bpsParts.join('\n')}`);
        }
    }

    // 5. Factores Biológicos Especiales
    if (history.biologicalFactors) {
        const bio = history.biologicalFactors;
        const bioParts: string[] = [];

        if (bio.embarazoActual) bioParts.push("Cursa embarazo actual");
        if (bio.postpartoReciente) bioParts.push("Postparto reciente");
        if (bio.perimenopausiaMenopausia) bioParts.push("Transición menopáusica");

        if (bioParts.length > 0) {
            sections.push(`--- MODIFICADORES BIOLÓGICOS --- \n${bioParts.join(', ')}`);
        }
    }

    if (sections.length === 0) {
        return "Paciente sin antecedentes basales relevantes estratificados.";
    }

    return `\n\n[[ CONTEXTO CLÍNICO PREVIO / REMOTO (Fase 46.5) ]]\nEste paciente posee el siguiente terreno basal. USAR SOLO COMO CONTEXTO MODULADOR PARA PRONÓSTICO/PRECAUCIÓN Y NUNCA ASUMIR QUE LOS SÍNTOMAS AQUÍ DESCRITOS SON EL MOTIVO DE CONSULTA ACTUAL:\n\n` + sections.join('\n\n');
}
