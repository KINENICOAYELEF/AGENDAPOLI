import { db } from '@/lib/firebase';
import { collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, limit, Timestamp, deleteDoc } from 'firebase/firestore';

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

export interface SimuladorTareaConfig {
    activa: boolean;
    frecuenciaDias: number; // 2 or 3
    modoMinimo: string; // 'completo' | 'cualquiera'
    mensaje?: string; // Custom message from docente
    actualizadoPor?: string;
    actualizadoEn?: Timestamp;
}

const COLLECTION = 'simulador_intentos';
const CONFIG_DOC = 'simulador_config';
const CONFIG_COLLECTION = 'settings';

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

// ═══ TASK ASSIGNMENT SYSTEM ═══

// Save task config (docente only)
export async function guardarTareaConfig(config: SimuladorTareaConfig) {
    await setDoc(doc(db, CONFIG_COLLECTION, CONFIG_DOC), {
        ...config,
        actualizadoEn: Timestamp.now(),
    });
}

// Get task config
export async function getTareaConfig(): Promise<SimuladorTareaConfig | null> {
    const snap = await getDoc(doc(db, CONFIG_COLLECTION, CONFIG_DOC));
    if (!snap.exists()) return null;
    return snap.data() as SimuladorTareaConfig;
}

// Check if student is compliant with task requirement
export async function verificarCumplimiento(userId: string, config: SimuladorTareaConfig): Promise<{
    cumple: boolean;
    ultimoIntento: Date | null;
    diasDesdeUltimo: number;
    diasRestantes: number;
}> {
    const intentos = await getIntentosEstudiante(userId, 1);
    const ahora = new Date();

    if (intentos.length === 0) {
        return { cumple: false, ultimoIntento: null, diasDesdeUltimo: 999, diasRestantes: 0 };
    }

    const ultimo = intentos[0].fecha ? intentos[0].fecha.toDate() : new Date();
    const diffMs = ahora.getTime() - ultimo.getTime();
    const diasDesdeUltimo = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diasRestantes = Math.max(0, config.frecuenciaDias - diasDesdeUltimo);
    const cumple = diasDesdeUltimo < config.frecuenciaDias;

    // If modoMinimo is 'completo', check that the last attempt was in completo mode
    if (config.modoMinimo === 'completo' && intentos[0].practiceMode !== 'completo') {
        return { cumple: false, ultimoIntento: ultimo, diasDesdeUltimo, diasRestantes: 0 };
    }

    return { cumple, ultimoIntento: ultimo, diasDesdeUltimo, diasRestantes };
}
