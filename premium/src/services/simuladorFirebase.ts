import { db } from '@/lib/firebase';
import { collection, doc, setDoc, getDocs, query, where, orderBy, limit, Timestamp, deleteDoc } from 'firebase/firestore';

// ─── Types ───
export interface SimuladorIntento {
    id?: string;
    userId: string;
    userEmail: string;
    userName: string;
    // Case info
    area: string;
    dificultad: string;
    practiceMode: string;
    pacienteNombre: string;
    motivoConsulta: string;
    // Scores
    puntajeGlobal: number;
    notaChilena: number;
    nivel: string;
    puntajeComision: number;
    notaComision: number;
    // Scorecard detail
    scorecard: Record<string, { puntaje: number; comentario: string }>;
    // Time
    tiempoSegundos: number;
    // Timestamp
    fecha: Timestamp;
    // Optional: full data for docente review
    resumenTrabajo?: string;
}

const COLLECTION = 'simulador_intentos';

// ─── Save attempt ───
export async function guardarIntento(intento: Omit<SimuladorIntento, 'id' | 'fecha'>) {
    const ref = doc(collection(db, COLLECTION));
    await setDoc(ref, {
        ...intento,
        fecha: Timestamp.now(),
    });
    return ref.id;
}

// ─── Get attempts for a student ───
export async function getIntentosEstudiante(userId: string, maxResults = 20) {
    const q = query(
        collection(db, COLLECTION),
        where('userId', '==', userId),
        orderBy('fecha', 'desc'),
        limit(maxResults)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SimuladorIntento));
}

// ─── Get all attempts (docente view) ───
export async function getIntentosDocente(maxResults = 100) {
    const q = query(
        collection(db, COLLECTION),
        orderBy('fecha', 'desc'),
        limit(maxResults)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SimuladorIntento));
}

// ─── Delete attempt ───
export async function eliminarIntento(intentoId: string) {
    await deleteDoc(doc(db, COLLECTION, intentoId));
}
