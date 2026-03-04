import { collection, doc, query, where, getDocs, orderBy, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { setDocCounted } from "@/services/firestore";
import { Outcome } from "@/types/clinica";

export const OutcomesService = {
    /**
     * Obtiene todos los outcomes de un proceso ordenados por fecha ascendente.
     */
    async getByProceso(year: string, procesoId: string): Promise<Outcome[]> {
        if (!year) throw new Error("Año de programa requerido");
        if (!procesoId) throw new Error("ID de Proceso requerido");

        const collectionRef = collection(db, "programs", year, "procesos", procesoId, "outcomes");

        const q = query(
            collectionRef,
            orderBy("capturedAt", "asc")
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Outcome));
    },

    /**
     * Guarda (Crea o Actualiza) un Outcome
     */
    async save(year: string, procesoId: string, data: Outcome): Promise<void> {
        if (!year) throw new Error("Año de programa requerido");
        if (!procesoId) throw new Error("ID de Proceso requerido para guardar outcome");
        if (!data.id) throw new Error("ID de Outcome requerido para guardar");

        const targetRef = doc(db, "programs", year, "procesos", procesoId, "outcomes", data.id);

        // Volcado contabilizado
        await setDocCounted(targetRef, data, { merge: true });
    }
};
