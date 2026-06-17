import { db } from '@/lib/firebase';
import { collection, doc, setDoc, getDoc, updateDoc, arrayUnion, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { CLINICAL_TOPICS, ClinicalTopic } from '../utils/clinicalTopics';

export interface RadarScores {
    biomecanica: number;
    diagnostico: number;
    neurofisiologia: number;
    dosificacion: number;
    terapiaManual: number;
}

export interface TopicProgress {
    topicId: string;
    puntajePromedio: number; // Escala 1.0 a 7.0
    vecesCompletado: number;
    ultimoRepaso: Timestamp | null;
    ultimoPuntaje: number;
    erroresHistoricos: string[];
    radarUltimo: RadarScores | null;
    ultimoTranscript?: string | null;
}

export interface UserTrainingProfile {
    userId: string;
    temas: Record<string, TopicProgress>;
    retosCompletadosTotal: number; // Progreso en el camino de 40 retos
    ultimaSesionSemana: Timestamp | null;
    sesionesCompletadasEstaSemana: number; // Retos completados en la semana actual
    estiloCognitivo: string; // 'ANALÍTICO' | 'METAFÓRICO' | 'PRAGMÁTICO' | 'NEUTRO'
}

// Función auxiliar para determinar si dos fechas pertenecen a la misma semana (Lunes a Domingo)
function isSameWeek(d1: Date, d2: Date): boolean {
    const getMonday = (d: Date) => {
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // ajustar si es Domingo
        const monday = new Date(d.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        return monday.getTime();
    };
    return getMonday(new Date(d1)) === getMonday(new Date(d2));
}

// Inicializar el perfil de un usuario si no existe
export const getUserTrainingProfile = async (userId: string): Promise<UserTrainingProfile> => {
    const docRef = doc(db, 'training_profiles', userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data() as UserTrainingProfile;
        
        // Migration safety
        if (data.retosCompletadosTotal === undefined) {
            data.retosCompletadosTotal = Object.values(data.temas).reduce((acc, t) => acc + t.vecesCompletado, 0);
        }
        if (!data.estiloCognitivo) {
            data.estiloCognitivo = 'NEUTRO';
        }
        
        // Verificar reinicio semanal
        if (data.ultimaSesionSemana) {
            const lastSessionDate = data.ultimaSesionSemana.toDate();
            const now = new Date();
            if (!isSameWeek(lastSessionDate, now)) {
                data.sesionesCompletadasEstaSemana = 0;
                await updateDoc(docRef, { sesionesCompletadasEstaSemana: 0 });
            }
        } else {
            data.sesionesCompletadasEstaSemana = 0;
        }
        
        if (data.sesionesCompletadasEstaSemana === undefined) {
            data.sesionesCompletadasEstaSemana = 0;
        }

        return data;
    }

    // Si no existe, crear perfil en blanco
    const initialProfile: UserTrainingProfile = {
        userId,
        temas: {},
        retosCompletadosTotal: 0,
        ultimaSesionSemana: null,
        sesionesCompletadasEstaSemana: 0,
        estiloCognitivo: 'NEUTRO'
    };
    
    // Lo guardamos
    await setDoc(docRef, initialProfile);
    return initialProfile;
};

// Guardar el resultado de una sesión y actualizar el progreso
export const saveTrainingSession = async (
    userId: string,
    topicId: string,
    puntaje: number, // Nota de 1.0 a 7.0
    errores: string[],
    radarScores: RadarScores,
    nuevoEstiloCognitivo?: string,
    transcriptText?: string
) => {
    const profileRef = doc(db, 'training_profiles', userId);
    const profile = await getUserTrainingProfile(userId);
    
    const topicData = profile.temas[topicId] || {
        topicId,
        puntajePromedio: 0,
        vecesCompletado: 0,
        ultimoRepaso: null,
        ultimoPuntaje: 0,
        erroresHistoricos: [],
        radarUltimo: null,
        ultimoTranscript: null
    };

    // Actualizar stats
    const nuevasVeces = topicData.vecesCompletado + 1;
    const puntajeActualReal = topicData.puntajePromedio === 0 ? puntaje : topicData.puntajePromedio;
    const nuevoPromedio = ((puntajeActualReal * topicData.vecesCompletado) + puntaje) / nuevasVeces;
    
    // Mantener solo los últimos 10 errores históricos
    const nuevosErrores = [...new Set([...errores, ...topicData.erroresHistoricos])].slice(0, 10);

    const updatedTopicData: TopicProgress = {
        topicId,
        puntajePromedio: nuevoPromedio,
        vecesCompletado: nuevasVeces,
        ultimoRepaso: Timestamp.now(),
        ultimoPuntaje: puntaje,
        erroresHistoricos: nuevosErrores,
        radarUltimo: radarScores,
        ultimoTranscript: transcriptText || topicData.ultimoTranscript || null
    };

    profile.temas[topicId] = updatedTopicData;
    profile.retosCompletadosTotal += 1;
    
    // Calcular sesiones semanales incrementando
    const now = new Date();
    let nuevasSesionesSemana = 1;
    if (profile.ultimaSesionSemana) {
        const lastSessionDate = profile.ultimaSesionSemana.toDate();
        if (isSameWeek(lastSessionDate, now)) {
            nuevasSesionesSemana = (profile.sesionesCompletadasEstaSemana || 0) + 1;
        }
    }
    profile.sesionesCompletadasEstaSemana = nuevasSesionesSemana;
    profile.ultimaSesionSemana = Timestamp.now();

    const updates: any = {
        [`temas.${topicId}`]: updatedTopicData,
        retosCompletadosTotal: profile.retosCompletadosTotal,
        ultimaSesionSemana: profile.ultimaSesionSemana,
        sesionesCompletadasEstaSemana: profile.sesionesCompletadasEstaSemana
    };

    // Actualizar perfil cognitivo si la IA lo sugiere
    if (nuevoEstiloCognitivo && nuevoEstiloCognitivo !== profile.estiloCognitivo) {
        updates.estiloCognitivo = nuevoEstiloCognitivo;
    }

    await updateDoc(profileRef, updates);
};

// Algoritmo de Repetición Espaciada y Camino Personal
export const selectOptimalTopicForUser = async (userId: string): Promise<{ topic: ClinicalTopic, historicalErrors: string[] }> => {
    const profile = await getUserTrainingProfile(userId);
    
    const seenTopicIds = Object.keys(profile.temas);
    const unseenTopics = CLINICAL_TOPICS.filter(t => !seenTopicIds.includes(t.id));

    // Si aún no completa los 40 retos básicos, prioriza siempre avanzar en los no vistos (ruta estricta)
    if (unseenTopics.length > 0) {
        // Seleccionamos un tema aleatorio entre los no vistos, para evitar que se repita siempre el mismo si abandona la sesión
        const randomIndex = Math.floor(Math.random() * unseenTopics.length);
        return { topic: unseenTopics[randomIndex], historicalErrors: [] };
    }

    // SI YA VIO LOS 40 TEMAS (MODO REFUERZO)
    // Buscar sus DEBILIDADES (nota menor a 4.0 o promedio bajo)
    const weakTopics = Object.values(profile.temas).filter(t => t.ultimoPuntaje < 4.0 || t.puntajePromedio < 4.0);
    
    if (weakTopics.length > 0) {
        // Ordenar del peor al "menos peor"
        weakTopics.sort((a, b) => a.ultimoPuntaje - b.ultimoPuntaje);
        // Tomar el peor o uno de los peores al azar
        const worstTopicProgress = weakTopics[Math.floor(Math.random() * Math.min(3, weakTopics.length))];
        const topic = CLINICAL_TOPICS.find(t => t.id === worstTopicProgress.topicId)!;
        return { topic, historicalErrors: worstTopicProgress.erroresHistoricos };
    }

    // Si no tiene debilidades graves, buscar el tema que hace más tiempo no repasa (Repetición Espaciada Pura)
    if (seenTopicIds.length > 0) {
        const allSeen = Object.values(profile.temas);
        allSeen.sort((a, b) => {
            const timeA = a.ultimoRepaso ? a.ultimoRepaso.toMillis() : 0;
            const timeB = b.ultimoRepaso ? b.ultimoRepaso.toMillis() : 0;
            return timeA - timeB; 
        });
        const oldestTopicProgress = allSeen[0];
        const topic = CLINICAL_TOPICS.find(t => t.id === oldestTopicProgress.topicId)!;
        return { topic, historicalErrors: oldestTopicProgress.erroresHistoricos };
    }

    // Fallback: Aleatorio
    const fallback = CLINICAL_TOPICS[Math.floor(Math.random() * CLINICAL_TOPICS.length)];
    return { topic: fallback, historicalErrors: [] };
};
