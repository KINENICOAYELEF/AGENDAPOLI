import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { SuperProfile, INITIAL_SUPER_PROFILE } from '@/types/superProfile';

const SUPER_PROFILES_COLLECTION = 'super_profiles';

/**
 * Obtiene el Super Perfil Longitudinal del estudiante desde Firestore.
 * Si no existe, crea e inicializa uno nuevo.
 */
export async function getSuperProfile(userId: string, userName: string = 'Interno'): Promise<SuperProfile> {
    if (!userId) return INITIAL_SUPER_PROFILE('guest', userName);

    try {
        const docRef = doc(db, SUPER_PROFILES_COLLECTION, userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data() as SuperProfile;
        } else {
            const newProfile = INITIAL_SUPER_PROFILE(userId, userName);
            await setDoc(docRef, newProfile);
            return newProfile;
        }
    } catch (error) {
        console.error('Error al obtener SuperProfile desde Firestore:', error);
        return INITIAL_SUPER_PROFILE(userId, userName);
    }
}

/**
 * Actualiza y guarda el Super Perfil en Firestore.
 */
export async function saveSuperProfile(userId: string, profile: Partial<SuperProfile>): Promise<void> {
    if (!userId) return;

    try {
        const docRef = doc(db, SUPER_PROFILES_COLLECTION, userId);
        await setDoc(docRef, {
            ...profile,
            fechaUltimaSintesis: new Date().toISOString()
        }, { merge: true });
    } catch (error) {
        console.error('Error al guardar SuperProfile en Firestore:', error);
    }
}
