import { collection, doc, query, getDocs, limit, startAfter, QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { setDocCounted } from "@/services/firestore";
import { PersonaUsuaria } from "@/types/personaUsuaria";

const PAGE_LIMIT = 20;

/**
 * REPOSITORIO DE PERSONAS USUARIAS
 * Capa de abstracción. Internamente sigue comunicándose con la colección
 * "/programs/{year}/usuarias" para mantener compatibilidad e integridad en BD.
 */

export const PersonasUsuariasService = {
    /**
     * Obtiene un bloque paginado de Personas Usuarias.
     */
    async getPaginated(year: string, lastDocParam: QueryDocumentSnapshot | null = null): Promise<{
        data: PersonaUsuaria[],
        lastDoc: QueryDocumentSnapshot | null,
        hasMore: boolean
    }> {
        if (!year) throw new Error("Año de programa requerido");

        const collectionRef = collection(db, "programs", year, "usuarias");

        let q;
        if (lastDocParam) {
            // Siguiente página
            q = query(collectionRef, startAfter(lastDocParam), limit(PAGE_LIMIT));
        } else {
            // Primera página
            q = query(collectionRef, limit(PAGE_LIMIT));
        }

        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(d => d.data() as PersonaUsuaria);

        return {
            data,
            lastDoc: snapshot.docs.length === PAGE_LIMIT ? snapshot.docs[snapshot.docs.length - 1] : null,
            hasMore: snapshot.docs.length === PAGE_LIMIT
        };
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
    }
};
