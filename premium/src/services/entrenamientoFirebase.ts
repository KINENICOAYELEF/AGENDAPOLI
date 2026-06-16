import { db } from '../firebase/config';
import { collection, doc, setDoc, getDoc, updateDoc, arrayUnion, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { CLINICAL_TOPICS, ClinicalTopic } from '../utils/clinicalTopics';

export interface TopicProgress {
    topicId: string;
    puntajePromedio: number;
    vecesCompletado: number;
    ultimoRepaso: Timestamp | null;
    ultimoPuntaje: number;
    erroresHistoricos: string[];
}

export interface UserTrainingProfile {
    userId: string;
    temas: Record<string, TopicProgress>;
    sesionesCompletadasEstaSemana: number;
    ultimaSesionSemana: Timestamp | null;
}

// Inicializar el perfil de un usuario si no existe
export const getUserTrainingProfile = async (userId: string): Promise<UserTrainingProfile> => {
    const docRef = doc(db, 'training_profiles', userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data() as UserTrainingProfile;
        // Reiniciar el contador semanal si pasó a otra semana
        // Por simplicidad, chequearemos si la ultima sesion fue hace mas de 7 dias o en otra semana
        // (La lógica real de "nueva semana" puede requerir librerías como date-fns, aquí usaremos una aproximación)
        const now = new Date();
        const lastSessionDate = data.ultimaSesionSemana ? data.ultimaSesionSemana.toDate() : new Date(0);
        
        const isSameWeek = (d1: Date, d2: Date) => {
            const getWeek = (d: Date) => {
                const date = new Date(d.getTime());
                date.setHours(0, 0, 0, 0);
                date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
                const week1 = new Date(date.getFullYear(), 0, 4);
                return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
            };
            return d1.getFullYear() === d2.getFullYear() && getWeek(d1) === getWeek(d2);
        };

        if (!isSameWeek(now, lastSessionDate)) {
            data.sesionesCompletadasEstaSemana = 0;
            // No hacemos updateDoc acá para no gastar writes innecesarios hasta que complete una.
        }

        return data;
    }

    // Si no existe, crear perfil en blanco
    const initialProfile: UserTrainingProfile = {
        userId,
        temas: {},
        sesionesCompletadasEstaSemana: 0,
        ultimaSesionSemana: null
    };
    
    // Lo guardamos
    await setDoc(docRef, initialProfile);
    return initialProfile;
};

// Guardar el resultado de una sesión y actualizar el progreso
export const saveTrainingSession = async (
    userId: string,
    topicId: string,
    puntaje: number,
    errores: string[]
) => {
    const profileRef = doc(db, 'training_profiles', userId);
    const profile = await getUserTrainingProfile(userId);
    
    const topicData = profile.temas[topicId] || {
        topicId,
        puntajePromedio: 0,
        vecesCompletado: 0,
        ultimoRepaso: null,
        ultimoPuntaje: 0,
        erroresHistoricos: []
    };

    // Actualizar stats
    const nuevasVeces = topicData.vecesCompletado + 1;
    const nuevoPromedio = ((topicData.puntajePromedio * topicData.vecesCompletado) + puntaje) / nuevasVeces;
    
    // Mantener solo los últimos 10 errores históricos para no reventar Firestore
    const nuevosErrores = [...new Set([...errores, ...topicData.erroresHistoricos])].slice(0, 10);

    const updatedTopicData: TopicProgress = {
        topicId,
        puntajePromedio: nuevoPromedio,
        vecesCompletado: nuevasVeces,
        ultimoRepaso: Timestamp.now(),
        ultimoPuntaje: puntaje,
        erroresHistoricos: nuevosErrores
    };

    profile.temas[topicId] = updatedTopicData;
    profile.sesionesCompletadasEstaSemana += 1;
    profile.ultimaSesionSemana = Timestamp.now();

    await updateDoc(profileRef, {
        [`temas.${topicId}`]: updatedTopicData,
        sesionesCompletadasEstaSemana: profile.sesionesCompletadasEstaSemana,
        ultimaSesionSemana: profile.ultimaSesionSemana
    });
};

// Algoritmo de Repetición Espaciada
// Decide qué tema le toca hoy al usuario basándose en sus debilidades y temas no vistos
export const selectOptimalTopicForUser = async (userId: string): Promise<{ topic: ClinicalTopic, historicalErrors: string[] }> => {
    const profile = await getUserTrainingProfile(userId);
    
    const seenTopicIds = Object.keys(profile.temas);
    const unseenTopics = CLINICAL_TOPICS.filter(t => !seenTopicIds.includes(t.id));

    // Si hay temas nuevos que nunca ha visto, 50% de probabilidad de mostrarle uno nuevo
    if (unseenTopics.length > 0 && Math.random() > 0.5) {
        const randomUnseen = unseenTopics[Math.floor(Math.random() * unseenTopics.length)];
        return { topic: randomUnseen, historicalErrors: [] };
    }

    // Si no cayó en temas nuevos (o ya vió todos), buscamos sus DEBILIDADES
    // Una debilidad es un tema donde su último puntaje fue menor a 70, o su promedio es bajo
    const weakTopics = Object.values(profile.temas).filter(t => t.ultimoPuntaje < 70 || t.puntajePromedio < 70);
    
    if (weakTopics.length > 0) {
        // Ordenar del peor al "menos peor"
        weakTopics.sort((a, b) => a.ultimoPuntaje - b.ultimoPuntaje);
        // Tomar el peor o uno de los peores al azar
        const worstTopicProgress = weakTopics[Math.floor(Math.random() * Math.min(3, weakTopics.length))];
        const topic = CLINICAL_TOPICS.find(t => t.id === worstTopicProgress.topicId)!;
        return { topic, historicalErrors: worstTopicProgress.erroresHistoricos };
    }

    // Si no tiene debilidades (wow!), buscar el tema que hace más tiempo no repasa (Repetición Espaciada Pura)
    if (seenTopicIds.length > 0) {
        const allSeen = Object.values(profile.temas);
        allSeen.sort((a, b) => {
            const timeA = a.ultimoRepaso ? a.ultimoRepaso.toMillis() : 0;
            const timeB = b.ultimoRepaso ? b.ultimoRepaso.toMillis() : 0;
            return timeA - timeB; // El de menor tiempo es el más antiguo
        });
        const oldestTopicProgress = allSeen[0];
        const topic = CLINICAL_TOPICS.find(t => t.id === oldestTopicProgress.topicId)!;
        return { topic, historicalErrors: oldestTopicProgress.erroresHistoricos };
    }

    // Fallback: Aleatorio
    const fallback = CLINICAL_TOPICS[Math.floor(Math.random() * CLINICAL_TOPICS.length)];
    return { topic: fallback, historicalErrors: [] };
};
