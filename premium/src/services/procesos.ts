import { collection, doc, query, where, getDocs, orderBy, QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { setDocCounted } from "@/services/firestore";
import { Proceso } from "@/types/clinica";

/**
 * REPOSITORIO DE PROCESOS
 * Administra el ciclo de vida de los casos/atenciones de las personas usuarias.
 */
export const ProcesosService = {
    /**
     * Obtiene todos los procesos de una persona usuaria.
     * Como una persona rara vez tendrá más de 5-10 procesos por año, 
     * lo traemos completo sin paginación compleja por ahora.
     */
    async getByPersona(year: string, personaUsuariaId: string): Promise<Proceso[]> {
        if (!year) throw new Error("Año de programa requerido");
        if (!personaUsuariaId) throw new Error("ID de Persona Usuaria requerido");

        const collectionRef = collection(db, "programs", year, "procesos");

        // CUIDADO: Requiere Índice Compuesto en Firebase (personaUsuariaId ASC + fechaInicio DESC)
        const q = query(
            collectionRef,
            where("personaUsuariaId", "==", personaUsuariaId),
            orderBy("fechaInicio", "desc")
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Proceso));
    },

    /**
     * Guarda (Crea o Actualiza) un Proceso
     */
    async save(year: string, data: Proceso): Promise<void> {
        if (!year) throw new Error("Año de programa requerido");
        if (!data.id) throw new Error("ID de Proceso requerido para guardar");

        const targetRef = doc(db, "programs", year, "procesos", data.id);

        // Volcado contabilizado
        await setDocCounted(targetRef, data, { merge: true });
    }
};
