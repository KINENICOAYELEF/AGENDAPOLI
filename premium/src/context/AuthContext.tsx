"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { doc, serverTimestamp, onSnapshot, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { getDocCounted, setDocCounted } from "@/services/firestore";

export type Role = "DOCENTE" | "INTERNO" | "PENDING";

export interface AppUser extends User {
    role: Role;
    lastActiveAt?: string;
    createdAt?: any;
    bloqueoActivo?: boolean;
    bloqueoPacienteId?: string;
    bloqueoPacienteName?: string;
    bloqueoProcesoId?: string;
}

interface AuthContextType {
    user: AppUser | null;
    loading: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    logout: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubDoc: (() => void) | undefined = undefined;

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                try {
                    const userDocRef = doc(db, "users", firebaseUser.uid);

                    // Suscribirse a cambios en tiempo real del perfil
                    unsubDoc = onSnapshot(userDocRef, async (docSnap) => {
                        // Si la respuesta inicial viene del cache local y reporta que no existe,
                        // esperamos a la confirmación real del servidor antes de tomar una acción.
                        if (!docSnap.exists() && docSnap.metadata.fromCache) {
                            return;
                        }

                        let userRole: Role = "PENDING";
                        let additionalData = {};

                        if (docSnap.exists()) {
                            const data = docSnap.data();
                            userRole = data.role as Role;
                            additionalData = data;
                        } else {
                            // Primer inicio de sesión histórico: Creamos el documento "PENDING"
                            await setDocCounted(userDocRef, {
                                displayName: firebaseUser.displayName || "",
                                email: firebaseUser.email || "",
                                role: "PENDING",
                                createdAt: serverTimestamp(),
                            });
                        }

                        setUser({
                            ...firebaseUser,
                            role: userRole,
                            ...additionalData
                        } as unknown as AppUser);
                        setLoading(false);
                    }, (error) => {
                        console.error("Error en onSnapshot de usuario:", error);
                        setUser({ ...firebaseUser, role: "PENDING" } as AppUser);
                        setLoading(false);
                    });

                    // Registrar actividad de forma asíncrona
                    updateDoc(userDocRef, {
                        lastActiveAt: new Date().toISOString()
                    }).catch(err => console.error("Error actualizando lastActiveAt:", err));

                } catch (error) {
                    console.error("Error en flujo de autenticación:", error);
                    setUser({ ...firebaseUser, role: "PENDING" } as AppUser);
                    setLoading(false);
                }
            } else {
                if (unsubDoc) {
                    unsubDoc();
                    unsubDoc = undefined;
                }
                setUser(null);
                setLoading(false);
            }
        });

        return () => {
            unsubscribe();
            if (unsubDoc) unsubDoc();
        };
    }, []);

    const logout = async () => {
        try {
            setLoading(true);
            await signOut(auth);
        } catch (error) {
            console.error("Error signing out:", error);
            setLoading(false);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
