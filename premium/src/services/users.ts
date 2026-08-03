import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppUser, Role } from "@/context/AuthContext";

type UsersCacheEntry = {
    data: AppUser[];
    fetchedAt: number;
    inFlight?: Promise<AppUser[]>;
};

const usersCache = new Map<string, UsersCacheEntry>();
const USERS_CACHE_TTL_MS = 5 * 60 * 1000;

async function loadCached(key: string, loader: () => Promise<AppUser[]>) {
    const cached = usersCache.get(key);
    if (cached && Date.now() - cached.fetchedAt < USERS_CACHE_TTL_MS) return [...cached.data];
    if (cached?.inFlight) return [...await cached.inFlight];

    const inFlight = loader();
    usersCache.set(key, { data: cached?.data || [], fetchedAt: cached?.fetchedAt || 0, inFlight });
    try {
        const data = await inFlight;
        usersCache.set(key, { data, fetchedAt: Date.now() });
        return [...data];
    } catch (error) {
        usersCache.delete(key);
        throw error;
    }
}

/**
 * SERVICIO DE USUARIOS (STAFF)
 * Gestiona la obtención y metadatos de Docentes e Internos.
 */
export const UsersService = {
    /**
     * Obtiene todos los usuarios con un rol específico.
     */
    async getByRole(role: Role): Promise<AppUser[]> {
        return loadCached(`role:${role}`, async () => {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("role", "==", role));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as AppUser));
        });
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
    },

    async getAll(): Promise<AppUser[]> {
        return loadCached('all', async () => {
            const snapshot = await getDocs(collection(db, "users"));
            return snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as AppUser));
        });
    },

    invalidateCache() {
        usersCache.clear();
    }
};
