import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppUser, Role } from "@/context/AuthContext";

/**
 * SERVICIO DE USUARIOS (STAFF)
 * Gestiona la obtención y metadatos de Docentes e Internos.
 */
export const UsersService = {
    /**
     * Obtiene todos los usuarios con un rol específico.
     */
    async getByRole(role: Role): Promise<AppUser[]> {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("role", "==", role));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as AppUser));
    },

    /**
     * Obtiene todos los Internos activos.
     */
    async getInterns(): Promise<AppUser[]> {
        return this.getByRole("INTERNO");
    },

    /**
     * Obtiene un usuario por su UID.
     */
    async getById(uid: string): Promise<AppUser | null> {
        const userRef = doc(db, "users", uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
            return { uid: snap.id, ...snap.data() } as AppUser;
        }
        return null;
    }
};
