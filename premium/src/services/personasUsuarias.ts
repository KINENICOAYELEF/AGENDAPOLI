import { collection, doc, query, getDocs, orderBy, QueryDocumentSnapshot, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { setDocCounted } from "@/services/firestore";
import { PersonaUsuaria } from "@/types/personaUsuaria";

/**
 * REPOSITORIO DE PERSONAS USUARIAS
 * Capa de abstracción. Internamente sigue comunicándose con la colección
 * "/programs/{year}/usuarias" para mantener compatibilidad e integridad en BD.
 * 
 * FASE 70: Eliminada la paginación de 20 documentos que causaba que usuarios
 * nuevos no aparecieran después de refrescar (sus IDs quedaban después del
 * límite de la primera página). Para datasets de <500 usuarios, cargar todo
 * es seguro y elimina el bug completamente.
 */

export const PersonasUsuariasService = {
    /**
     * Obtiene TODAS las Personas Usuarias del año.
     * Para datasets de hasta ~500 registros esto es seguro y rápido.
     * 
     * Mantiene la firma de retorno original para no romper el contrato
     * con usuarios/page.tsx (lastDoc y hasMore siempre null/false).
     */
    async getPaginated(year: string, _lastDocParam: QueryDocumentSnapshot | null = null): Promise<{
        data: PersonaUsuaria[],
        lastDoc: QueryDocumentSnapshot | null,
        hasMore: boolean
    }> {
        if (!year) throw new Error("Año de programa requerido");

        const collectionRef = collection(db, "programs", year, "usuarias");

        // Carga todos los documentos sin límite ni paginación.
        // Firestore retorna por __name__ (document ID) por defecto.
        const q = query(collectionRef);

        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(d => d.data() as PersonaUsuaria);

        // Ordenar en el cliente por nombre para vista consistente
        data.sort((a, b) => {
            const nameA = (a.identity?.fullName || (a as any).nombreCompleto || '').toLowerCase();
            const nameB = (b.identity?.fullName || (b as any).nombreCompleto || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });

        return {
            data,
            lastDoc: null,
            hasMore: false
        };
    },

    /**
     * Obtiene una Persona Usuaria por su ID directly
     */
    async getById(year: string, id: string): Promise<PersonaUsuaria | null> {
        if (!year || !id) return null;
        const { getDoc } = await import("firebase/firestore");
        const docRef = doc(db, "programs", year, "usuarias", id);
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) return null;
        return snapshot.data() as PersonaUsuaria;
    },

    /**
     * Busca en bloque cargado (Actualmente Firebase no soporta LIKE, 
     * esta capa permite extender lógica de búsqueda a futuro Ej. Algolia/Typesense)
     * Por ahora, si se requiere búsqueda real en DB habría que hacer "IN" o Range Queries.
     * En la implementación actual, la búsqueda local se hace en el frontend.
     */

    /**
     * Guarda (Crea o Actualiza) una Persona Usuaria
     * Usa setDocCounted para registrar métricas telemétricas
     */
    async save(year: string, data: PersonaUsuaria): Promise<void> {
        if (!year) throw new Error("Año de programa requerido");
        if (!data.id) throw new Error("ID de Persona Usuaria requerido para guardar");

        const targetRef = doc(db, "programs", year, "usuarias", data.id);

        // Hacemos el volcado a la base de datos real
        await setDocCounted(targetRef, data, { merge: true });
    },

    /**
     * Elimina permanentemente una Persona Usuaria.
     * Solo debe ser invocado por roles ADMIN o DOCENTE.
     */
    async deleteById(year: string, id: string): Promise<void> {
        if (!year) throw new Error("Año de programa requerido");
        if (!id) throw new Error("ID de Persona Usuaria requerido para eliminar");

        const targetRef = doc(db, "programs", year, "usuarias", id);
        await deleteDoc(targetRef);
    }
};
