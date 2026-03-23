import { collection, doc, writeBatch, getDocs, query, where, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { sanitizeForFirestoreDeep } from '@/lib/firebase-utils';
import { Proceso, Cita, Feriado } from '@/types/clinica';
import { TurnosService } from '@/services/turnos';

export const AgendaService = {
    /**
     * Obtiene todos los feriados/bloqueos activos para el año dado
     */
    async getHolidays(year: string): Promise<Feriado[]> {
        const q = query(collection(db, 'programs', year, 'calendario_feriados'), where('active', '==', true));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Feriado));
    },

    /**
     * Genera citas futuras para las próximas X semanas basado en el attendancePlan del proceso.
     * No sobrescribe ni duplica citas ya existentes en estado SCHEDULED.
     */
    async ensureSchedule(year: string, proceso: Proceso, maxWeeksAhead: number = 8): Promise<void> {
        if (!proceso.id || !proceso.attendancePlan || proceso.attendancePlan.status !== 'ACTIVO') {
            return;
        }

        const plan = proceso.attendancePlan;
        if (!plan.daysOfWeek || plan.daysOfWeek.length === 0) return;

        // 0. Cachear Turnos activos para matchear huecos sin titular
        const activeTurnos = await TurnosService.getActiveTurnos(year);

        // 1. Obtener Feriados si se solicita excluirlos
        let holidays: Feriado[] = [];
        if (plan.excludeHolidays) {
            holidays = await this.getHolidays(year);
        }
        const holidayDates = new Set(holidays.map(h => h.date));

        // 2. Definir Horizonte de Tiempo (Desde Hoy hasta maxWeeksAhead)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const planStart = new Date(plan.startDate);
        planStart.setHours(0, 0, 0, 0);

        const startDate = new Date(Math.max(today.getTime(), planStart.getTime()));

        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + (maxWeeksAhead * 7));

        if (plan.endDate) {
            const planEnd = new Date(plan.endDate);
            planEnd.setHours(0, 0, 0, 0);
            if (planEnd < endDate) {
                endDate.setTime(planEnd.getTime());
            }
        }

        // 3. Ver qué citas futuras ya existen para este proceso para NO duplicarlas
        const citasRef = collection(db, 'programs', year, 'citas');
        const startDateISO = startDate.toISOString().split('T')[0];
        const endDateISO = endDate.toISOString().split('T')[0];

        const qExisting = query(
            citasRef,
            where('procesoId', '==', proceso.id),
            where('date', '>=', startDateISO),
            where('date', '<=', endDateISO)
        );

        const existingDocs = await getDocs(qExisting);
        const existingDates = new Set(existingDocs.docs.map(d => d.data().date));

        // 4. Calcular los días candidatos a agendar
        const dayMap: Record<string, number> = { 'SUN': 0, 'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4, 'FRI': 5, 'SAT': 6 };
        const allowedDays = new Set(plan.daysOfWeek.map(d => dayMap[d]));

        // FASE 15: Obtener información del paciente para Asignaciones
        let assignedInternId: string | undefined = undefined;
        try {
            const usuariaRef = doc(db, 'programs', year, 'usuarias', proceso.personaUsuariaId);
            const usuariaSnap = await getDoc(usuariaRef);
            if (usuariaSnap.exists()) {
                const data = usuariaSnap.data();
                assignedInternId = data?.meta?.assignedInternId;
            }
        } catch (e) {
            console.error("No se pudo obtener la usuaria", e);
        }

        const citasToCreate: Partial<Cita>[] = [];
        let cursor = new Date(startDate);

        while (cursor <= endDate) {
            const isoDate = cursor.toISOString().split('T')[0];
            const dow = cursor.getDay(); // 0-6

            if (allowedDays.has(dow)) {
                // Es un día válido según el plan
                if (!existingDates.has(isoDate)) {
                    // Si no existe ya agendada
                    if (!plan.excludeHolidays || !holidayDates.has(isoDate)) {
                        // Cumple restricción de feriados

                        // Parse de tiempo final
                        const startHm = plan.time; // ej. "18:00"
                        const [hStr, mStr] = startHm.split(':');
                        const h = parseInt(hStr, 10);
                        const m = parseInt(mStr, 10);
                        const duration = plan.durationMin || 50;

                        const endCursor = new Date(cursor);
                        endCursor.setHours(h, m + duration, 0, 0);
                        const endHm = endCursor.toTimeString().substring(0, 5);

                        // FASE 2.3.4 & FASE 15: Inferencia de internPlanificado
                        let planificado = assignedInternId || proceso.primaryInternId || plan.primaryInternId;
                        if (!planificado) {
                            const dowStr = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][dow];
                            const matchTurno = await TurnosService.findInternForSlot(year, dowStr, startHm, duration, activeTurnos);
                            planificado = matchTurno || undefined;
                        }

                        citasToCreate.push({
                            id: `cita_${proceso.id}_${isoDate}`,
                            procesoId: proceso.id,
                            usuariaId: proceso.personaUsuariaId,
                            date: isoDate,
                            startTime: startHm,
                            endTime: endHm,
                            status: 'SCHEDULED',
                            internoPlanificadoId: planificado,
                            shortReason: proceso.motivoIngresoLibre, // FASE 15
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        });
                    }
                }
            }
            cursor.setDate(cursor.getDate() + 1);
        }

        // 5. Batched Write
        if (citasToCreate.length > 0) {
            const batch = writeBatch(db);
            citasToCreate.forEach(cita => {
                const docRef = doc(citasRef, cita.id);
                const sanitizedCita = sanitizeForFirestoreDeep(cita);
                batch.set(docRef, sanitizedCita);
            });
            await batch.commit();
        }
    },

    /**
     * FASE 2.3.5: Re-generar agenda a partir de un cambio de Plan.
     * Elimina las futuras (SCHEDULED) y re-calcula las nuevas franjas.
     */
    async rebuildSchedule(year: string, proceso: Proceso, maxWeeksAhead: number = 8): Promise<void> {
        if (!proceso.id) return;

        const todayStr = new Date().toISOString().split('T')[0];
        const citasRef = collection(db, 'programs', year, 'citas');

        const qFuture = query(
            citasRef,
            where('procesoId', '==', proceso.id),
            where('date', '>=', todayStr),
            where('status', '==', 'SCHEDULED')
        );
        const snapshot = await getDocs(qFuture);

        if (!snapshot.empty) {
            const batch = writeBatch(db);
            snapshot.docs.forEach(d => {
                batch.delete(d.ref);
            });
            await batch.commit();
        }

        await this.ensureSchedule(year, proceso, maxWeeksAhead);
    },

    /**
     * Pausa todas las citas futuras (SCHEDULED -> SUSPENDED)
     */
    async pauseSchedule(year: string, procesoId: string): Promise<void> {
        await this._updateFutureCitas(year, procesoId, 'SUSPENDED');
    },

    /**
     * Cancela todas las citas futuras por alta (SCHEDULED -> CANCELLED)
     */
    async cancelFutureSchedule(year: string, procesoId: string): Promise<void> {
        await this._updateFutureCitas(year, procesoId, 'CANCELLED');
    },

    async _updateFutureCitas(year: string, procesoId: string, targetStatus: 'SUSPENDED' | 'CANCELLED'): Promise<void> {
        const todayStr = new Date().toISOString().split('T')[0];

        const qFuture = query(
            collection(db, 'programs', year, 'citas'),
            where('procesoId', '==', procesoId),
            where('date', '>=', todayStr),
            where('status', '==', 'SCHEDULED')
        );

        const snapshot = await getDocs(qFuture);

        if (!snapshot.empty) {
            const batch = writeBatch(db);
            snapshot.docs.forEach(d => {
                batch.update(d.ref, sanitizeForFirestoreDeep({
                    status: targetStatus,
                    updatedAt: new Date().toISOString()
                }));
            });
            await batch.commit();
        }
    },

    /**
     * FASE 2.3.2: Vincula una Cita con una Evolución firmada, autocompletando la asistencia
     */
    async markCitaAsCompleted(year: string, citaId: string, evolucionId: string, authorUid: string): Promise<void> {
        const docRef = doc(db, 'programs', year, 'citas', citaId);
        const sanitizedUpdate = sanitizeForFirestoreDeep({
            status: 'COMPLETED',
            linkedEvolutionId: evolucionId,
            attendanceMarkedAt: new Date().toISOString(),
            attendanceMarkedBy: authorUid,
            updatedAt: new Date().toISOString()
        });
        await updateDoc(docRef, sanitizedUpdate);
    }
};
