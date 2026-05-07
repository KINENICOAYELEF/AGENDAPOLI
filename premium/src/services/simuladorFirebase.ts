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
    frecuenciaDias: number; // 2, 3, 5, 7
    modoMinimo: string;     // 'completo' | 'cualquiera'
    mensaje?: string;
    actualizadoPor?: string;
    actualizadoEn?: Timestamp;
}

export interface CumplimientoResult {
    cumple: boolean;
    ultimoIntento: Date | null;
    diasDesdeUltimo: number;
    diasRestantes: number;
    creditosExtraAcumulados: number; // Simulations done "in advance" acting as credits
    descripcion: string;
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

/**
 * CREDIT BANK SYSTEM:
 * 
 * Works like a rolling window:
 * - Counts all simulations done in the last (frecuenciaDias * N) days
 * - Calculates how many "periods" they cover
 * - If they did 2 in one day and frequency is every 2 days, they have 1 credit for the next period
 * 
 * Example: frequency = every 2 days
 *   - Did 3 simulations in the last 2 days → covers 3 periods of 2 days → no debt for next 4 days
 *   - Did 0 in last 2 days → owes 1 simulation
 *   - Did 1 in last 2 days → just on time, 0 credits
 */
export async function verificarCumplimiento(
    userId: string,
    config: SimuladorTareaConfig
): Promise<CumplimientoResult> {
    const ahora = new Date();

    // Fetch enough history to cover potential credit bank (last 30 days)
    const intentos = await getIntentosEstudiante(userId, 50);

    if (intentos.length === 0) {
        return {
            cumple: false,
            ultimoIntento: null,
            diasDesdeUltimo: 999,
            diasRestantes: 0,
            creditosExtraAcumulados: 0,
            descripcion: 'Nunca has realizado una simulación.',
        };
    }

    // Filter by mode if required
    const intentosValidos = config.modoMinimo === 'completo'
        ? intentos.filter(i => i.practiceMode === 'completo')
        : intentos;

    if (intentosValidos.length === 0) {
        return {
            cumple: false,
            ultimoIntento: null,
            diasDesdeUltimo: 999,
            diasRestantes: 0,
            creditosExtraAcumulados: 0,
            descripcion: `No tienes simulaciones en modo "${config.modoMinimo === 'completo' ? 'Examen Completo' : 'cualquiera'}".`,
        };
    }

    // ─── Credit Bank Algorithm ───
    // Count simulations done in the last (frecuenciaDias * 15) days max
    const windowMs = config.frecuenciaDias * 15 * 24 * 60 * 60 * 1000;
    const windowStart = new Date(ahora.getTime() - windowMs);

    const intentosEnVentana = intentosValidos.filter(i => {
        const fecha = i.fecha ? i.fecha.toDate() : new Date(0);
        return fecha >= windowStart;
    });

    // How many "periods" have passed since the start of the tracking window
    // The tracking window starts from the earliest attempt or the config window
    const primerIntento = intentosEnVentana.length > 0
        ? (intentosEnVentana[intentosEnVentana.length - 1].fecha?.toDate() ?? ahora)
        : ahora;

    const diasDesdeInicio = Math.floor((ahora.getTime() - primerIntento.getTime()) / (1000 * 60 * 60 * 24));

    // How many periods have elapsed (minimum 1 — the current period)
    const periodosElapsed = Math.max(1, Math.ceil(diasDesdeInicio / config.frecuenciaDias));

    // How many simulations were required in that time
    const requeridas = periodosElapsed;

    // How many they actually did (valid ones)
    const realizadas = intentosEnVentana.length;

    // Credits = simulations done MINUS required ones
    const creditos = realizadas - requeridas;

    // The current period: when was the last required simulation due?
    const ultimoIntento = intentosValidos[0].fecha ? intentosValidos[0].fecha.toDate() : new Date();
    const diasDesdeUltimo = Math.floor((ahora.getTime() - ultimoIntento.getTime()) / (1000 * 60 * 60 * 24));

    // They comply if:
    // A) They are within the current period (diasDesdeUltimo < frecuenciaDias), OR
    // B) They have positive credits (did extra simulations in advance)
    const cumpleDirecto = diasDesdeUltimo < config.frecuenciaDias;
    const cumplePorCredito = creditos > 0 && diasDesdeUltimo < config.frecuenciaDias + (creditos * config.frecuenciaDias);
    const cumple = cumpleDirecto || cumplePorCredito;

    // Days remaining in current coverage
    const diasCubiertos = creditos > 0
        ? config.frecuenciaDias + (creditos * config.frecuenciaDias)
        : config.frecuenciaDias;
    const diasRestantes = Math.max(0, diasCubiertos - diasDesdeUltimo);

    let descripcion = '';
    if (cumple) {
        if (creditos > 0) {
            descripcion = `✓ Al día. Tienes ${creditos} simulación(es) extra que te cubren los próximos ${diasRestantes} día(s).`;
        } else {
            descripcion = `✓ Al día. Tienes ${diasRestantes} día(s) para tu próxima simulación.`;
        }
    } else {
        descripcion = diasDesdeUltimo >= 999
            ? 'Nunca has realizado una simulación.'
            : `Han pasado ${diasDesdeUltimo} día(s) desde tu última simulación válida (límite: ${config.frecuenciaDias} días).`;
    }

    return {
        cumple,
        ultimoIntento,
        diasDesdeUltimo,
        diasRestantes,
        creditosExtraAcumulados: Math.max(0, creditos),
        descripcion,
    };
}
