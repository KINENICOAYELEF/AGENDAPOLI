import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Turno } from '@/types/clinica';

export const TurnosService = {
    /**
     * Obtiene todos los turnos activos para el año dado
     */
    async getActiveTurnos(year: string): Promise<Turno[]> {
        const q = query(collection(db, 'programs', year, 'turnos'), where('active', '==', true));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Turno));
    },

    /**
     * Guarda o actualiza un turno
     */
    async save(year: string, turno: Turno): Promise<void> {
        if (!turno.id) throw new Error("Turno must have an ID for saving");
        const docRef = doc(db, 'programs', year, 'turnos', turno.id);
        await setDoc(docRef, turno, { merge: true });
    },

    /**
     * Encuentra el primer interno responsable de una franja y día dado.
     * Retorna el UID del interno o null si nadie matchea.
     */
    async findInternForSlot(year: string, dayOfWeek: string, time: string, durationMin: number, activeTurnos?: Turno[]): Promise<string | null> {
        let turnos = activeTurnos;
        if (!turnos) {
            turnos = await this.getActiveTurnos(year);
        }

        // Buscar el turno que cubra ese día y horario.
        // Asume horaInicio y horaFin en formato "HH:MM"
        const startTarget = time; // ej "18:00"

        // Logical simple match: The slot must be inside the shift timeframe.
        // For simplicity, we just check day and if startTarget is within [horaInicio, horaFin]
        const relevantShift = turnos.find(t =>
            t.diaSemana === dayOfWeek &&
            t.horaInicio <= startTarget &&
            t.horaFin >= startTarget
        );

        if (relevantShift && relevantShift.internosAsignados && relevantShift.internosAsignados.length > 0) {
            // Devuelve el primer interno (Titular de ese bloque) o si hay lógica rotativa podría ser distinto.
            // Para simplificar, devolvemos el primero.
            return relevantShift.internosAsignados[0];
        }

        return null;
    }
};
