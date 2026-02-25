"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type Role = "DOCENTE" | "INTERNO";

export interface AppUser extends User {
    role: Role;
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
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // Consultar su documento en Firestore
                try {
                    const userDocRef = doc(db, "users", firebaseUser.uid);
                    const userDocSnap = await getDoc(userDocRef);

                    let userRole: Role = "INTERNO";

                    if (userDocSnap.exists()) {
                        userRole = userDocSnap.data().role as Role;
                    } else {
                        // Primer inicio de sesión histórico: Creamos el documento "INTERNO"
                        await setDoc(userDocRef, {
                            displayName: firebaseUser.displayName || "",
                            email: firebaseUser.email || "",
                            role: "INTERNO",
                            createdAt: serverTimestamp(),
                        });
                    }

                    // Inyectamos el rol al objeto User de Firebase de forma estricta extendiéndolo localmente
                    setUser({ ...firebaseUser, role: userRole } as AppUser);
                } catch (error) {
                    console.error("Error sincronizando rol desde Firestore:", error);
                    setUser({ ...firebaseUser, role: "INTERNO" } as AppUser); // Fallback seguro
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
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
